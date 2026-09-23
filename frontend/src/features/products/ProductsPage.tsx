import { useEffect, useMemo, useState } from 'react'
import { toFormMessage } from '../auth/authErrors'
import { EmptyState } from '../../shared/ui/EmptyState'
import { Icon } from '../../shared/ui/Icon'
import { CATEGORIES } from './categories'
import { ProductFormModal } from './ProductFormModal'
import { ProductList } from './ProductList'
import {
  activeFilterCount,
  FILTER_DEFAULTS,
  filterProducts,
  type ProductFilters,
  type SortKey,
} from './productFormat'
import { listProducts } from './productsApi'
import type { Product } from './types'
import './products.css'

type LoadState = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; products: Product[] }

/** Formulário aberto: `null` fechado, `'new'` cadastro, ou o produto em edição. */
type FormTarget = null | 'new' | Product

export function ProductsPage() {
  const [load, setLoad] = useState<LoadState>({ status: 'loading' })
  const [filters, setFilters] = useState<ProductFilters>(FILTER_DEFAULTS)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [form, setForm] = useState<FormTarget>(null)

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

  const formModal = form !== null && (
    <ProductFormModal
      product={form === 'new' ? null : form}
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
            <button type="button" className="btn btn--primary" data-action="new-product" onClick={() => setForm('new')}>
              <Icon name="plus" size="sm" />
              Cadastrar produto
            </button>
          }
        />
        {formModal}
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

        <button type="button" className="btn btn--primary" data-action="new-product" onClick={() => setForm('new')}>
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
    </>
  )
}
