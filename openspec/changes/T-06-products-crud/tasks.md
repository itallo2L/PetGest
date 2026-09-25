## 1. Base

- [x] 1.1 Portar o CSS do design D10 (`modal.css`, `toast.css`, `card.css`, `table.css`, acréscimos em `forms.css`/`buttons.css`, `features/products/products.css`) e criar `.btn--danger`; verificar com o script de diff de T-05 que todo bloco portado é idêntico ao `style.css` (exceto `.btn--danger`) e `npm run build` sem erros
- [x] 1.2 Criar `types.ts`, `categories.ts`, `productsApi.ts` (design D1, D2, D8) e os helpers de preço/código/busca (D3, D6, D7); verificar com `npx tsc -b`/`npm run lint` e, no console do dev server logado, que `listProducts()` devolve `[]` numa loja nova e que nenhuma query contém `petshop_id` (aba Network)
- [x] 1.3 Criar `Modal`, `ConfirmDialog` e `ToastProvider` em `shared/ui/` (design D9); verificar no dev server: Esc, backdrop e "Cancelar" fecham; foco vai ao primeiro campo e volta ao gatilho; o fundo não rola; em 375 px o modal fica centralizado

## 2. Tela de Produtos

- [x] 2.1 Listagem com tabela/cards, resumo "Mostrando X de Y", estado vazio da loja e estado de erro com "Tentar de novo" (design D4, D12); verificar numa loja nova (estado vazio), depois com produtos (tabela no desktop, cards em 375 px) e com o fetch de `products` derrubado (erro, não lista vazia)
- [x] 2.2 Busca, filtro por categoria, ordenação, badge de filtros ativos, destaque do termo e "Limpar busca e filtros" (design D3); verificar: "racao" encontra "Ração", parte de um código encontra o produto, Higiene filtra e mostra badge 1, busca sem resultado mostra a mensagem e o botão limpa tudo
- [x] 2.3 Formulário de cadastro no modal (categorias fixas, preço com vírgula, código opcional, sem botão "Escanear") com toast de sucesso (design D6, D7, D11); verificar: cadastro válido aparece na lista com `source = 'manual'` (Table Editor), "12,5" grava 12.50, nome vazio / preço inválido / código "12345" mostram a mensagem sem requisição
- [x] 2.4 Edição no mesmo modal abrindo pela linha/card, com categoria fora da lista preservada (design D8); verificar: mudar preço reflete na lista e no banco; cancelar não altera nada; `updated_at` muda no banco
- [x] 2.5 Código duplicado (design D5); verificar: repetir o código de um produto da loja mostra "O código de barras … já pertence a …" e nada é gravado; o mesmo código numa segunda loja de teste é aceito
- [x] 2.6 Exclusão com `ConfirmDialog` e toast; verificar: cancelar a confirmação mantém o produto e o formulário aberto; confirmar remove da lista e do banco
- [x] 2.7 Falha ao gravar; verificar com o fetch derrubado: cadastrar, salvar e excluir mantêm o formulário aberto com os dados e mostram "Não foi possível conectar…"

## 3. Fechamento

- [x] 3.1 Conferir que nenhum arquivo de `features/scanner/` mudou e que nenhuma query do app filtra por `petshop_id` (`grep -rn petshop_id frontend/src` só em comentários/tipos)
- [x] 3.2 Atualizar `ROADMAPV0.md` com o status de T-06; verificar que aponta para esta change e registra a exclusão como acréscimo ao roadmap
- [ ] 3.3 (Usuário) Commitar em `dev`, fazer push e testar no deploy em **Android (Chrome) e iPhone (Safari)**: cadastrar com vírgula no preço, buscar sem acento, filtrar, editar, excluir, lista em cards, modal centralizado e teclado decimal no preço
- [ ] 3.4 (Usuário) Apagar as contas e lojas de teste criadas nas verificações (Authentication > Users + SQL de limpeza de `petshops` sem `profiles`)
