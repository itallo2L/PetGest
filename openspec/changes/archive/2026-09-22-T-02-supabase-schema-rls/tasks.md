## 1. Schema versionado

- [x] 1.1 Criar `supabase/schema.sql` com `petshops`, `profiles`, `products`, índice único parcial `(petshop_id, ean)` e trigger de `updated_at`; verificar que o script roda duas vezes seguidas sem erro (idempotência)
- [x] 1.2 Adicionar `current_petshop_id()` e as políticas de RLS (sem UPDATE em `profiles` — design D3); verificar com o roteiro de teste
- [x] 1.3 Adicionar `signup_petshop` endurecida (design D6) com `execute` revogado de `anon`; verificar com o roteiro de teste
- [x] 1.4 Criar `supabase/tests/rls_test.sql` (transação com `ROLLBACK`) cobrindo cadastro, isolamento, tentativa de troca de vínculo, EAN duplicado, usuário sem petshop e anônimo; verificar em Postgres 16 local emulando `auth.uid()`/papéis do Supabase que termina com "RLS OK" e que falha se a política antiga de UPDATE em `profiles` for recriada
- [x] 1.5 Atualizar `PLANOMVP.md` §3.2 apontando para `supabase/schema.sql` e `ROADMAPV0.md` com o status de T-02

## 2. Aplicar no Supabase (usuário)

- [x] 2.1 (Usuário) Criar o projeto no Supabase (tier gratuito, região São Paulo `sa-east-1`; Security: "Enable Data API" ligado, "Automatically expose new tables" desligado, "Enable automatic RLS" desligado — design D8); guardar `Project URL` e `anon key` (Project Settings > API) — **não** copiar a `service_role key` para lugar nenhum do frontend
- [x] 2.2 (Usuário) SQL Editor > colar `supabase/schema.sql` > Run; verificar em Table Editor que as três tabelas aparecem com o selo "RLS enabled"
- [x] 2.3 (Usuário) SQL Editor > colar `supabase/tests/rls_test.sql` > Run; verificar que o resultado é "RLS OK: todos os testes passaram" e que Authentication > Users continua vazio (rollback)
- [x] 2.4 Commitar em `dev` e fazer push
