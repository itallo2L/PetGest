import { useState, type FormEvent } from 'react'
import { getBackend } from '../../shared/backend'
import { focusField } from '../../shared/ui/touch'
import { EMAIL_RE, toFormMessage, type FormMessage } from './authErrors'
import { FormError } from './FormError'

interface ResendConfirmationProps {
  /** E-mail já digitado (na tela de entrar); sem ele, o componente pede o e-mail. */
  email?: string
}

/** Reenvio do link de confirmação (T-22). A resposta não revela se a conta existe nem se
 * já está confirmada. */
export function ResendConfirmation({ email: knownEmail }: ResendConfirmationProps) {
  const account = getBackend().account
  const [email, setEmail] = useState(knownEmail ?? '')
  const [error, setError] = useState<FormMessage | null>(null)
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)

  if (!account) return null

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!account) return
    const trimmed = email.trim()
    if (!EMAIL_RE.test(trimmed)) {
      setError({ text: 'Informe um e-mail válido.' })
      focusField('resendEmail')
      return
    }
    setError(null)
    setSending(true)
    try {
      await account.resendConfirmation(trimmed)
      setSent(true)
    } catch (resendError) {
      setError(toFormMessage(resendError))
    } finally {
      setSending(false)
    }
  }

  if (sent) {
    return (
      <p className="auth-message" role="status">
        Se a conta existir e o e-mail ainda não estiver confirmado, enviamos um link novo. Confira também a caixa de
        spam.
      </p>
    )
  }

  return (
    <form className="auth-form" onSubmit={handleSubmit} noValidate>
      {knownEmail === undefined && (
        <div className="field">
          <label className="field__label" htmlFor="resendEmail">
            E-mail da conta
          </label>
          <input
            className="input"
            type="email"
            id="resendEmail"
            inputMode="email"
            autoComplete="username"
            placeholder="voce@petshop.com.br"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </div>
      )}
      <FormError message={error} />
      <button type="submit" className="btn btn--outline auth-submit" disabled={sending}>
        {sending ? 'Enviando…' : 'Reenviar e-mail de confirmação'}
      </button>
    </form>
  )
}
