import { useEffect, useMemo, useState } from 'react'
import { toFormMessage } from '../auth/authErrors'
import { EmptyState } from '../../shared/ui/EmptyState'
import { Icon } from '../../shared/ui/Icon'
import { ScannerModal } from '../scanner/ScannerModal'
import { CATEGORIES } from './categories'
import { ProductFormModal } from './ProductFormModal'
import { ProductList } from './ProductList'
import {
  activeFilterCount,
  FILTER_DEFAULTS,
  filterProducts,
  formatPrice,
  type ProductFilters,
  type SortKey,
} from './productFormat'
import { findProductByEan, listProducts } from './productsApi'
import type { Product } from './types'
import './products.css'

type LoadState = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; products: Product[] }

/** Formulário aberto: `null` fechado, cadastro (com código vindo do leitor, se
 * houver) ou o produto em edição. */
type NewTarget = { mode: 'new'; ean?: string; scanned?: boolean }
type FormTarget = null | NewTarget | Product

function isNewTarget(target: FormTarget): target is NewTarget {
  return target !== null && 'mode' in target
}

export function ProductsPage() {
  const [load, setLoad] = useState<LoadState>({ status: 'loading' })
  const [filters, setFilters] = useState<ProductFilters>(FILTER_DEFAULTS)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [form, setForm] = useState<FormTarget>(null)
  const [scanning, setScanning] = useState(false)

  const [attempt, setAttempt] = useState(0)

  // Recarrega a cada tentativa; ignora a resposta se a tela já saiu.
  useEffect(() => {
    let active = true
    listProducts().then(
      (list) => active && setLoad({ status: 'ready', products: list }),
      (err: unknown) => active && setLoad({ status: 'error', message: toFormMessage(err).text }),
    )
    return () => {
      active = false
    }
  }, [attempt])

  function retry() {
    setLoad({ status: 'loading' })
    setAttempt((n) => n + 1)
  }

  const products = useMemo(() => (load.status === 'ready' ? load.products : []), [load])
  const visible = useMemo(() => filterProducts(products, filters), [products, filters])
  const activeFilters = activeFilterCount(filters)

  const setFilter = <K extends keyof ProductFilters>(key: K, value: ProductFilters[K]) =>
    setFilters((current) => ({ ...current, [key]: value }))
  const clearFilters = () => {
    setFilters(FILTER_DEFAULTS)
    document.getElementById('productSearch')?.focus()
  }

  function handleSaved(saved: Product, created: boolean) {
    setLoad((current) =>
      current.status !== 'ready'
        ? current
        : {
            status: 'ready',
            products: created
              ? [...current.products, saved]
              : current.products.map((p) => (p.id === saved.id ? saved : p)),
          },
    )
    setForm(null)
  }

  function handleDeleted(deleted: Product) {
    setLoad((current) =>
      current.status !== 'ready'
        ? current
        : { status: 'ready', products: current.products.filter((p) => p.id !== deleted.id) },
    )
    setForm(null)
  }

  const findByEan = (ean: string) => products.find((p) => p.ean === ean)

  /** Produto achado no banco pelo leitor que a lista ainda não tem (outro aparelho). */
  function mergeFound(found: Product) {
    setLoad((current) =>
      current.status !== 'ready' || current.products.some((p) => p.id === found.id)
        ? current
        : { status: 'ready', products: [...current.products, found] },
    )
  }

  /** Leitor da barra: já cadastrado → editar; novo → cadastro com o código (T-07 D5). */
  async function lookupFromToolbar(code: string) {
    const found = await findProductByEan(code)
    if (!found) return { kind: 'new' as const }
    mergeFound(found)
    return { kind: 'existing' as const, item: found, summary: `${found.name} · ${formatPrice(found.price)}` }
  }

  const scannerModal = scanning && (
    <ScannerModal<Product>
      onCode={lookupFromToolbar}
      onNewCode={(code) => {
        setScanning(false)
        setForm({ mode: 'new', ean: code, scanned: true })
      }}
      existingActionLabel="Editar produto"
      onExistingAction={(product) => {
        setScanning(false)
        setForm(product)
      }}
      onClose={() => setScanning(false)}
    />
  )

  const scanButton = (
    <button type="button" className="btn btn--outline" data-action="scan" onClick={() => setScanning(true)}>
      <Icon name="barcode" size="sm" />
      Escanear
    </button>
  )

  const formModal = form !== null && (
    <ProductFormModal
      // Nova key a cada alvo: "Abrir produto" troca o formulário sem reaproveitar os campos.
      key={isNewTarget(form) ? `new-${form.ean ?? ''}` : form.id}
      product={isNewTarget(form) ? null : form}
      initialEan={isNewTarget(form) ? form.ean : undefined}
      initialScanned={isNewTarget(form) ? form.scanned : undefined}
      onFound={mergeFound}
      onOpenProduct={(product) => setForm(product)}
      findByEan={findByEan}
      onSaved={handleSaved}
      onDeleted={handleDeleted}
      onClose={() => setForm(null)}
    />
  )

  if (load.status === 'loading') {
    return <p className="empty-state__text" role="status">Carregando produtos…</p>
  }

  if (load.status === 'error') {
    return (
      <div className="empty-state">
        <span className="empty-state__icon" aria-hidden="true">
          <Icon name="alert" />
        </span>
        <h2 className="empty-state__title">Não foi possível carregar os produtos</h2>
        <p className="empty-state__text">{load.message}</p>
        <button type="button" className="btn btn--primary" onClick={retry}>
          <Icon name="refresh" size="sm" />
          Tentar de novo
        </button>
      </div>
    )
  }

  if (products.length === 0) {
    return (
      <>
        <EmptyState
          icon="box"
          title="Nenhum produto cadastrado"
          text="Cadastre o primeiro produto da loja. Depois ele aparece aqui para buscar e editar."
          action={
            <div className="toolbar">
              {scanButton}
              <button type="button" className="btn btn--primary" data-action="new-product" onClick={() => setForm({ mode: 'new' })}>
              <Icon name="plus" size="sm" />
              Cadastrar produto
            </button>
            </div>
          }
        />
        {formModal}
        {scannerModal}
      </>
    )
  }

  return (
    <>
      <div className="toolbar">
        <div className="search">
          <span className="search__icon" aria-hidden="true">
            <Icon name="search" size="sm" />
          </span>
          <input
            type="text"
            className="input search__input"
            id="productSearch"
            placeholder="Buscar por nome ou código..."
            aria-label="Buscar por nome ou código"
            autoComplete="off"
            value={filters.search}
            onChange={(event) => setFilter('search', event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape' && filters.search) setFilter('search', '')
            }}
          />
          <button
            type="button"
            className="search__clear"
            aria-label="Limpar busca"
            hidden={!filters.search}
            onClick={() => {
              setFilter('search', '')
              document.getElementById('productSearch')?.focus()
            }}
          >
            <Icon name="close" size="sm" />
          </button>
        </div>

        <button
          type="button"
          className="btn btn--outline"
          id="filterToggle"
          aria-expanded={filtersOpen}
          aria-controls="filterPanel"
          onClick={() => setFiltersOpen((open) => !open)}
        >
          <Icon name="filter" size="sm" />
          Filtro
          <span className="btn__badge" hidden={activeFilters === 0}>
            {activeFilters}
          </span>
        </button>

        {scanButton}

        <button type="button" className="btn btn--primary" data-action="new-product" onClick={() => setForm({ mode: 'new' })}>
          <Icon name="plus" size="sm" />
          Cadastrar produto
        </button>
      </div>

      <div className="filter-panel" id="filterPanel" hidden={!filtersOpen}>
        <div className="field">
          <label className="field__label" htmlFor="filterCategory">
            Categoria
          </label>
          <select
            className="input"
            id="filterCategory"
            value={filters.category}
            onChange={(event) => setFilter('category', event.target.value)}
          >
            <option value="all">Todas as categorias</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label className="field__label" htmlFor="filterSort">
            Ordenar por
          </label>
          <select
            className="input"
            id="filterSort"
            value={filters.sort}
            onChange={(event) => setFilter('sort', event.target.value as SortKey)}
          >
            <option value="name">Nome (A–Z)</option>
            <option value="category">Categoria</option>
          </select>
        </div>
        <button type="button" className="btn btn--ghost" data-action="clear-filters" onClick={clearFilters}>
          <Icon name="refresh" size="sm" />
          Limpar filtros
        </button>
      </div>

      <ProductList
        products={visible}
        total={products.length}
        term={filters.search}
        onOpen={(product) => setForm(product)}
        onClearFilters={clearFilters}
      />

      {formModal}
      {scannerModal}
    </>
  )
}
