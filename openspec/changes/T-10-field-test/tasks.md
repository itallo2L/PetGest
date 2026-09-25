## 1. Preparação

- [x] 1.1 Escrever `roteiro.md` (seções: preparação, autenticação, navegação, produtos, scanner com erros, configurações, medições) e o modelo de `relatorio.md` (design D2, D5); verificar que cada passo tem ação, resultado esperado e o requisito de spec que cobre, e que todos os itens do `ROADMAPV0.md` T-10 aparecem no roteiro
- [ ] 1.2 (Usuário) Limpar dados de teste: apagar as contas de teste em Authentication > Users e rodar o SQL de limpeza de lojas sem usuário; conferir que o projeto Supabase não está pausado (design D3); verificar que Users e `petshops` não têm mais dados de teste
- [ ] 1.3 (Usuário) Abrir o PR `dev` → `main` e mesclar (design D1); verificar que o deploy de produção da `main` fica **Ready** na Vercel
- [ ] 1.4 Rodar o teste de fumaça da T-09 (tarefa 4.2) contra `https://pet-gest.vercel.app` e marcá-la na T-09; verificar endereços diretos com 200 e JavaScript publicado só com a chave pública

## 2. Teste de campo no Android

- [ ] 2.1 (Usuário) Executar o `roteiro.md` inteiro em produção num Android real, com embalagens reais e rede móvel, anotando ✅/❌ e observações por passo (ou enviando para eu registrar)
- [ ] 2.2 Consolidar o `relatorio.md` do Android; para cada ❌, registrar o defeito e criar a tarefa de correção na change de origem (design D4); verificar que todo ❌ tem destino (tarefa criada ou aceite explícito do usuário)
- [ ] 2.3 Corrigir os defeitos nas changes de origem e reexecutar os passos afetados no Android; verificar que o relatório fica sem ❌ pendente (se não houver defeitos, marcar direto)

## 3. iPhone e fechamento do V0 (bloqueado até haver iPhone)

- [ ] 3.1 (Usuário) Executar o `roteiro.md` num iPhone real (Safari), incluindo as medições do motor WASM; enviar os resultados
- [ ] 3.2 Consolidar o `relatorio.md` do iPhone, registrar o resultado da T-01 5.4 no `design.md` da T-01 e tratar defeitos como em 2.2/2.3; verificar que o relatório fica sem ❌ pendente nos dois aparelhos
- [ ] 3.3 Remover o `/spike` (T-07 4.4) e arquivar as changes na ordem do design D6; verificar com `openspec list` que não resta change ativa do V0 e que as specs principais existem (`auth`, `tenant-data`, `app-shell`, `products`, `product-scanning`, `store-settings`, `deployment`, `barcode-scanner`)
- [ ] 3.4 Atualizar `ROADMAPV0.md` marcando o V0 como concluído (com data, URL de produção e resumo do teste de campo); verificar que todas as seções T-01 a T-10 têm status final
