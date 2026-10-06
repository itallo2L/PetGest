import type { Backend } from '../types'
import { supabaseAuth } from './auth'
import { supabasePetshop } from './petshop'
import { supabaseProducts } from './products'

/** Backend do V0: Supabase Auth + Postgres com RLS. Importado só no modo `supabase`
 * (o `client.ts` exige as chaves já no import). */
export function createSupabaseBackend(): Backend {
  return { auth: supabaseAuth, products: supabaseProducts, petshop: supabasePetshop }
}
