## Why

A produção (`pet-gest.vercel.app`) ainda roda no V0: frontend falando direto com o Supabase (Auth + Data API + RLS). Para o V1 valer de verdade, a produção precisa passar a usar a API própria, sem perder conta, loja nem produto, e com um caminho de volta se algo der errado. A virada mexe no banco e no deploy de produção ao mesmo tempo, por isso precisa de um roteiro fechado e ensaiado antes do dia.

## What Changes

Esta change **prepara** a virada; **não a executa**. Pela regra do projeto (T-11, D1, e `CLAUDE.md`), a T-18 só começa depois de a T-10 ser arquivada, e mexer na produção é do usuário.

- **Scripts da janela de virada** em `backend/deploy/t18/`, numerados na ordem do roteiro e todos idempotentes:
  1. conferência antes (formato dos hashes, contas que não entram, vínculos problemáticos, produtos por loja, lojas sem usuário);
  2. baseline da migration `V0Schema`;
  3. migrations até `IdentitySchema` (gerado pelo EF);
  4. importação das contas de `auth.users` para `identity.users` (mesmo id, e-mail normalizado, confirmação preservada, hash bcrypt);
  5. migrations seguintes (`ProfilesUserFk`, `DataProtectionKeys`; gerado pelo EF);
  6. conferência depois.
- **Scripts para depois da observação:** fechar a Data API do Supabase e reabri-la, para rollback.
- **Ensaio automático** (`T18RehearsalTests`): roda os mesmos arquivos, na ordem, num banco montado como o de produção. Depois usa a API contra ele (login com a senha do V0, produtos da loja, conta não confirmada recuperada pelo e-mail, conta apagada fora). Falha se uma migration nova entrar sem regerar o passo 5.
- **Roteiro da virada** (`runbook.md`): pré-requisitos, comunicação aos petshops, janela passo a passo com conferências, configuração do App Service e da Vercel, teste de campo e rollback em cada etapa.

## Capabilities

### New Capabilities
<!-- nenhuma -->

### Modified Capabilities
- `api-auth`: importação das contas do Supabase Auth (quem entra, com que dados).

## Impact

- **Arquivos novos:** `backend/deploy/t18/` (seis passos + `depois-da-observacao/`), `backend/Api.Tests/Data/T18RehearsalTests.cs`, `openspec/changes/T-18-production-cutover/runbook.md`.
- **Arquivos alterados:**
  - `backend/Api.Tests/Sql/supabase-stub.sql` (colunas reais de `auth.users` que os scripts usam);
  - `SchemaCompatibilityTests` (helpers compartilhados);
  - `ROADMAPV1.md`.
- **Produção:** nenhum efeito. Tudo aqui roda só quando o usuário seguir o `runbook.md`.
