import { isAuthError } from '@supabase/supabase-js'

export const MIN_PASSWORD_LENGTH = 6

/** Mesma regra de e-mail do protótipo (script.js §12). */
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export interface FormMessage {
  text: string
  /** Mostra o link "Entrar" junto da mensagem (e-mail já cadastrado). */
  suggestLogin?: boolean
}

const NETWORK_RE = /failed to fetch|networkerror|load failed|network request failed/i

/** Traduz erros do Supabase (Auth ou banco) para mensagens da tela. */
export function toFormMessage(error: unknown): FormMessage {
  const code = isAuthError(error) ? error.code : undefined
  const message = error instanceof Error || isRecord(error) ? String(error.message ?? '') : ''
  const status = isAuthError(error) ? error.status : undefined

  switch (code) {
    case 'invalid_credentials':
      return { text: 'E-mail ou senha incorretos.' }
    case 'user_already_exists':
    case 'email_exists':
      return { text: 'Já existe uma conta com este e-mail.', suggestLogin: true }
    case 'weak_password':
      return { text: `A senha precisa ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.` }
    case 'over_request_rate_limit':
      return { text: 'Muitas tentativas. Aguarde um minuto e tente de novo.' }
  }

  if (status === 0 || NETWORK_RE.test(message) || (isRecord(error) && error.name === 'AuthRetryableFetchError')) {
    return { text: 'Não foi possível conectar. Verifique a internet e tente de novo.' }
  }

  console.error(error)
  return { text: 'Algo deu errado. Tente de novo.' }
}

function isRecord(value: unknown): value is Record<string, unknown> & { message?: unknown } {
  return typeof value === 'object' && value !== null
}
