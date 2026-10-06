import type { Product, ProductInput, ProductsBackend } from '../types'
import { supabase } from './client'
import { toBackendError } from './errors'

const COLUMNS = 'id, name, category, price, ean, source, updated_at'
/** O PostgREST do Supabase devolve no máximo 1000 linhas por requisição. */
const PAGE_SIZE = 1000

interface ProductRow extends Omit<Product, 'updatedAt' | 'price'> {
  price: number | string
  updated_at: string
}

/** `numeric` pode chegar como string conforme a versão do PostgREST. */
function toProduct({ updated_at, price, ...row }: ProductRow): Product {
  return { ...row, price: Number(price), updatedAt: updated_at }
}

/** Produtos no Supabase (código do V0, T-06/T-07) — o RLS filtra por petshop. */
export const supabaseProducts: ProductsBackend = {
  async list() {
    const all: Product[] = []
    for (let from = 0; ; from += PAGE_SIZE) {
      const { data, error } = await supabase
        .from('products')
        .select(COLUMNS)
        .order('name')
        .order('id')
        .range(from, from + PAGE_SIZE - 1)
      if (error) throw toBackendError(error)
      all.push(...(data as ProductRow[]).map(toProduct))
      if (data.length < PAGE_SIZE) return all
    }
  },

  /** O RLS limita à loja logada e o índice único (petshop_id, ean) garante no máximo
   * um (T-07 D3). */
  async findByEan(ean) {
    const { data, error } = await supabase.from('products').select(COLUMNS).eq('ean', ean).maybeSingle()
    if (error) throw toBackendError(error)
    return data ? toProduct(data as ProductRow) : null
  },

  /** `petshop_id` vem do default da coluna; `source` diz se o código veio da câmera
   * (`barcode`) ou foi digitado/ausente (`manual`) — T-07 D6. */
  async create(input: ProductInput, source) {
    const { data, error } = await supabase
      .from('products')
      .insert({ ...input, source })
      .select(COLUMNS)
      .single()
    if (error) throw toBackendError(error)
    return toProduct(data as ProductRow)
  },

  async update(id, input) {
    const { data, error } = await supabase.from('products').update(input).eq('id', id).select(COLUMNS).single()
    if (error) throw toBackendError(error)
    return toProduct(data as ProductRow)
  },

  async remove(id) {
    const { error } = await supabase.from('products').delete().eq('id', id)
    if (error) throw toBackendError(error)
  },
}
