import { describe, expect, it } from 'vitest'
import { resolveBackendConfig } from './config'

// Requisito "Backend escolhido por configuração" da spec frontend-backend.
describe('resolveBackendConfig', () => {
  it('usa o Supabase quando VITE_BACKEND não está definida', () => {
    expect(resolveBackendConfig({})).toEqual({ mode: 'supabase' })
    expect(resolveBackendConfig({ VITE_BACKEND: '' })).toEqual({ mode: 'supabase' })
  })

  it('modo supabase não exige VITE_API_URL', () => {
    expect(resolveBackendConfig({ VITE_BACKEND: 'supabase' })).toEqual({ mode: 'supabase' })
  })

  it('modo api usa VITE_API_URL sem barra final', () => {
    expect(resolveBackendConfig({ VITE_BACKEND: 'api', VITE_API_URL: 'https://api.petgest.test/' })).toEqual({
      mode: 'api',
      apiUrl: 'https://api.petgest.test',
    })
  })

  it('valor inválido nomeia VITE_BACKEND e os valores aceitos', () => {
    expect(() => resolveBackendConfig({ VITE_BACKEND: 'firebase' })).toThrow(/VITE_BACKEND="firebase".*supabase, api/)
  })

  it('modo api sem endereço nomeia VITE_API_URL', () => {
    expect(() => resolveBackendConfig({ VITE_BACKEND: 'api' })).toThrow(/VITE_API_URL/)
    expect(() => resolveBackendConfig({ VITE_BACKEND: 'api', VITE_API_URL: '  ' })).toThrow(/VITE_API_URL/)
  })
})
