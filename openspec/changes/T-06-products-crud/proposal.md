## Why

Produtos é a tela central do V0 — é onde o petshop monta o catálogo que o scanner (T-07) vai consultar. Hoje a área mostra "em construção" (T-05) e o protótipo só guarda produtos num array em memória. Esta etapa liga a tela ao Supabase, com o isolamento por petshop já garantido pelo RLS de T-02.

## What Changes

- **Listagem real** de `products` do petshop logado: tabela no desktop que vira lista de cards no celular (mesmo comportamento do protótipo), com nome, categoria, código de barras e preço em reais.
- **Busca** por nome ou código de barras (sem diferenciar acentos/maiúsculas), **filtro por categoria** e **ordenação** (nome A–Z ou categoria), com contagem "Mostrando X de Y produtos".
- **Cadastrar produto** (modal do protótipo): nome, categoria, código de barras opcional e preço de venda; grava com `source: 'manual'`.
- **Editar produto** no mesmo modal, abrindo pela linha/card.
- **Excluir produto** (novo — não existe no protótipo): botão no modal de edição, com confirmação.
- **Categorias fixas** do protótipo: Ração, Medicamento, Higiene, Acessórios, Petiscos, Jardinagem, Agropecuário.
- Validações e mensagens em português: nome obrigatório, preço válido (aceita vírgula), código de barras com 8 a 14 dígitos, código já usado por outro produto da loja (com o nome dele).
- **Avisos de sucesso** (toast do protótipo) ao cadastrar, salvar e excluir.
- Botão **"Escanear"** do formulário **fica de fora** até T-07 — o código é digitado.
- CSS portado para `shared/ui/` só do que a tela usa: barra de ferramentas, painel de filtros, card, tabela, lista que vira card, modal, toast, `select` e badge de botão (regra de T-04).

Fora desta etapa: scanner (T-07), configurações da loja (T-08), estoque, fornecedor, preço de custo, SKU, situação ativo/inativo (fora do V0 — `CLAUDE.md`).

## Capabilities

### New Capabilities
- `products`: catálogo de produtos do petshop — listar, buscar, filtrar, ordenar, cadastrar, editar e excluir, com as regras de validação da tela.

### Modified Capabilities
- `app-shell`: o requisito "Áreas ainda não implementadas" deixa de valer para Produtos (continua para Configurações até T-08).

## Impact

- **Código novo:** `features/products/` (página, lista, formulário, acesso a dados, tipos), `shared/ui/` (modal, toast, CSS dos componentes acima).
- **Tipos do banco:** tipo `Product` escrito à mão a partir de `supabase/schema.sql` (D4 de T-03 previa gerar tipos aqui; ver design D2).
- **Supabase:** nenhuma mudança de schema — usa `products`, o default `petshop_id = current_petshop_id()` e o índice único `(petshop_id, ean)` de T-02.
- **Ordem de arquivamento:** o delta de `app-shell` modifica uma spec criada pela T-05; arquivar T-05 antes de T-06.
- **Teste em celular real** (Android e iPhone) antes de arquivar.
