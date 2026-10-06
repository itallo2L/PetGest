import { isBackendError } from '../errors'
import type { PetshopBackend, Product, ProductsBackend, ProductSource, Store } from '../types'
import type { ApiClient } from './client'
import type { components } from './schema'

type Schemas = components['schemas']

function toProduct(product: Schemas['ProductResponse']): Product {
  return { ...product, price: Number(product.price), source: product.source as ProductSource }
}

/** Produtos na API do V1 (T-15) — a loja é sempre a do token. */
export function createApiProducts(client: ApiClient): ProductsBackend {
  return {
    async list() {
      return (await client.request<Schemas['ProductResponse'][]>('GET', '/products')).map(toProduct)
    },

    /** Desfechos do scanner: 200 → produto, 404 → não encontrado. */
    async findByEan(ean) {
      try {
        return toProduct(await client.request('GET', `/products/by-ean/${encodeURIComponent(ean)}`))
      } catch (error) {
        if (isBackendError(error) && error.kind === 'not_found') return null
        throw error
      }
    },

    async create(input, source) {
      return toProduct(
        await client.request('POST', '/products', { body: { ...input, source } satisfies Schemas['ProductDraft'] }),
      )
    },

    async update(id, input) {
      return toProduct(
        await client.request('PUT', `/products/${encodeURIComponent(id)}`, {
          body: input satisfies Schemas['ProductUpdate'],
        }),
      )
    },

    async remove(id) {
      await client.request('DELETE', `/products/${encodeURIComponent(id)}`)
    },
  }
}

/** Loja na API do V1 (T-15). */
export function createApiPetshop(client: ApiClient): PetshopBackend {
  return {
    async get() {
      return client.request<Store>('GET', '/petshop')
    },

    /** `id` não vai para a API: a loja é a do token. */
    async update(_id, input) {
      return client.request<Store>('PUT', '/petshop', { body: input satisfies Schemas['PetshopRequest'] })
    },
  }
}
