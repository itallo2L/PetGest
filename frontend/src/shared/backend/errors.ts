/** Erro comum dos dois backends (design D3 da T-16): as telas traduzem `kind` para as
 * mensagens em português, sem saber se o erro veio do Supabase ou da API. */
export type BackendErrorKind =
  | 'invalid_credentials'
  | 'email_taken'
  | 'weak_password'
  | 'rate_limited'
  | 'email_not_confirmed'
  /** Link de confirmação ou de redefinição de senha inválido, expirado ou já usado (T-22). */
  | 'invalid_link'
  | 'ean_taken'
  /** Cadastro por foto/voz (T-19/T-20): IA não configurada na API. */
  | 'ai_unavailable'
  /** A IA falhou ou demorou demais — dá para tentar de novo ou preencher à mão. */
  | 'ai_failed'
  /** Arquivo de foto/áudio recusado (formato ou tamanho). */
  | 'invalid_file'
  /** A conta já tem loja (criar a loja de novo é tratado como sucesso). */
  | 'petshop_exists'
  | 'not_found'
  /** A sessão não pôde ser renovada (expirada, revogada ou reusada) — o app volta para entrar. */
  | 'session_expired'
  | 'network'
  | 'unknown'

export interface ProductOwner {
  id: string
  name: string
}

export class BackendError extends Error {
  readonly kind: BackendErrorKind
  /** Produto que já tem o código (`ean_taken`), quando o backend informa — a API sim,
   * o Supabase não (a tela procura na lista carregada). */
  readonly owner?: ProductOwner

  constructor(kind: BackendErrorKind, options: { message?: string; owner?: ProductOwner; cause?: unknown } = {}) {
    super(options.message ?? kind, { cause: options.cause })
    this.name = 'BackendError'
    this.kind = kind
    this.owner = options.owner
  }
}

export function isBackendError(error: unknown): error is BackendError {
  return error instanceof BackendError
}
