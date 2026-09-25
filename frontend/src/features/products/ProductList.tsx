import { Icon } from '../../shared/ui/Icon'
import { formatPrice, normalize } from './productFormat'
import type { Product } from './types'

/** Destaca o trecho que casa com a busca (sem acento), como no protótipo. */
function Highlight({ text, term }: { text: string; term: string }) {
  const needle = normalize(term.trim())
  const from = needle ? normalize(text).indexOf(needle) : -1
  if (from === -1) return <>{text}</>
  return (
    <>
      {text.slice(0, from)}
      <mark>{text.slice(from, from + needle.length)}</mark>
      {text.slice(from + needle.length)}
    </>
  )
}

interface ProductListProps {
  products: Product[]
  total: number
  term: string
  onOpen: (product: Product) => void
  onClearFilters: () => void
}

/** Tabela no desktop, cards no celular (a troca é por container query). */
export function ProductList({ products, total, term, onOpen, onClearFilters }: ProductListProps) {
  const empty = (
    <div className="table-empty">
      <strong>Nenhum produto encontrado.</strong>
      <br />
      {term.trim() ? `Nada corresponde a “${term.trim()}” com os filtros atuais.` : 'Tente ajustar os filtros aplicados.'}
      <br />
      <button type="button" className="btn btn--link" data-action="clear-filters" onClick={onClearFilters}>
        Limpar busca e filtros
      </button>
    </div>
  )

  return (
    <section className="card card--list card--list-801">
      <div className="table-wrap table-wrap--stacks">
        <table className="table">
          <thead>
            <tr>
              <th scope="col" className="col-product">
                Produto
              </th>
              <th scope="col">Categoria</th>
              <th scope="col">Código de barras</th>
              <th scope="col" className="num">
                Preço
              </th>
              <th scope="col" className="right">
                Ações
              </th>
            </tr>
          </thead>
          <tbody>
            {products.length === 0 ? (
              <tr>
                <td colSpan={5}>{empty}</td>
              </tr>
            ) : (
              products.map((p) => (
                <tr
                  key={p.id}
                  tabIndex={0}
                  onClick={() => onOpen(p)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') onOpen(p)
                  }}
                >
                  <td className="col-product">
                    <div className="cell-product">
                      <span className="cell-product__icon">
                        <Icon name="box" />
                      </span>
                      <span className="cell-product__name">
                        <Highlight text={p.name} term={term} />
                      </span>
                    </div>
                  </td>
                  <td>
                    <span className="cell-category">{p.category}</span>
                  </td>
                  <td>
                    <span className="cell-muted">{p.ean ? <Highlight text={p.ean} term={term} /> : 'sem código'}</span>
                  </td>
                  <td className="num">
                    <span className="cell-strong">{formatPrice(p.price)}</span>
                  </td>
                  <td className="right">
                    <button
                      type="button"
                      className="btn btn--link"
                      onClick={(event) => {
                        event.stopPropagation()
                        onOpen(p)
                      }}
                    >
                      Editar
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <ul className="record-list record-list--top">
        {products.length === 0 ? (
          <li className="table-empty">{empty}</li>
        ) : (
          products.map((p) => (
            <li key={p.id}>
              <button type="button" className="record record--tappable" onClick={() => onOpen(p)}>
                <span className="record__head">
                  <span className="record__icon">
                    <Icon name="box" />
                  </span>
                  <span className="record__ident">
                    <span className="record__title">
                      <Highlight text={p.name} term={term} />
                    </span>
                    <span className="record__meta">
                      {p.category}
                      {p.ean && (
                        <>
                          {' · '}
                          <Highlight text={p.ean} term={term} />
                        </>
                      )}
                    </span>
                  </span>
                  <span className="record__chevron">
                    <Icon name="arrow-right" size="sm" />
                  </span>
                </span>
                <span className="record__foot">
                  <strong>{formatPrice(p.price)}</strong>
                </span>
              </button>
            </li>
          ))
        )}
      </ul>

      <footer className="card__footer results-bar">
        <p className="results-bar__text">
          {products.length > 0 ? (
            <>
              Mostrando <strong>{products.length}</strong> de <strong>{total}</strong>{' '}
              {total === 1 ? 'produto cadastrado' : 'produtos cadastrados'}.
            </>
          ) : (
            'Nenhum resultado para os filtros atuais.'
          )}
        </p>
      </footer>
    </section>
  )
}
