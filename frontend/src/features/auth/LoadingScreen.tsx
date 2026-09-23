import { useSession } from './sessionContext'
import { AuthLayout } from './AuthLayout'

/** Enquanto a sessão salva é verificada — ou quando a loja não carregou. */
export function LoadingScreen() {
  const { status, refreshPetshop } = useSession()

  if (status === 'error') {
    return (
      <AuthLayout
        title="Sem conexão"
        subtitle="Não foi possível carregar os dados da sua loja. Verifique a internet e tente de novo."
      >
        <button type="button" className="btn btn--primary auth-submit" onClick={() => void refreshPetshop()}>
          Tentar de novo
        </button>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout>
      <p className="auth-card__subtitle" role="status">
        Carregando…
      </p>
    </AuthLayout>
  )
}
