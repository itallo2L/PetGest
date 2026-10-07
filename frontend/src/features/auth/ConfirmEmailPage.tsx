import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { getBackend, isBackendError } from '../../shared/backend'
import { AuthLayout } from './AuthLayout'
import { toFormMessage } from './authErrors'
import { ResendConfirmation } from './ResendConfirmation'
import { useSession } from './sessionContext'

type Outcome = { status: 'confirming' } | { status: 'done' } | { status: 'invalid' } | { status: 'error'; message: string }

/** Tela do link de confirmação de e-mail (`/confirmar-email?user=…&code=…`, T-22). Confirma
 * sozinha ao abrir; fica fora das guardas de rota, como a de redefinir senha. */
export function ConfirmEmailPage() {
  const [params] = useSearchParams()
  const userId = params.get('user')
  const code = params.get('code')
  const account = getBackend().account
  const { status } = useSession()
  const [attempt, setAttempt] = useState(0)
  const [outcome, setOutcome] = useState<Outcome>(
    userId && code && account ? { status: 'confirming' } : { status: 'invalid' },
  )

  // Confirmar duas vezes é inofensivo (a API responde 204), então o efeito duplo do
  // StrictMode em desenvolvimento não é problema.
  useEffect(() => {
    if (!account || !userId || !code) return
    let active = true
    account.confirmEmail(userId, code).then(
      () => active && setOutcome({ status: 'done' }),
      (error: unknown) => {
        if (!active) return
        setOutcome(
          isBackendError(error) && error.kind === 'invalid_link'
            ? { status: 'invalid' }
            : { status: 'error', message: toFormMessage(error).text },
        )
      },
    )
    return () => {
      active = false
    }
  }, [account, userId, code, attempt])

  if (outcome.status === 'confirming') {
    return (
      <AuthLayout title="Confirmando seu e-mail…">
        <p className="auth-message" role="status">
          Só um instante.
        </p>
      </AuthLayout>
    )
  }

  if (outcome.status === 'done') {
    const signedIn = status === 'ready' || status === 'no-petshop'
    return (
      <AuthLayout title="E-mail confirmado">
        <p className="auth-message" role="status">
          Tudo certo: o e-mail da sua conta está confirmado.
        </p>
        <Link to={signedIn ? '/produtos' : '/entrar'} className="btn btn--primary auth-submit">
          {signedIn ? 'Ir para o PetGest' : 'Entrar'}
        </Link>
      </AuthLayout>
    )
  }

  if (outcome.status === 'error') {
    return (
      <AuthLayout title="Não foi possível confirmar">
        <p className="auth-message" role="alert">
          {outcome.message}
        </p>
        <button
          type="button"
          className="btn btn--primary auth-submit"
          onClick={() => {
            setOutcome({ status: 'confirming' })
            setAttempt((n) => n + 1)
          }}
        >
          Tentar de novo
        </button>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout title="Link inválido">
      <p className="auth-message" role="alert">
        Este link de confirmação é inválido ou expirou (os links valem por 24 horas). Peça um novo abaixo.
      </p>
      {account && <ResendConfirmation />}
      <p className="auth-hint">
        <Link to="/entrar">Voltar para entrar</Link>
      </p>
    </AuthLayout>
  )
}
