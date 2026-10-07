import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { getBackend } from '../../shared/backend'
import { focusField } from '../../shared/ui/touch'
import { AuthLayout } from './AuthLayout'
import { EMAIL_RE, toFormMessage, type FormMessage } from './authErrors'
import { FormError } from './FormError'

/** Pedido do link de redefinição de senha (T-22). A resposta é a mesma exista ou não a
 * conta, para a tela não revelar quem tem cadastro. */
export function ForgotPasswordPage() {
  const account = getBackend().account
  const [email, setEmail] = useState('')
  const [error, setError] = useState<FormMessage | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [sentTo, setSentTo] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!account) return
    const trimmed = email.trim()
    if (!EMAIL_RE.test(trimmed)) {
      setError({ text: 'Informe um e-mail válido.' })
      focusField('forgotEmail')
      return
    }

    setError(null)
    setSubmitting(true)
    try {
      await account.requestPasswordReset(trimmed)
      setSentTo(trimmed)
    } catch (requestError) {
      setError(toFormMessage(requestError))
    } finally {
      setSubmitting(false)
    }
  }

  if (!account) {
    return (
      <AuthLayout title="Esqueci minha senha">
        <p className="auth-message">A recuperação de senha ainda não está disponível nesta versão do PetGest.</p>
        <p className="auth-hint">
          <Link to="/entrar">Voltar para entrar</Link>
        </p>
      </AuthLayout>
    )
  }

  if (sentTo) {
    return (
      <AuthLayout title="Confira seu e-mail">
        <p className="auth-message" role="status">
          Se houver uma conta com <strong>{sentTo}</strong>, enviamos um link para criar uma senha nova. O link vale
          por 1 hora. Se não chegar em alguns minutos, confira a caixa de spam.
        </p>
        <p className="auth-hint">
          <Link to="/entrar">Voltar para entrar</Link>
        </p>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout title="Esqueci minha senha" subtitle="Enviamos um link para você criar uma senha nova">
      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        <div className="field">
          <label className="field__label" htmlFor="forgotEmail">
            E-mail da conta
          </label>
          <input
            className="input"
            type="email"
            id="forgotEmail"
            inputMode="email"
            autoComplete="username"
            placeholder="voce@petshop.com.br"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </div>

        <FormError message={error} />

        <button type="submit" className="btn btn--primary auth-submit" disabled={submitting}>
          {submitting ? 'Enviando…' : 'Enviar link'}
        </button>
      </form>

      <p className="auth-hint">
        Lembrou a senha? <Link to="/entrar">Entrar</Link>
      </p>
    </AuthLayout>
  )
}
