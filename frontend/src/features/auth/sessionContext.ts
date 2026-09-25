import type { Session } from '@supabase/supabase-js'
import { createContext, useContext } from 'react'

/**
 * - `loading`: verificando a sessão salva (não mostrar login nem shell)
 * - `error`: não foi possível carregar o petshop (rede) — tela com "tentar de novo"
 * - `signed-out`: sem sessão
 * - `no-petshop`: logado, mas o cadastro da loja não foi concluído
 * - `ready`: logado e vinculado a um petshop
 */
export type SessionStatus = 'loading' | 'error' | 'signed-out' | 'no-petshop' | 'ready'

export interface Petshop {
  id: string
  name: string
}

export interface SessionState {
  status: SessionStatus
  session: Session | null
  petshop: Petshop | null
  /** Recarrega o petshop da sessão atual (depois do `signup_petshop`). */
  refreshPetshop: () => Promise<void>
  /** Ligado pela tela de criar conta entre o `signUp` e o `rpc`, para a
   * guarda não mandar para "Concluir cadastro" no meio do envio. */
  setSignupInProgress: (value: boolean) => void
  isSignupInProgress: () => boolean
}

export const SessionContext = createContext<SessionState | null>(null)

export function useSession(): SessionState {
  const value = useContext(SessionContext)
  if (!value) throw new Error('useSession precisa estar dentro de <SessionProvider>')
  return value
}
