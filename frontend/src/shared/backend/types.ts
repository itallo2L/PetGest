import type { BackendError } from './errors'

/** Contrato único entre as telas e o backend (design D2 da T-16). As telas só falam
 * com o backend por aqui; Supabase (V0) e API (V1) implementam igual. */

/** Usuário da sessão — o que as telas usam do login. */
export interface AuthUser {
  id: string
  email: string
}

/** Loja da sessão (barra lateral, guarda de rota). */
export interface Petshop {
  id: string
  name: string
}

/** Dados da loja em Configurações. */
export interface Store {
  id: string
  name: string
  email: string
  phone: string | null
}

export type StoreInput = Omit<Store, 'id'>

export type ProductSource = 'barcode' | 'manual' | 'photo_ai' | 'voice_ai'

/** Produto como as telas usam. `updatedAt` vem do backend; nenhuma tela o lê hoje. */
export interface Product {
  id: string
  name: string
  category: string
  price: number
  ean: string | null
  source: ProductSource
  updatedAt: string
}

/** Campos que o formulário de produto grava. */
export interface ProductInput {
  name: string
  category: string
  price: number
  ean: string | null
}

export interface SignupInput {
  email: string
  password: string
  storeName: string
  storePhone: string | null
}

export interface AuthBackend {
  /** Sessão atual (a salva no navegador, no carregamento); `null` = deslogado. */
  restore(): Promise<AuthUser | null>
  /** Emite o estado atual ao assinar e depois a cada mudança (entrar, sair, sessão
   * revogada, outra aba). */
  subscribe(listener: (user: AuthUser | null) => void): () => void
  signIn(email: string, password: string): Promise<void>
  /** Conta + loja. `storeError` = a conta foi criada, mas a loja não (só no Supabase,
   * onde são duas chamadas) — a tela leva para "Concluir cadastro". */
  signUp(input: SignupInput): Promise<{ storeError?: BackendError }>
  /** Cria a loja de uma conta logada que ainda não tem uma. */
  completeSignup(store: StoreInput): Promise<void>
  /** Loja da sessão, ou `null` se a conta ainda não tem loja. */
  currentPetshop(): Promise<Petshop | null>
  signOut(): Promise<void>
}

export interface ProductsBackend {
  /** Todos os produtos da loja, ordenados por nome. */
  list(): Promise<Product[]>
  /** Produto da loja com o código, ou `null` (desfechos do scanner). */
  findByEan(ean: string): Promise<Product | null>
  create(input: ProductInput, source: 'barcode' | 'manual'): Promise<Product>
  update(id: string, input: ProductInput): Promise<Product>
  remove(id: string): Promise<void>
}

export interface PetshopBackend {
  get(): Promise<Store>
  /** `id` é o que veio de `get()`; quem garante que é a loja da sessão é o backend. */
  update(id: string, input: StoreInput): Promise<Store>
}

/** Links enviados por e-mail (T-22): confirmação e redefinição de senha. Só a API do V1
 * tem; no Supabase (V0) é `undefined` e as telas escondem o que depende disso. */
export interface AccountBackend {
  /** Sempre resolve: a API não revela se o e-mail tem conta. */
  requestPasswordReset(email: string): Promise<void>
  /** `invalid_link` = link inválido, expirado ou já usado; `weak_password` = senha curta. */
  resetPassword(userId: string, code: string, password: string): Promise<void>
  /** `invalid_link` = link inválido ou expirado. Confirmar de novo é inofensivo. */
  confirmEmail(userId: string, code: string): Promise<void>
  /** Sempre resolve, como `requestPasswordReset`. */
  resendConfirmation(email: string): Promise<void>
}

export interface Backend {
  auth: AuthBackend
  products: ProductsBackend
  petshop: PetshopBackend
  account?: AccountBackend
}
