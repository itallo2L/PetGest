import type { PetshopBackend, Store } from '../types'
import { supabase } from './client'
import { toBackendError } from './errors'

const COLUMNS = 'id, name, email, phone'

/** Loja no Supabase (código do V0, T-08). */
export const supabasePetshop: PetshopBackend = {
  /** Sem filtro: o RLS só devolve a própria loja. */
  async get() {
    const { data, error } = await supabase.from('petshops').select(COLUMNS).single()
    if (error) throw toBackendError(error)
    return data as Store
  },

  /** O `id` só aponta a linha (veio de get()); quem garante que é a loja do usuário é
   * o RLS "dono atualiza dados da loja" (T-08 D1). */
  async update(id, input) {
    const { data, error } = await supabase.from('petshops').update(input).eq('id', id).select(COLUMNS).single()
    if (error) throw toBackendError(error)
    return data as Store
  },
}
