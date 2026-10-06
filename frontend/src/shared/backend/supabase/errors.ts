import { isAuthError } from '@supabase/supabase-js'
import { BackendError } from '../errors'

const NETWORK_RE = /failed to fetch|networkerror|load failed|network request failed/i

/** Erros do Supabase (Auth ou banco) → `BackendError` — mesmas regras que o
 * `authErrors.ts` do V0 aplicava direto nas telas (design D3 da T-16). */
export function toBackendError(error: unknown): BackendError {
  if (error instanceof BackendError) return error

  const code = isAuthError(error) ? error.code : isRecord(error) ? error.code : undefined
  switch (code) {
    case 'invalid_credentials':
      return new BackendError('invalid_credentials', { cause: error })
    case 'user_already_exists':
    case 'email_exists':
      return new BackendError('email_taken', { cause: error })
    case 'weak_password':
      return new BackendError('weak_password', { cause: error })
    case 'over_request_rate_limit':
      return new BackendError('rate_limited', { cause: error })
    case 'email_not_confirmed':
      return new BackendError('email_not_confirmed', { cause: error })
    // Índice único (petshop_id, ean): o código já é de outro produto da loja. O
    // Supabase não diz de qual — a tela procura na lista carregada.
    case '23505':
      return new BackendError('ean_taken', { cause: error })
  }

  const message = error instanceof Error || isRecord(error) ? String(error.message ?? '') : ''
  const status = isAuthError(error) ? error.status : undefined
  if (status === 0 || NETWORK_RE.test(message) || (isRecord(error) && error.name === 'AuthRetryableFetchError')) {
    return new BackendError('network', { cause: error })
  }
  return new BackendError('unknown', { message, cause: error })
}

function isRecord(value: unknown): value is Record<string, unknown> & { code?: string; message?: unknown; name?: unknown } {
  return typeof value === 'object' && value !== null
}
