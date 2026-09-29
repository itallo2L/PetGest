## Why

A T-11 decidiu que o V1 roda sobre uma API própria em ASP.NET Core (.NET 10), mas `backend/` ainda não existe. Antes que modelo de dados (T-13), autenticação (T-14) e endpoints (T-15) dependam dela, a API precisa existir vazia e provada: compila, sobe, conecta num Postgres, publica o contrato OpenAPI, só aceita chamadas de navegador vindas do frontend e é construída e testada automaticamente a cada push. Separar isso agora evita que a T-13 descubra problemas de ambiente no meio das regras de negócio.

## What Changes

- Nova pasta `backend/` com um único projeto ASP.NET Core Web API em `backend/Api/` (.NET 10), organizado nas pastas `Endpoints/`, `Services/`, `Data/` e `Models/` (`PLANOMVP.md` §4.3, T-11 D5) — sem nenhuma regra de negócio.
- EF Core com `Npgsql` e um `DbContext` ainda sem entidades (as entidades e migrations são da T-13), lendo a string de conexão da configuração.
- Postgres local de desenvolvimento em Docker Compose (`postgres:17`, mesma versão major do Supabase de produção) — a API **nunca** aponta para o banco de produção nesta etapa (T-11, riscos).
- Documento OpenAPI gerado pela API e interface de navegação (Swagger UI) em desenvolvimento — base para gerar os tipos TypeScript na T-16.
- Endpoint `GET /health` que responde se a API está de pé e se alcança o banco.
- CORS liberado só para as origens do frontend: produção (`https://pet-gest.vercel.app`), prévias da Vercel do próprio projeto e `http://localhost:5183`.
- Projeto de testes `backend/Api.Tests/` (xUnit + `WebApplicationFactory`) cobrindo saúde, CORS e OpenAPI.
- Workflow do GitHub Actions que faz build e roda os testes do backend (com Postgres 17 como serviço) em push e PR para `dev` e `main`, só quando `backend/**` muda. **Sem deploy** — Azure é da T-17.
- `.gitignore` com `bin/` e `obj/`; `backend/README.md` com como rodar; `ROADMAPV1.md` (status da T-12) e `CLAUDE.md` (estado do repositório e estrutura de pastas).
- `frontend/` não muda e continua com deploy independente na Vercel (§4.3).

## Capabilities

### New Capabilities
- `api-platform`: comportamento de base da API do V1, independente de qualquer regra de negócio — verificação de saúde (processo e banco), política de CORS restrita às origens do frontend e publicação do contrato OpenAPI.

### Modified Capabilities
<!-- nenhuma — auth e tenant-data continuam descrevendo o V0 em produção; a T-12 não muda comportamento delas -->

## Impact

- **Pastas/arquivos novos:** `backend/` (solução, `Api/`, `Api.Tests/`, `docker-compose.yml`, `global.json`, `README.md`), `.github/workflows/backend.yml`.
- **Arquivos alterados:** `.gitignore` (raiz), `ROADMAPV1.md`, `CLAUDE.md`.
- **Dependências novas (NuGet):** `Npgsql.EntityFrameworkCore.PostgreSQL`, `Microsoft.AspNetCore.OpenApi`, `Microsoft.Extensions.Diagnostics.HealthChecks.EntityFrameworkCore`, `Swashbuckle.AspNetCore.SwaggerUI`; nos testes `xunit`, `Microsoft.AspNetCore.Mvc.Testing`.
- **Ferramentas:** .NET SDK 10 e Docker na máquina de desenvolvimento; GitHub Actions no repositório `itallo2L/PetGest` (primeiro workflow do repo).
- **Produção:** nenhum efeito. `pet-gest.vercel.app` segue no V0, a API não é publicada e não se conecta ao projeto Supabase.
