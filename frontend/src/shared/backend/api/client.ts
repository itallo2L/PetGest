import { BackendError, type BackendErrorKind } from '../errors'
import type { AuthUser } from '../types'
import type { components } from './schema'

type SessionResponse = components['schemas']['SessionResponse']

/** Chaves no `localStorage` (design D4 da T-16). O token de acesso nunca vai para o
 * armazenamento: fica só em memória. */
export const REFRESH_TOKEN_KEY = 'petgest.auth.refreshToken'
export const USER_KEY = 'petgest.auth.user'

const LOCK_NAME = 'petgest-refresh'

interface KeyValueStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

interface Locks {
  request<T>(name: string, callback: () => Promise<T>): Promise<T>
}

/** Dependências do navegador, injetáveis nos testes (Node não tem `window`). */
export interface ApiClientDeps {
  fetch: typeof fetch
  storage: KeyValueStorage
  /** Web Locks API — serializa a renovação entre abas. */
  locks?: Locks
  /** Mudanças do armazenamento feitas por outra aba (evento `storage`). */
  onStorageChange?: (callback: (key: string | null, newValue: string | null) => void) => void
}

export interface RequestOptions {
  body?: unknown
  /** Chamada com token de acesso (padrão). As de `/auth` que abrem sessão não usam. */
  auth?: boolean
}

function browserDeps(): ApiClientDeps {
  return {
    fetch: (...args) => globalThis.fetch(...args),
    storage: globalThis.localStorage,
    locks: globalThis.navigator?.locks as Locks | undefined,
    onStorageChange: (callback) =>
      globalThis.addEventListener('storage', (event) => callback(event.key, event.newValue)),
  }
}

/**
 * Cliente HTTP da API com a sessão (design D4 da T-16):
 * - token de acesso em memória; refresh token e usuário no `localStorage`;
 * - `401` → renovação em voo único e uma nova tentativa;
 * - a renovação roda sob Web Lock e relê o refresh token do armazenamento, para não
 *   reusar um token que outra aba acabou de trocar (a API derrubaria a sessão);
 * - outra aba saiu (chave apagada) → avisa que a sessão acabou.
 */
export class ApiClient {
  private accessToken: string | null = null
  private refreshing: Promise<boolean> | null = null
  private readonly sessionListeners = new Set<(user: AuthUser | null) => void>()
  private readonly baseUrl: string
  private readonly deps: ApiClientDeps

  constructor(baseUrl: string, deps: ApiClientDeps = browserDeps()) {
    this.baseUrl = baseUrl
    this.deps = deps
    deps.onStorageChange?.((key, newValue) => {
      if (key === REFRESH_TOKEN_KEY && newValue === null) {
        this.accessToken = null
        this.notify(null)
      } else if (key === USER_KEY && newValue !== null) {
        // Outra aba entrou (ou trocou de conta): o próximo pedido renova com o token novo.
        this.accessToken = null
        this.notify(this.storedUser())
      } else if (key === null) {
        // localStorage.clear() em outra aba.
        this.accessToken = null
        this.notify(this.storedUser())
      }
    })
  }

  /** Usuário da sessão salva, ou `null` — sem ir à rede. */
  storedUser(): AuthUser | null {
    if (!this.deps.storage.getItem(REFRESH_TOKEN_KEY)) return null
    try {
      const user = JSON.parse(this.deps.storage.getItem(USER_KEY) ?? 'null') as AuthUser | null
      return user?.id ? user : null
    } catch {
      return null
    }
  }

  /** Sessão perdida (renovação recusada, saída em outra aba) ou trocada em outra aba. */
  onSessionChange(listener: (user: AuthUser | null) => void): () => void {
    this.sessionListeners.add(listener)
    return () => this.sessionListeners.delete(listener)
  }

  /** Guarda a sessão devolvida por cadastro, login ou renovação. */
  setSession(session: SessionResponse): AuthUser {
    this.accessToken = session.accessToken
    const user = userFromAccessToken(session.accessToken)
    this.deps.storage.setItem(REFRESH_TOKEN_KEY, session.refreshToken)
    this.deps.storage.setItem(USER_KEY, JSON.stringify(user))
    return user
  }

  /** Apaga a sessão local (o evento `storage` avisa as outras abas). */
  clearSession(): void {
    this.accessToken = null
    this.deps.storage.removeItem(REFRESH_TOKEN_KEY)
    this.deps.storage.removeItem(USER_KEY)
    this.notify(null)
  }

