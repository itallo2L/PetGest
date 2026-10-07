import type { ApiClientDeps } from './client'

/** Apoio dos testes do backend da API: armazenamento, `fetch` e eventos falsos. */

export function fakeJwt(claims: Record<string, unknown>): string {
  // JWT real: JSON em UTF-8, depois base64url.
  const encode = (value: unknown) =>
    btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(value))))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '')
  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode(claims)}.assinatura`
}

export function sessionFor(user: { id: string; email: string }, refreshToken: string, petshopId?: string) {
  return {
    accessToken: fakeJwt({ sub: user.id, email: user.email, petshop_id: petshopId }),
    tokenType: 'Bearer',
    expiresIn: 900,
    refreshToken,
    refreshTokenExpiresAt: '2099-01-01T00:00:00Z',
  }
}

export function json(status: number, body?: unknown): Response {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

export interface Call {
  method: string
  path: string
  /** JSON já lido, ou o próprio `FormData` (envio de arquivos). */
  body: unknown
  authorization: string | null
  contentType: string | null
}

type Handler = (call: Call) => Response | Promise<Response>

/** Deps falsas: `fetch` responde por `MÉTODO /caminho`; `emitStorage` simula outra aba. */
export function fakeDeps(handlers: Record<string, Handler>) {
  const store = new Map<string, string>()
  const calls: Call[] = []
  let storageCallback: ((key: string | null, newValue: string | null) => void) | undefined

  const deps: ApiClientDeps = {
    storage: {
      getItem: (key) => store.get(key) ?? null,
      setItem: (key, value) => void store.set(key, value),
      removeItem: (key) => void store.delete(key),
    },
    fetch: async (input, init) => {
      const url = new URL(String(input), 'http://api.test')
      const headers = new Headers(init?.headers)
      const call: Call = {
        method: init?.method ?? 'GET',
        path: url.pathname.replace(/^\/api/, ''),
        body: init?.body instanceof FormData ? init.body : init?.body ? JSON.parse(String(init.body)) : undefined,
        authorization: headers.get('Authorization'),
        contentType: headers.get('Content-Type'),
      }
      calls.push(call)
      const handler = handlers[`${call.method} ${call.path}`]
      if (!handler) throw new Error(`Sem resposta falsa para ${call.method} ${call.path}`)
      return handler(call)
    },
    onStorageChange: (callback) => {
      storageCallback = callback
    },
  }

  return {
    deps,
    store,
    calls,
    /** Outra aba mudou o armazenamento: aplica e dispara o evento. */
    emitStorage(key: string, newValue: string | null) {
      if (newValue === null) store.delete(key)
      else store.set(key, newValue)
      storageCallback?.(key, newValue)
    },
  }
}
