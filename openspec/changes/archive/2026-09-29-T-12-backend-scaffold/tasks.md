## 1. Estrutura e Postgres local

- [x] 1.1 Criar `backend/` com `global.json` (SDK 10.0.x, `rollForward: latestFeature`), `Directory.Build.props` (net10.0, Nullable, ImplicitUsings, TreatWarningsAsErrors), `PetGest.slnx`, o projeto `Api/PetGest.Api.csproj` (Web API vazia, sem controllers nem template de exemplo) e as pastas `Endpoints/`, `Services/`, `Data/`, `Models/` (design D1, D2); acrescentar `bin/` e `obj/` ao `.gitignore` da raiz; verificar que `dotnet build backend/PetGest.slnx` passa sem avisos e que `git status` não lista `bin/`/`obj/`
- [x] 1.2 Criar `backend/docker-compose.yml` com `postgres:17` na porta `5450` do host, credenciais `petgest`/`petgest_dev`/`petgest`, volume nomeado e `healthcheck` com `pg_isready` (design D5); verificar com `docker compose up -d` que o contêiner fica `healthy` e que `docker compose exec db psql -U petgest -c "select version()"` mostra PostgreSQL 17
- [x] 1.3 Fixar a porta local da API em `Properties/launchSettings.json` (`http://localhost:5080`, só HTTP) e `ASPNETCORE_ENVIRONMENT=Development`; verificar que `dotnet run --project backend/Api` sobe nessa porta

## 2. Banco, saúde, CORS e OpenAPI

- [x] 2.1 Adicionar `Npgsql.EntityFrameworkCore.PostgreSQL`, criar `Data/AppDbContext.cs` sem entidades e registrá-lo com `ConnectionStrings:Default`, falhando na inicialização com mensagem clara quando a chave não existe; string de desenvolvimento só em `appsettings.Development.json` (design D4); verificar que a API sobe com o compose no ar e que, com a chave removida, para com a mensagem que nomeia `ConnectionStrings:Default`
- [x] 2.2 Implementar `Endpoints/HealthEndpoints.cs` com `GET /health` minimal, anônimo, usando `AddHealthChecks().AddDbContextCheck<AppDbContext>()` e devolvendo só `Healthy`/`Unhealthy` com `200`/`503` (design D3); verificar com `curl -i http://localhost:5080/health` → `200 Healthy` com o compose no ar e `503 Unhealthy` sem detalhes com `docker compose stop db`
- [x] 2.3 Configurar CORS pela seção `Cors` (`AllowedOrigins` + `AllowedOriginPatterns`), sem `AllowCredentials` (design D6); ler o slug do escopo na Vercel (prévia da `dev` em Deployments) e colocar o padrão real de prévia; verificar com `curl -i -H "Origin: http://localhost:5183" http://localhost:5080/health` que volta `Access-Control-Allow-Origin` e com `Origin: https://exemplo.com` que não volta
- [x] 2.4 Adicionar `Microsoft.AspNetCore.OpenApi` e `Swashbuckle.AspNetCore.SwaggerUI`, mapeando `/openapi/v1.json` e `/swagger` só em Development (design D7); verificar no navegador que `/swagger` lista `GET /health` e que `/openapi/v1.json` traz a operação

## 3. Testes

- [x] 3.1 Criar `Api.Tests/PetGest.Api.Tests.csproj` (xUnit, `Microsoft.AspNetCore.Mvc.Testing`), incluí-lo na solução e, se preciso, expor `public partial class Program;` (design D1, D8); verificar que `dotnet test backend/PetGest.slnx` descobre e roda um teste trivial
- [x] 3.2 Escrever os testes de saúde da spec `api-platform`: banco no ar → `200 Healthy`; banco inalcançável (`Host=127.0.0.1;Port=1`, timeout curto) → `503` com corpo sem host/exceção; chamada sem credenciais não é `401`/`403`; verificar que passam com o compose no ar
- [x] 3.3 Escrever os testes de CORS: produção, `localhost:5183`, URL no formato de prévia do projeto, *preflight* `OPTIONS`, origem desconhecida, prévia de outro projeto na Vercel e ausência de `Access-Control-Allow-Credentials`; verificar que todos passam
- [x] 3.4 Escrever os testes de OpenAPI: em Development `/openapi/v1.json` → `200` com `/health` e `/swagger` → `200`; com ambiente `Production` os dois → `404`; verificar que passam e que `dotnet test` roda a suíte inteira verde

## 4. CI

- [x] 4.1 Criar `.github/workflows/backend.yml` (push/PR em `dev` e `main`, `paths` em `backend/**` e no próprio workflow, `setup-dotnet` com `backend/global.json`, serviço `postgres:17` em `5450:5432`, restore → build Release → test) (design D9); verificar com `git push` na `dev` que o workflow roda e fica verde no GitHub Actions
- [x] 4.2 Verificar que um commit que só mexe em `frontend/` não dispara o workflow do backend e que o deploy de prévia da Vercel da `dev` continua **Ready** (Root Directory `frontend` intocado) — _verificado em 2026-09-29: commit ca065a0 (só `openspec/`, fora de `backend/**` — mesmo filtro `paths` de um commit só de `frontend/`) não gerou run do workflow; prévias `pet-gest` e `pet-gest-8fd8` Ready em 13f6c30 e ca065a0_

## 5. Documentação

- [x] 5.1 Escrever `backend/README.md` (pré-requisitos, `docker compose up -d`, `dotnet run`, `dotnet test`, endereços `/health` e `/swagger`, seção `Cors`, variáveis que a T-17 vai sobrescrever: `ConnectionStrings__Default`, `Cors__AllowedOrigins__0`…); verificar seguindo o README do zero, com o contêiner removido, até `/health` responder `200`
- [x] 5.2 Atualizar `CLAUDE.md` (estado do repositório com `backend/`, estrutura de pastas, remover "Sem pasta `backend/` ainda") e `ROADMAPV1.md` (status da T-12 com data e o que foi entregue); verificar que nenhum dos dois ainda diz que `backend/` não existe
