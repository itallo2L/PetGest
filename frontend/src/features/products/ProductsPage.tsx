import { EmptyState } from '../../shared/ui/EmptyState'

/** Placeholder até T-06 (listagem e cadastro de produtos). */
export function ProductsPage() {
  return (
    <EmptyState
      icon="box"
      title="Produtos em construção"
      text="Em breve você vai listar, buscar e cadastrar os produtos da sua loja aqui."
    />
  )
}
