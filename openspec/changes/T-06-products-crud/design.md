## Context

Motivação em `proposal.md`. Requisitos em `specs/products/spec.md` (nova) e `specs/app-shell/spec.md` (delta).

- **Banco (`supabase/schema.sql`):** `products(id, petshop_id default current_petshop_id(), name, category, price numeric(10,2) >= 0, ean text 8–14 dígitos ou null, source 'barcode'|'manual', created_at, updated_at)`; índice único parcial `(petshop_id, ean) where ean is not null`; RLS "acesso restrito ao próprio petshop" para select/insert/update/delete; trigger mantém `updated_at`.
- **Protótipo:** `index.html` linhas 176–253 (toolbar, painel de filtros, card com tabela + `record-list`, rodapé de resultados) e 312–358 (modal de cadastro/edição); `script.js` §5 (filtro/ordenação/`highlight`/resumo) e §6 (formulário, validações, mensagem de código duplicado), helpers `normalize` e `normalizeBarcode` (linhas 63–80).
- **CSS no `style.css`:** BARRA DE FERRAMENTAS (498–587), CARDS (659–697), TABELAS (1058–1196, com `mark` em 1128), MODAIS (1332–1411), FORMULÁRIOS — `select.input` e `.input--sm` (1450–1467), `.btn__badge` (484–496), TOASTS (1927–1977), RESPONSIVO — `filter-panel`, `toolbar`, `search`, `toast-stack` (1978–2032), REFINAMENTO MOBILE — lista que vira card (2033–2275), modais centralizados (2311–2353), formulários/Produtos (2354–2375, 2439–2469).
- **Frontend hoje:** `features/products/ProductsPage.tsx` é um estado vazio (T-05); `SessionProvider` garante que a página só abre com petshop; não há tipos gerados do banco.

## Goals / Non-Goals

**Goals:**
- Mesma experiência do protótipo (busca instantânea, tabela/cards, modal), agora persistida.
- Nenhuma query com `petshop_id` — o RLS e o default da coluna resolvem.

**Non-Goals:**
- Botão "Escanear" e consulta por código (T-07).
- Paginação visual, importação em lote, histórico de preço.
- Filtro/busca no servidor.

## Decisions

### D1. Camada de dados em `features/products/productsApi.ts`
Funções `listProducts()`, `createProduct(input)`, `updateProduct(id, input)`, `deleteProduct(id)` sobre o client único. Insert envia só `name, category, price, ean, source: 'manual'`; update envia `name, category, price, ean` (nunca `source` nem `petshop_id`). Insert/update usam `.select().single()` para devolver a linha gravada.
`listProducts()` lê em páginas de 1000 (`range`) até acabar: o PostgREST do Supabase corta respostas em 1000 linhas por padrão e a lista precisa estar completa para a busca local (D3).

### D2. Tipo `Product` escrito à mão
`features/products/types.ts` com os campos de `products` usados pela tela. Alternativa (tipos gerados com `supabase gen types`) exige Supabase CLI autenticada; com uma tabela e poucos campos, o risco de divergência é baixo. Reavaliar quando o schema mudar.

### D3. Busca, filtro e ordenação no navegador
A lista inteira fica em memória e é filtrada a cada tecla, como no protótipo (`normalize` sem acento; nome ou código contém o termo; categoria; ordenação `localeCompare('pt-BR')`). Resultado instantâneo e sem requisição por tecla — importante em 3G/4G dentro da loja. Um petshop do V0 tem centenas de produtos, não dezenas de milhares.
Alternativa descartada: `ilike` no servidor — uma requisição por busca e sem ignorar acento sem extensão `unaccent`.

### D4. Estado local atualizado pela resposta da gravação
Depois de criar/editar, a linha devolvida substitui/entra na lista; depois de excluir, sai. Sem recarregar tudo. Erro ao carregar → estado de erro com "Tentar de novo" (não confundir com loja vazia).

