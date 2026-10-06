import { isBackendError } from '../../shared/backend'

export const MIN_PASSWORD_LENGTH = 6

/** Mesma regra de e-mail do protótipo (script.js §12). */
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export interface FormMessage {
  text: string
  /** Mostra o link "Entrar" junto da mensagem (e-mail já cadastrado). */
  suggestLogin?: boolean
}

/** Traduz o erro do backend (Supabase ou API — design D3 da T-16) para a mensagem da tela. */
export function toFormMessage(error: unknown): FormMessage {
  switch (isBackendError(error) ? error.kind : undefined) {
    case 'invalid_credentials':
      return { text: 'E-mail ou senha incorretos.' }
    case 'email_taken':
      return { text: 'Já existe uma conta com este e-mail.', suggestLogin: true }
    case 'weak_password':
      return { text: `A senha precisa ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.` }
    case 'rate_limited':
      return { text: 'Muitas tentativas. Aguarde um minuto e tente de novo.' }
    case 'email_not_confirmed':
      return { text: 'Confirme seu e-mail antes de entrar: abra o link que enviamos para ele.' }
    case 'ean_taken':
      return { text: 'O código de barras já pertence a outro produto da loja.' }
    case 'session_expired':
      return { text: 'Sua sessão expirou. Entre de novo.' }
    case 'network':
      return { text: 'Não foi possível conectar. Verifique a internet e tente de novo.' }
  }

  console.error(isBackendError(error) && error.cause ? error.cause : error)
  return { text: 'Algo deu errado. Tente de novo.' }
}
