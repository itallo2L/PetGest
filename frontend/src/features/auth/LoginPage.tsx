import { useState, type FormEvent } from 'react'
import { Link, useLocation } from 'react-router'
import { getBackend, isBackendError } from '../../shared/backend'
import { focusField, isTouchScreen } from '../../shared/ui/touch'
import { AuthLayout } from './AuthLayout'
import { EMAIL_RE, toFormMessage, type FormMessage } from './authErrors'
import { FormError } from './FormError'
import type { FromState } from './guards'
import { PasswordField } from './PasswordField'
import { ResendConfirmation } from './ResendConfirmation'

export function LoginPage() {
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<FormMessage | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [unconfirmed, setUnconfirmed] = useState(false)
  const hasAccountLinks = getBackend().account !== undefined

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const trimmed = email.trim()
    if (!EMAIL_RE.test(trimmed)) {
      setError({ text: 'Informe um e-mail válido.' })
      focusField('loginEmail')
      return
    }
    if (!password) {
      setError({ text: 'Informe sua senha.' })
      focusField('loginPassword')
      return
    }

    setError(null)
    setUnconfirmed(false)
    setSubmitting(true)
    try {
      await getBackend().auth.signIn(trimmed, password)
    } catch (signInError) {
      setError(toFormMessage(signInError))
      setUnconfirmed(isBackendError(signInError) && signInError.kind === 'email_not_confirmed')
      setSubmitting(false)
    }
    // Sucesso: a guarda de rota leva para a página de origem assim que a
    // sessão e o petshop carregarem; o botão segue em "Entrando…" até lá.
  }

  return (
    <AuthLayout title="Entrar" subtitle="Acesse o painel do seu petshop">
      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        <div className="field">
          <label className="field__label" htmlFor="loginEmail">
            E-mail
          </label>
          <input
            className="input"
            type="email"
            id="loginEmail"
            inputMode="email"
            autoComplete="username"
            placeholder="voce@petshop.com.br"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoFocus={!isTouchScreen()}
          />
        </div>

        <PasswordField
          id="loginPassword"
          value={password}
          onChange={setPassword}
          autoComplete="current-password"
          placeholder="Sua senha"
        />

        {hasAccountLinks && (
          <p className="auth-forgot">
            <Link to="/esqueci-senha">Esqueci minha senha</Link>
          </p>
        )}

        <FormError message={error} />

        <button type="submit" className="btn btn--primary auth-submit" disabled={submitting}>
          {submitting ? 'Entrando…' : 'Entrar'}
        </button>
      </form>

      {unconfirmed && <ResendConfirmation key={email.trim()} email={email.trim()} />}

      <p className="auth-hint">
        Ainda não tem conta?{' '}
        <Link to="/criar-conta" state={location.state as FromState | null}>
          Criar conta
        </Link>
      </p>
    </AuthLayout>
  )
}
