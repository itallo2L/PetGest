/** Linha de `public.products` (supabase/schema.sql) usada pela tela.
 * Escrito à mão — ver design D2 da change T-06. `petshop_id` fica de fora:
 * o app nunca lê nem envia (default da coluna + RLS). */
export interface Product {
  id: string
  name: string
  category: string
  price: number
  ean: string | null
  source: 'barcode' | 'manual'
  updated_at: string
}

/** Campos que o formulário grava. */
export interface ProductInput {
  name: string
  category: string
  price: number
  ean: string | null
}