  storedRefreshToken(): string | null {
    return this.deps.storage.getItem(REFRESH_TOKEN_KEY)
  }

  async request<T>(method: string, path: string, options: RequestOptions = {}): Promise<T> {
    const auth = options.auth ?? true
    if (auth && !this.accessToken) {
      // Sessão restaurada do armazenamento: ainda não há token de acesso em memória.
      if (!(await this.refresh())) throw new BackendError('session_expired')
    }

    let response = await this.send(method, path, options.body, auth)
    if (response.status === 401 && auth) {
      if (!(await this.refresh())) throw new BackendError('session_expired')
      response = await this.send(method, path, options.body, auth)
    }
    if (!response.ok) throw await toBackendError(response)
    if (response.status === 204) return undefined as T
    return (await response.json()) as T
  }

  /**
   * Renova a sessão uma vez para todos que pedirem ao mesmo tempo. `true` = há token de
   * acesso novo; `false` = sessão recusada pela API (e apagada). Erro de rede propaga
   * `network` sem apagar nada — a tela oferece "Tentar de novo".
   */
  refresh(): Promise<boolean> {
    this.refreshing ??= this.withLock(() => this.doRefresh()).finally(() => {
      this.refreshing = null
    })
    return this.refreshing
  }

  private async doRefresh(): Promise<boolean> {
    // Relido aqui, dentro do lock: se outra aba renovou, este é o token novo.
    const refreshToken = this.deps.storage.getItem(REFRESH_TOKEN_KEY)
    if (!refreshToken) {
      this.accessToken = null
      return false
    }

    const response = await this.send('POST', '/auth/refresh', { refreshToken }, false)
    if (response.ok) {
      this.setSession((await response.json()) as SessionResponse)
      return true
    }
    if (response.status === 401 || response.status === 403) {
      // Só apaga se ninguém trocou o token enquanto isso (sem Web Locks, outra aba pode).
      if (this.deps.storage.getItem(REFRESH_TOKEN_KEY) === refreshToken) this.clearSession()
      return false
    }
    throw await toBackendError(response)
  }

  private withLock<T>(callback: () => Promise<T>): Promise<T> {
    return this.deps.locks ? this.deps.locks.request(LOCK_NAME, callback) : callback()
  }

  private async send(method: string, path: string, body: unknown, auth: boolean): Promise<Response> {
    const headers: Record<string, string> = { Accept: 'application/json' }
    if (body !== undefined) headers['Content-Type'] = 'application/json'
    if (auth && this.accessToken) headers.Authorization = `Bearer ${this.accessToken}`
    try {
      return await this.deps.fetch(`${this.baseUrl}${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
      })
    } catch (error) {
      throw new BackendError('network', { cause: error })
    }
  }

  private notify(user: AuthUser | null) {
    for (const listener of this.sessionListeners) listener(user)
  }
}

/** Usuário a partir das claims do JWT de acesso (`sub`, `email`) — sem chamada extra. */
export function userFromAccessToken(accessToken: string): AuthUser {
  const payload = accessToken.split('.')[1] ?? ''
  const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(payload.length / 4) * 4, '='))
  const claims = JSON.parse(new TextDecoder().decode(Uint8Array.from(json, (c) => c.charCodeAt(0)))) as {
    sub: string
    email?: string
  }
  return { id: claims.sub, email: claims.email ?? '' }
}

const CODE_TO_KIND: Record<string, BackendErrorKind> = {
  invalid_credentials: 'invalid_credentials',
  email_taken: 'email_taken',
  weak_password: 'weak_password',
  email_not_confirmed: 'email_not_confirmed',
  ean_taken: 'ean_taken',
  petshop_exists: 'petshop_exists',
  product_not_found: 'not_found',
  petshop_not_found: 'not_found',
  invalid_refresh_token: 'session_expired',
}

/** `ProblemDetails` da API (com a extensão `code` — T-14/T-15) → `BackendError`. */
export async function toBackendError(response: Response): Promise<BackendError> {
  let problem: { code?: string; title?: string; product?: { id: string; name: string } } = {}
  try {
    problem = (await response.json()) as typeof problem
  } catch {
    // corpo vazio ou não-JSON
  }
  if (response.status === 429) return new BackendError('rate_limited', { cause: problem })
  const kind = (problem.code && CODE_TO_KIND[problem.code]) || 'unknown'
  return new BackendError(kind, {
    message: problem.title ?? `HTTP ${response.status}`,
    owner: kind === 'ean_taken' ? problem.product : undefined,
    cause: { status: response.status, problem },
  })
}
