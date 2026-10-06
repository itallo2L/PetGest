import type { Backend } from '../types'
import { createApiAuth } from './auth'
import { createApiPetshop, createApiProducts } from './catalog'
import { ApiClient, type ApiClientDeps } from './client'

/** Backend do V1: a API própria (T-14/T-15). Importado só no modo `api`. */
export function createApiBackend(apiUrl: string, deps?: ApiClientDeps): Backend {
  const client = new ApiClient(apiUrl, deps)
  return {
    auth: createApiAuth(client),
    products: createApiProducts(client),
    petshop: createApiPetshop(client),
  }
}
