## 1. Base

- [x] 1.1 Portar o CSS do design D6 (`features/petshop/settings.css` e `.card__body` em `shared/ui/card.css`); verificar com o script de diff da T-06 que os blocos são idênticos ao `style.css` e `npm run build` sem erros
- [x] 1.2 Criar `features/petshop/petshopApi.ts` com `getStore()` e `updateStore()` (design D1, D2); verificar com `npx tsc -b`/`npm run lint` e, no console do dev server logado, que `getStore()` devolve a loja do usuário e que a requisição de leitura não tem filtro

## 2. Tela de Configurações

- [x] 2.1 `SettingsPage` com carregamento, erro com "Tentar de novo" e o formulário do protótipo preenchido (design D4); verificar no dev server: os dados da loja aparecem nos campos; com o fetch de `petshops` derrubado aparece o erro, não um formulário vazio
- [x] 2.2 Salvar com validação, aviso de sucesso, dica do e-mail e atualização do shell (design D2, D3, D5); verificar: trocar o nome para "Pet Shop Amigo Fiel" mostra o aviso e a barra lateral passa a "Pet Shop Amigo Fiel"/"PS" sem recarregar; recarregar mantém os dados; telefone em branco grava `null` no banco; nome vazio e "contato@" são recusados sem requisição
- [x] 2.3 Falha ao salvar e isolamento; verificar com o fetch derrubado que os dados digitados continuam e aparece "Não foi possível conectar…"; e, por script como a loja B, que um UPDATE no `id` da loja A não altera nada
- [x] 2.4 E-mail de acesso intacto; verificar trocando o e-mail da loja, saindo e entrando de novo com o e-mail de login original

## 3. Fechamento

- [x] 3.1 Conferir em 375 px que o formulário fica em uma coluna, sem rolagem lateral, e que nenhum arquivo de `features/scanner/` mudou
- [x] 3.2 Atualizar `ROADMAPV0.md` com o status de T-08; verificar que aponta para esta change
- [ ] 3.3 (Usuário) Commitar em `dev`, fazer push e testar no deploy em Android e iPhone: editar e salvar os dados, ver o nome novo na barra lateral, recarregar
- [ ] 3.4 (Usuário) Apagar as contas/lojas de teste criadas nas verificações
