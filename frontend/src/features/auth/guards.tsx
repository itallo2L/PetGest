import { Navigate, Outlet, useLocation } from 'react-router'
import { LoadingScreen } from './LoadingScreen'
import { useSession } from './sessionContext'

/** Estado de navegação usado para voltar à página pedida antes do login. */
export interface FromState {
  from?: string
}

/** Páginas do app: exige sessão com petshop. */
export function RequireReady() {
  const { status } = useSession()
  const location = useLocation()

  if (status === 'loading' || status === 'error') return <LoadingScreen />
  if (status === 'signed-out') {
    const from = location.pathname + location.search
    return <Navigate to="/entrar" replace state={{ from } satisfies FromState} />
  }
  if (status === 'no-petshop') return <Navigate to="/concluir-cadastro" replace />
  return <Outlet />
}

/** Entrar / Criar conta: só para quem ainda não está dentro do app. */
export function PublicOnly() {
  const { status, isSignupInProgress } = useSession()
  const location = useLocation()
  const from = (location.state as FromState | null)?.from

  if (status === 'loading' || status === 'error') return <LoadingScreen />
  if (status === 'ready') return <Navigate to={from ?? '/produtos'} replace />
  if (status === 'no-petshop' && !isSignupInProgress()) {
    return <Navigate to="/concluir-cadastro" replace />
  }
  return <Outlet />
}

/** Concluir cadastro: logado, mas sem petshop. */
export function RequireNoPetshop() {
  const { status } = useSession()

  if (status === 'loading' || status === 'error') return <LoadingScreen />
  if (status === 'signed-out') return <Navigate to="/entrar" replace />
  if (status === 'ready') return <Navigate to="/produtos" replace />
  return <Outlet />
}
