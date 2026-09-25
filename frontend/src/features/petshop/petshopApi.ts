import { supabase } from '../../shared/supabaseClient'

/** Linha de `public.petshops` (supabase/schema.sql) usada em Configurações. */
export interface Store {
  id: string
  name: string
  email: string
  phone: string | null
}

export type StoreInput = Omit<Store, 'id'>

const COLUMNS = 'id, name, email, phone'

/** Loja do usuário logado — sem filtro: o RLS só devolve a própria. */
export async function getStore(): Promise<Store> {
  const { data, error } = await supabase.from('petshops').select(COLUMNS).single()
  if (error) throw error
  return data as Store
}

/** O `id` só aponta a linha (veio de getStore); quem garante que é a loja do
 * usuário é o RLS "dono atualiza dados da loja" (T-08 D1). */
export async function updateStore(id: string, input: StoreInput): Promise<Store> {
  const { data, error } = await supabase.from('petshops').update(input).eq('id', id).select(COLUMNS).single()
  if (error) throw error
  return data as Store
}
