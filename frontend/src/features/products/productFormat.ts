import type { Product } from './types'

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

export function formatPrice(value: number): string {
  return currency.format(value)
}

/** Minúsculas e sem acento — "ração" e "racao" encontram o mesmo produto. */
export function normalize(value: string): string {
  return value.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

/** Só os dígitos do código de barras (como normalizeBarcode do protótipo). */
export function normalizeBarcode(value: string): string {
  return value.replace(/\D/g, '')
}

/** Mesma regra do check da coluna `ean`: 8 a 14 dígitos. */
export function isValidBarcode(digits: string): boolean {
  return /^\d{8,14}$/.test(digits)
}

const MAX_PRICE = 99_999_999.99 // numeric(10,2)

/** "12,5", "12.50", "R$ 1.234,56" → número; null se inválido. */
export function parsePrice(raw: string): number | null {
  let text = raw.replace(/R\$|\s/g, '')
  if (!text) return null
  if (text.includes(',')) text = text.replace(/\./g, '').replace(',', '.') // vírgula decimal
  if (!/^\d+(\.\d{1,2})?$/.test(text)) return null
  const value = Number(text)
  return value <= MAX_PRICE ? value : null
}

/** Preço no campo do formulário: "12,5" → "12,50". */
export function priceToInput(value: number): string {
  return value.toFixed(2).replace('.', ',')
}

export type SortKey = 'name' | 'category'

export interface ProductFilters {
  search: string
  category: string // 'all' ou uma categoria
  sort: SortKey
}

export const FILTER_DEFAULTS: ProductFilters = { search: '', category: 'all', sort: 'name' }

/** Busca, categoria e ordenação — mesma regra de script.js §5. */
export function filterProducts(products: Product[], filters: ProductFilters): Product[] {
  const term = normalize(filters.search.trim())
  const list = products.filter((p) => {
    if (filters.category !== 'all' && p.category !== filters.category) return false
    if (term && !normalize(p.name).includes(term) && !normalize(p.ean ?? '').includes(term)) return false
    return true
  })
  const byName = (a: Product, b: Product) => a.name.localeCompare(b.name, 'pt-BR')
  return list.sort(
    filters.sort === 'category' ? (a, b) => a.category.localeCompare(b.category, 'pt-BR') || byName(a, b) : byName,
  )
}

/** Quantos filtros diferem do padrão (badge do botão "Filtro"). Busca não conta. */
export function activeFilterCount(filters: ProductFilters): number {
  return (['category', 'sort'] as const).filter((key) => filters[key] !== FILTER_DEFAULTS[key]).length
}
