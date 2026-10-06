import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

/** Falha no primeiro import em vez de deixar o `createClient` gerar erros de
 * rede sem relação aparente com a causa (difícil de depurar no celular). */
const missing = [
  !supabaseUrl && 'VITE_SUPABASE_URL',
  !supabaseAnonKey && 'VITE_SUPABASE_ANON_KEY',
].filter(Boolean)

if (missing.length > 0) {
  throw new Error(
    `Configuração do Supabase ausente: ${missing.join(', ')}. ` +
      'Defina em frontend/.env.local (veja frontend/.env.example).',
  )
}

/** Único client Supabase do app — sempre importar daqui. Só a chave pública:
 * quem protege os dados é o RLS, nunca uma chave `service_role`/secret. */
export const supabase = createClient(supabaseUrl, supabaseAnonKey)
