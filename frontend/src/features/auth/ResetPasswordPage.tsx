import { useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router'
import { getBackend, isBackendError } from '../../shared/backend'
import { focusField } from '../../shared/ui/touch'
import { AuthLayout } from './AuthLayout'
import { MIN_PASSWORD_LENGTH, toFormMessage, type FormMessage } from './authErrors'
import { FormError } from './FormError'
import { PasswordField } from './PasswordField'

/** Tela do link de redefinição de senha (`/redefinir-senha?user=…&code=…`, T-22). Fica fora
 * das guardas de rota: o link pode ser aberto logado ou não. */
export function ResetPasswordPage() {
  const [params] = useSearchParams()
  const userId = params.get('user')
  const code = params.get('code')
  const { auth, account } = getBackend()
  const [password, setPassword] = useState('')
  const [error, setError] = useState<FormMessage | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [outcome, setOutcome] = useState<'form' | 'done' | 'invalid'>(userId && code && account ? 'form' : 'invalid')

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!account || !userId || !code) return
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError({ text: `A senha precisa ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.` })
      focusField('resetPassword')
      return
    }

    setError(null)
    setSubmitting(true)
    try {
      await account.resetPassword(userId, code, password)
      // A API encerrou todas as sessões da conta; a deste navegador também sai.
      await auth.signOut()
      setOutcome('done')
    } catch (resetError) {
      if (isBackendError(resetError) && resetError.kind === 'invalid_link') {
        setOutcome('invalid')
      } else {
        setError(toFormMessage(resetError))
      }
    } finally {
      setSubmitting(false)
    }
  }

  if (outcome === 'done') {
    return (
      <AuthLayout title="Senha alterada">
        <p className="auth-message" role="status">
          Pronto! Sua senha foi alterada e as sessões abertas em outros aparelhos foram encerradas.
        </p>
        <Link to="/entrar" className="btn btn--primary auth-submit">
          Entrar com a senha nova
        </Link>
      </AuthLayout>
    )
  }

  if (outcome === 'invalid') {
    return (
      <AuthLayout title="Link inválido">
        <p className="auth-message" role="alert">
          Este link de redefinição é inválido, expirou ou já foi usado. Os links valem por 1 hora e só uma vez.
        </p>
        {account && (
          <Link to="/esqueci-senha" className="btn btn--primary auth-submit">
            Pedir um link novo
          </Link>
        )}
        <p className="auth-hint">
          <Link to="/entrar">Voltar para entrar</Link>
        </p>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout title="Criar senha nova" subtitle="Escolha a senha que você vai usar para entrar">
      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        <PasswordField
          id="resetPassword"
          label="Senha nova"
          value={password}
          onChange={setPassword}
          autoComplete="new-password"
          placeholder={`Mínimo de ${MIN_PASSWORD_LENGTH} caracteres`}
        />

        <FormError message={error} />

        <button type="submit" className="btn btn--primary auth-submit" disabled={submitting}>
          {submitting ? 'Salvando…' : 'Salvar senha nova'}
        </button>
      </form>
    </AuthLayout>
  )
}