Observado na implementação: o `supabase-js` 2.117 repete **leituras** (GET) que falham por rede mais 3 vezes (espera de 1 s, 2 s e 4 s) antes de devolver o erro — o estado de erro aparece ~7 s depois. **Gravações** (POST/PATCH/DELETE) não são repetidas e falham na hora, mantendo o formulário aberto. Aceito como está: repetir a leitura ajuda em 3G/4G instável.

### D5. Código duplicado: regra do banco, mensagem do app
Não há checagem prévia de duplicidade (seria uma corrida). O insert/update falha com `23505` no índice `(petshop_id, ean)`; o app procura na lista local o produto com aquele código para montar "O código de barras X já pertence a Y." (se não achar, mensagem sem o nome).

### D6. Preço como texto com teclado decimal
`<input inputMode="decimal">` em vez de `type="number"` (no iPhone em pt-BR o `number` mistura vírgula/ponto e aceita `e`). Parse: tira espaços e `R$`, troca `,` por `.`, exige número ≥ 0 com até 2 casas e até 99.999.999,99 (`numeric(10,2)`). Exibição com `Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })`.

### D7. Código de barras normalizado
Como `normalizeBarcode` do protótipo: remove tudo que não é dígito; vazio → `null`; senão exige 8–14 dígitos (mesma regra do `check` do banco), para a mensagem aparecer antes da requisição.

### D8. Categorias fixas num módulo
`features/products/categories.ts` com as 7 do protótipo, na ordem dele. Se um produto tiver uma categoria fora da lista (ex.: criado pelo SQL Editor), o select de edição inclui essa categoria como opção extra para não trocá-la sem querer.

### D9. Componentes compartilhados: `Modal`, `ConfirmDialog`, toasts
- `shared/ui/Modal.tsx`: CSS do protótipo; foco no primeiro campo ao abrir e de volta no gatilho ao fechar; fecha em Esc, backdrop e "Cancelar"; trava a rolagem do `body` (`is-locked`); centralizado no celular (REFINAMENTO MOBILE).
- `ConfirmDialog` para "Excluir produto?" — modal pequeno com "Cancelar" e "Excluir" (botão de perigo), em vez de `window.confirm` (visual do app, testável, e o `confirm` nativo some em alguns navegadores embutidos).
- Toasts: `ToastProvider` em `shared/ui/` com a pilha do protótipo; sucesso some sozinho.
O `.btn--danger` não existe no protótipo; criado com os tokens `--danger`/`--danger-strong`.

### D10. CSS portado por bloco, para `shared/ui/` e `features/products/`
Componentes reutilizáveis (`modal.css`, `toast.css`, `card.css`, `table.css` + lista que vira card, acréscimos em `forms.css`/`buttons.css`) em `shared/ui/`; o que é só da tela (toolbar, busca, painel de filtros, `cell-*`) em `features/products/products.css`. Blocos copiados literalmente; classes de telas cortadas (estoque, reposição, fornecedores, KPIs) e os limiares de container que não são `l801` ficam de fora.

### D11. Sem botão "Escanear" até T-07
O campo de código fica sozinho, com a dica "Digite o código de barras (opcional)". T-07 volta com o `field-with-action` do protótipo. Evita um botão que não faz nada no celular.

### D12. Estado vazio da loja ≠ nada encontrado
Loja sem produtos: `EmptyState` com "Cadastre o primeiro produto" e o botão. Filtros sem resultado: mensagem do protótipo com "Limpar busca e filtros".

## Risks / Trade-offs

- [Loja com milhares de produtos deixa o carregamento inicial lento] → paginação de 1000 em 1000 (D1); se virar problema, mudar a busca para o servidor sem mudar a UI.
- [Dois aparelhos editando o mesmo produto] → vence a última gravação (sem controle de versão no V0); a lista de um aparelho só atualiza ao recarregar.
- [Excluir é definitivo] → confirmação obrigatória; sem lixeira no V0.
- [Tipos à mão divergem do schema] → um só tipo, validado pelo `tsc` contra o uso; D2 revisita.

## Migration Plan

Sem migração de dados. Deploy normal em `dev`; rollback revertendo o commit (Produtos volta ao "em construção").
