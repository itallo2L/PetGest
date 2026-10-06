import { resolveBackendConfig } from './config'
import type { Backend } from './types'

export type * from './types'
export { BackendError, isBackendError } from './errors'

let current: Backend | null = null

/** Carrega o backend escolhido por `VITE_BACKEND` antes do primeiro render (design D1
 * da T-16). O `if` compara `import.meta.env.VITE_BACKEND` direto porque o build troca
 * a variável por uma constante e elimina o ramo morto: o pacote do modo `api` não leva
 * o cliente do Supabase, e o do modo `supabase` não leva o da API. */
export async function loadBackend(): Promise<Backend> {
  const config = resolveBackendConfig(import.meta.env)
  // A condição precisa ser só a constante de build — com mais um termo, o outro ramo
  // continua alcançável para o bundler e o pacote dele é gerado.
  if (import.meta.env.VITE_BACKEND === 'api') {
    if (config.mode !== 'api') throw new Error('VITE_BACKEND=api sem configuração de API')
    const { createApiBackend } = await import('./api')
    current = createApiBackend(config.apiUrl)
  } else {
    const { createSupabaseBackend } = await import('./supabase')
    current = createSupabaseBackend()
  }
  return current
}

/** Backend em uso — único ponto de acesso das telas. */
export function getBackend(): Backend {
  if (!current) throw new Error('getBackend() chamado antes de loadBackend()')
  return current
}
