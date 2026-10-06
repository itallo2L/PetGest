/** Escolha do backend por variável de build (design D1 da T-16). Separado do
 * `index.ts` para ser testado sem `import.meta.env`. */
export type BackendConfig = { mode: 'supabase' } | { mode: 'api'; apiUrl: string }

export interface BackendEnv {
  VITE_BACKEND?: string
  VITE_API_URL?: string
}

const MODES = ['supabase', 'api'] as const

/** Falha com a variável nomeada em vez de deixar o app tentar requisições sem rumo
 * (mesmo espírito do erro de chaves do Supabase). */
export function resolveBackendConfig(env: BackendEnv): BackendConfig {
  const mode = env.VITE_BACKEND?.trim() || 'supabase'
  if (!(MODES as readonly string[]).includes(mode)) {
    throw new Error(
      `Configuração inválida: VITE_BACKEND="${mode}". Valores aceitos: ${MODES.join(', ')} ` +
        '(veja frontend/.env.example).',
    )
  }
  if (mode === 'supabase') return { mode }

  const apiUrl = env.VITE_API_URL?.trim()
  if (!apiUrl) {
    throw new Error(
      'Configuração da API ausente: VITE_API_URL. Defina o endereço da API (em desenvolvimento, /api) ' +
        'em frontend/.env.local (veja frontend/.env.example).',
    )
  }
  return { mode: 'api', apiUrl: apiUrl.replace(/\/+$/, '') }
}
