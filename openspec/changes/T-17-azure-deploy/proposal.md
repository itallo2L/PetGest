## Why

A API do V1 está pronta em paridade com o V0 (T-12 a T-16), mas só roda no computador de desenvolvimento. Para a T-18 virar a produção, ela precisa estar publicada no Azure App Service, falando com o Postgres do Supabase pelo pooler, com HTTPS, deploy automático e um ambiente de teste para as prévias do frontend. Três pendências registradas nas tarefas anteriores também precisam ser resolvidas antes de publicar:
- **T-14:** as chaves do Data Protection ficam só em memória, então os links de confirmação de e-mail deixariam de valer a cada reinício ou deploy;
- **T-14:** atrás do proxy do App Service, o limite de tentativas de `/auth` veria todos os clientes com o IP do proxy;
- **T-16:** uma conexão ociosa derrubada fez a primeira consulta seguinte responder `500`.

## What Changes

- **Chaves do Data Protection no banco**, na tabela `identity.data_protection_keys` (migration `DataProtectionKeys`).
- **IP do cliente atrás do proxy:** `X-Forwarded-For`/`X-Forwarded-Proto` lidos quando `ForwardedHeaders:Enabled` está ligado, confiando só na última entrada do cabeçalho.
- **Padrões de conexão para o pooler:** keepalive de 30 s, conexão ociosa descartada em 60 s e no máximo 10 conexões por instância, sempre que a string de conexão não disser outra coisa.
- **Deploy pelo GitHub Actions:** o workflow `backend` ganha o job `deploy` (depois dos testes), que publica `dev` no ambiente `test` e `main` no `production`, gera o script idempotente das migrations e confere `/health`. Sem o App Service configurado no ambiente, o job só gera o script.
- **Papel do banco `petgest_api`:** script `backend/deploy/petgest_api_role.sql`, com `grant`s só nas tabelas do app e `bypassrls`.
- **Ambiente de teste decidido:** segundo projeto Supabase gratuito + App Service F1, usado pelas prévias da `dev`.
- **Roteiro de deploy** em `backend/DEPLOY.md`: recursos do Azure, configurações, segredos e conferência.

## Capabilities

### New Capabilities
<!-- nenhuma -->

### Modified Capabilities
- `api-platform`: ganha os requisitos de operação em nuvem — chaves de assinatura persistentes, IP do cliente atrás de proxy e conexão adequada ao pooler.

## Impact

- **Arquivos novos:** `backend/Api/ProxySetup.cs`, `backend/Api/Data/DatabaseSetup.cs`, migration `DataProtectionKeys`, `backend/deploy/petgest_api_role.sql`, `backend/DEPLOY.md`, testes `DatabaseSetupTests`, `ProxyTests` e `Auth/DataProtectionKeyTests`.
- **Arquivos alterados:** `Program.cs`, `AuthSetup.cs`, `AppDbContext`, `IdentityConfiguration.cs`, `.github/workflows/backend.yml`, `backend/README.md`, `ROADMAPV1.md`.
- **Banco:** uma tabela nova no schema `identity` (entra na sequência de migrations da T-18).
- **Dependências:** `Microsoft.AspNetCore.DataProtection.EntityFrameworkCore`.
- **Produção:** nenhum efeito. Os recursos do Azure e os segredos são criados pelo usuário seguindo o `DEPLOY.md`; a produção só muda na T-18.
