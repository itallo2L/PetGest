import { createContext, useContext } from 'react'
import type { AuthUser, Petshop } from '../../shared/backend'

export type { Petshop } from '../../shared/backend'

/**
 * - `loading`: verificando a sessão salva (não mostrar login nem shell)
 * - `error`: não foi possível carregar o petshop (rede) — tela com "tentar de novo"
 * - `signed-out`: sem sessão
 * - `no-petshop`: logado, mas o cadastro da loja não foi concluído
 * - `ready`: logado e vinculado a um petshop
 */
export type SessionStatus = 'loading' | 'error' | 'signed-out' | 'no-petshop' | 'ready'

export interface SessionState {
  status: SessionStatus
  user: AuthUser | null
  petshop: Petshop | null
  /** Recarrega a sessão e o petshop atuais (depois de criar a loja ou salvar seus dados). */
  refreshPetshop: () => Promise<void>
  /** Ligado pela tela de criar conta durante o envio, para a guarda não mandar para
   * "Concluir cadastro" no meio do cadastro (no Supabase, entre o `signUp` e o `rpc`). */
  setSignupInProgress: (value: boolean) => void
  isSignupInProgress: () => boolean
}

export const SessionContext = createContext<SessionState | null>(null)

export function useSession(): SessionState {
  const value = useContext(SessionContext)
  if (!value) throw new Error('useSession precisa estar dentro de <SessionProvider>')
  return value
}
