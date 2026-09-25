import { supabase } from '../../shared/supabaseClient'
import type { Product, ProductInput } from './types'

const COLUMNS = 'id, name, category, price, ean, source, updated_at'
/** O PostgREST do Supabase devolve no máximo 1000 linhas por requisição. */
const PAGE_SIZE = 1000

/** `numeric` pode chegar como string conforme a versão do PostgREST. */
function toProduct(row: Product): Product {
  return { ...row, price: Number(row.price) }
}

/** Todos os produtos da loja logada — o RLS filtra por petshop. */
export async function listProducts(): Promise<Product[]> {
  const all: Product[] = []
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from('products')
      .select(COLUMNS)
      .order('name')
      .order('id')
      .range(from, from + PAGE_SIZE - 1)
    if (error) throw error
    all.push(...(data as Product[]).map(toProduct))
    if (data.length < PAGE_SIZE) return all
  }
}

/** Produto da loja com este código, ou `null` — o RLS limita à loja logada e
 * o índice único (petshop_id, ean) garante no máximo um (T-07 D3). */
export async function findProductByEan(ean: string): Promise<Product | null> {
  const { data, error } = await supabase.from('products').select(COLUMNS).eq('ean', ean).maybeSingle()
  if (error) throw error
  return data ? toProduct(data as Product) : null
}

/** `petshop_id` vem do default da coluna; `source` diz se o código veio da
 * câmera (`barcode`) ou foi digitado/ausente (`manual`) — T-07 D6. */
export async function createProduct(input: ProductInput, source: Product['source'] = 'manual'): Promise<Product> {
  const { data, error } = await supabase
    .from('products')
    .insert({ ...input, source })
    .select(COLUMNS)
    .single()
  if (error) throw error
  return toProduct(data as Product)
}

export async function updateProduct(id: string, input: ProductInput): Promise<Product> {
  const { data, error } = await supabase.from('products').update(input).eq('id', id).select(COLUMNS).single()
  if (error) throw error
  return toProduct(data as Product)
}

export async function deleteProduct(id: string): Promise<void> {
  const { error } = await supabase.from('products').delete().eq('id', id)
  if (error) throw error
}
