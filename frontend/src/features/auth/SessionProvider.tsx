import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { getBackend, type AuthUser } from '../../shared/backend'
import { SessionContext, type Petshop, type SessionState, type SessionStatus } from './sessionContext'

/** Fonte única da sessão do app: usuário do backend + petshop vinculado. */
export function SessionProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<SessionStatus>('loading')
  const [user, setUser] = useState<AuthUser | null>(null)
  const [petshop, setPetshop] = useState<Petshop | null>(null)
  const requestId = useRef(0)
  const latestLoad = useRef<Promise<void>>(Promise.resolve())
  const signupInProgress = useRef(false)

  const loadPetshop = useCallback((current: AuthUser | null): Promise<void> => {
    const id = ++requestId.current
    const load = async () => {
      if (!current) {
        setPetshop(null)
        setStatus('signed-out')
        return
      }
      let data: Petshop | null
      try {
        data = await getBackend().auth.currentPetshop()
      } catch (error) {
        if (id !== requestId.current) return latestLoad.current
        console.error('Falha ao carregar o petshop', error)
        setStatus('error')
        return
      }
      // Uma carga mais nova começou: espera por ela em vez de terminar sem
      // estado — quem aguarda refreshPetshop() precisa do status final.
      if (id !== requestId.current) return latestLoad.current
      setPetshop(data)
      setStatus(data ? 'ready' : 'no-petshop')
    }
    const promise = load()
    latestLoad.current = promise
    return promise
  }, [])

  // O backend emite o estado atual ao assinar e depois a cada mudança (entrar, sair,
  // sessão revogada, outra aba).
  useEffect(
    () =>
      getBackend().auth.subscribe((next) => {
        setUser(next)
        void loadPetshop(next)
      }),
    [loadPetshop],
  )

  // Pergunta a sessão ao backend em vez de usar o estado: logo após o cadastro o aviso
  // de sessão nova pode ainda não ter chegado ao listener acima.
  const refreshPetshop = useCallback(async () => {
    const next = await getBackend().auth.restore()
    setUser(next)
    await loadPetshop(next)
  }, [loadPetshop])
  const setSignupInProgress = useCallback((value: boolean) => {
    signupInProgress.current = value
  }, [])
  const isSignupInProgress = useCallback(() => signupInProgress.current, [])

  const value = useMemo<SessionState>(
    () => ({ status, user, petshop, refreshPetshop, setSignupInProgress, isSignupInProgress }),
    [status, user, petshop, refreshPetshop, setSignupInProgress, isSignupInProgress],
  )

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}
