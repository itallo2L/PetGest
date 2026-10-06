import type { Session } from '@supabase/supabase-js'
import type { AuthBackend, AuthUser, StoreInput } from '../types'
import { supabase } from './client'
import { toBackendError } from './errors'

function toUser(session: Session | null): AuthUser | null {
  return session ? { id: session.user.id, email: session.user.email ?? '' } : null
}

/** Cadastro da loja via função SQL `signup_petshop` (PLANOMVP.md §3.1). */
async function createStore(store: StoreInput) {
  const { error } = await supabase.rpc('signup_petshop', {
    petshop_name: store.name,
    petshop_email: store.email,
    petshop_phone: store.phone,
  })
  // 23505 = a loja já existe (envio repetido): segue como sucesso.
  return error && error.code !== '23505' ? toBackendError(error) : undefined
}

/** Sessão no Supabase Auth (código do V0, T-05). */
export const supabaseAuth: AuthBackend = {
  async restore() {
    const { data } = await supabase.auth.getSession()
    return toUser(data.session)
  },

  /** `onAuthStateChange` já emite o estado atual (INITIAL_SESSION) ao assinar. */
  subscribe(listener) {
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'TOKEN_REFRESHED') return
      // Chamar o Supabase dentro deste callback pode travar o client (aviso da
      // documentação do supabase-js) — o listener roda depois.
      setTimeout(() => listener(toUser(session)), 0)
    })
    return () => data.subscription.unsubscribe()
  },

  async signIn(email, password) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw toBackendError(error)
  },

  /** Duas chamadas (`signUp` e `signup_petshop`): se só a segunda falhar, a conta
   * existe sem loja e a tela leva para "Concluir cadastro". */
  async signUp({ email, password, storeName, storePhone }) {
    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error || !data.session) throw toBackendError(error ?? new Error('signUp sem sessão'))
    const storeError = await createStore({ name: storeName, email, phone: storePhone })
    return storeError ? { storeError } : {}
  },

  async completeSignup(store) {
    const storeError = await createStore(store)
    if (storeError) throw storeError
  },

  /** Sem filtro por petshop_id: o RLS só devolve a loja do usuário logado. */
  async currentPetshop() {
    const { data, error } = await supabase.from('petshops').select('id, name').maybeSingle()
    if (error) throw toBackendError(error)
    return data
  },

  async signOut() {
    await supabase.auth.signOut()
  },
}
