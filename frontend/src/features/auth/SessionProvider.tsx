import type { Session } from '@supabase/supabase-js'
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { supabase } from '../../shared/supabaseClient'
import { SessionContext, type Petshop, type SessionState, type SessionStatus } from './sessionContext'

/** Fonte única da sessão do app: sessão do Supabase Auth + petshop vinculado. */
export function SessionProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<SessionStatus>('loading')
  const [session, setSession] = useState<Session | null>(null)
  const [petshop, setPetshop] = useState<Petshop | null>(null)
  const sessionRef = useRef<Session | null>(null)
  const requestId = useRef(0)
  const latestLoad = useRef<Promise<void>>(Promise.resolve())
  const signupInProgress = useRef(false)

  const loadPetshop = useCallback((current: Session | null): Promise<void> => {
    const id = ++requestId.current
    const load = async () => {
      if (!current) {
        setPetshop(null)
        setStatus('signed-out')
        return
      }
      // Sem filtro por petshop_id: o RLS só devolve a loja do usuário logado.
      const { data, error } = await supabase.from('petshops').select('id, name').maybeSingle()
      // Uma carga mais nova começou: espera por ela em vez de terminar sem
      // estado — quem aguarda refreshPetshop() precisa do status final.
      if (id !== requestId.current) return latestLoad.current
      if (error) {
        console.error('Falha ao carregar o petshop', error)
        setStatus('error')
        return
      }
      setPetshop(data)
      setStatus(data ? 'ready' : 'no-petshop')
    }
    const promise = load()
    latestLoad.current = promise
    return promise
  }, [])

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event, next) => {
      sessionRef.current = next
      setSession(next)
      if (event === 'TOKEN_REFRESHED') return
      // Chamar o Supabase dentro deste callback pode travar o client
      // (aviso da documentação do supabase-js) — agenda para depois.
      setTimeout(() => void loadPetshop(next), 0)
    })
    return () => data.subscription.unsubscribe()
  }, [loadPetshop])

  // Pergunta a sessão ao client em vez de usar sessionRef: logo após o
  // signUp o evento SIGNED_IN pode ainda não ter chegado ao callback acima.
  const refreshPetshop = useCallback(async () => {
    const { data } = await supabase.auth.getSession()
    sessionRef.current = data.session
    setSession(data.session)
    await loadPetshop(data.session)
  }, [loadPetshop])
  const setSignupInProgress = useCallback((value: boolean) => {
    signupInProgress.current = value
  }, [])
  const isSignupInProgress = useCallback(() => signupInProgress.current, [])

  const value = useMemo<SessionState>(
    () => ({ status, session, petshop, refreshPetshop, setSignupInProgress, isSignupInProgress }),
    [status, session, petshop, refreshPetshop, setSignupInProgress, isSignupInProgress],
  )

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}
