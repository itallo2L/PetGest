## 1. Preparação

- [x] 1.1 Scripts `backend/deploy/t18/` (conferência antes, baseline, migrations até `IdentitySchema` geradas pelo EF, importação das contas, migrations seguintes geradas pelo EF, conferência depois) e `depois-da-observacao/` (fechar e reabrir a Data API) (design D1, D3, D4)
- [x] 1.2 `T18RehearsalTests` rodando os mesmos arquivos duas vezes num banco igual ao de produção (simulacro do `auth.users` com as colunas reais, `schema.sql`, conta confirmada, não confirmada, apagada e loja órfã) e a API contra ele (design D2); verificar com `dotnet test` — _verificado em 2026-10-07: 3 testes verdes (com os do `SchemaCompatibilityTests`, 5/5): nenhuma migration pendente, conferências do passo 6 vazias, e-mail normalizado, conta apagada fora, loja órfã intacta; login com a senha do V0 em outra caixa, produtos da loja, re-hash, conta não confirmada → `403` e recuperada por "Esqueci minha senha"; Data API fechada → `false`, reaberta → `true`_
- [x] 1.3 Roteiro `runbook.md` (pré-requisitos, comunicação, janela, App Service, Vercel, testes, observação, depois da observação, rollback por etapa, plano B) e `ROADMAPV1.md` (status e a mudança de ordem da Data API — design D4)

## 2. Virada (usuário — só depois da T-10 arquivada)

- [ ] 2.1 (Usuário) Pré-requisitos do `runbook.md` §0 (T-10 arquivada, Supabase Pro, App Service de produção, e-mail real testado, roteiro da T-10 no modo `api` pela prévia, `dev` → `main`, aviso aos petshops)
- [ ] 2.2 (Usuário) Janela de virada (`runbook.md` §1), anotando aqui o resultado de cada conferência
- [ ] 2.3 (Usuário) Roteiro da T-10 em produção no Android e no iPhone e "Esqueci minha senha" com e-mail real (`runbook.md` §2)
- [ ] 2.4 (Usuário) Observação e passos de depois da observação (`runbook.md` §3–§4), incluindo a change de remoção do caminho Supabase do frontend
