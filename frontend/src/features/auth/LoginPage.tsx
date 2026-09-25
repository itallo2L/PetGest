import { useState, type FormEvent } from 'react'
import { Link, useLocation } from 'react-router'
import { supabase } from '../../shared/supabaseClient'
import { AuthLayout } from './AuthLayout'
import { EMAIL_RE, toFormMessage, type FormMessage } from './authErrors'
import { FormError } from './FormError'
import type { FromState } from './guards'
import { PasswordField } from './PasswordField'

export function LoginPage() {
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<FormMessage | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const trimmed = email.trim()
    if (!EMAIL_RE.test(trimmed)) {
      setError({ text: 'Informe um e-mail válido.' })
      document.getElementById('loginEmail')?.focus()
      return
    }
    if (!password) {
      setError({ text: 'Informe sua senha.' })
      document.getElementById('loginPassword')?.focus()
      return
    }

    setError(null)
    setSubmitting(true)
    const { error: signInError } = await supabase.auth.signInWithPassword({ email: trimmed, password })
    if (signInError) {
      setError(toFormMessage(signInError))
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
            autoFocus
          />
        </div>

        <PasswordField
          id="loginPassword"
          value={password}
          onChange={setPassword}
          autoComplete="current-password"
          placeholder="Sua senha"
        />

        <FormError message={error} />

        <button type="submit" className="btn btn--primary auth-submit" disabled={submitting}>
          {submitting ? 'Entrando…' : 'Entrar'}
        </button>
      </form>

      <p className="auth-hint">
        Ainda não tem conta?{' '}
        <Link to="/criar-conta" state={location.state as FromState | null}>
          Criar conta
        </Link>
      </p>
    </AuthLayout>
  )
}
