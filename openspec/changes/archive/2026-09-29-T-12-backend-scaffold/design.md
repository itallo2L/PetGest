## Context

Motivação em `proposal.md`; comportamento exigido em `specs/api-platform/spec.md`.

- **Repositório hoje:** só `frontend/` (Vite, porta fixa `5183`, deploy na Vercel com Root Directory `frontend`) e `supabase/`. Nenhum workflow em `.github/`; o `.gitignore` da raiz não conhece `bin/`/`obj/`.
- **Máquina de desenvolvimento (conferido em 2026-09-29):** .NET SDK `10.0.400`, Docker `29.5.3` e um PostgreSQL 18 instalado. As portas `5432`–`5434` e `5440` já estão ocupadas por contêineres Postgres de outros projetos da máquina (conferido na implementação). O Supabase de produção roda Postgres `17.6`.
- **Decisões herdadas da T-11:** projeto único com pastas, .NET 10 (D5); o banco da API é o Postgres do Supabase (D2), mas durante T-12 a T-17 a API roda só contra banco de desenvolvimento/teste, nunca contra o de produção (T-11, riscos).
- **Escolhas do usuário para esta change:** Postgres local via Docker Compose com `postgres:17`; a T-12 vai até build + testes no GitHub Actions, sem nada de Azure.

## Goals / Non-Goals

**Goals:**
- `dotnet test` verde na máquina e no GitHub Actions, com a API conectando num Postgres 17 de verdade.
- Um lugar óbvio para cada coisa que as T-13 a T-15 vão adicionar (entidades, serviços, DTOs, endpoints), sem precisar reorganizar nada.
- Configuração que a T-17 só precisa sobrescrever por variáveis de ambiente (string de conexão, origens de CORS), sem mudar código.

**Non-Goals:**
- Entidades, migrations, `dotnet-ef` e o mapeamento das tabelas do V0 (T-13).
- Autenticação, JWT, rate limit, HTTPS/redirect e cabeçalhos de proxy do App Service (T-14/T-17).
- Deploy, App Service, papel `petgest_api`, pooler do Supabase (T-17).
- Qualquer mudança em `frontend/` ou no projeto Supabase.

## Decisions

### D1. Layout: solução com dois projetos em `backend/`
```
backend/
  PetGest.slnx               (formato de solução padrão do .NET 10)
  global.json                (SDK 10.0.x, rollForward latestFeature)
  Directory.Build.props      (net10.0, Nullable, ImplicitUsings, TreatWarningsAsErrors)
  docker-compose.yml         (Postgres 17 de desenvolvimento)
  README.md
  Api/
    PetGest.Api.csproj       (RootNamespace PetGest.Api)
    Program.cs
    Endpoints/               (HealthEndpoints.cs)
    Services/                (vazia — .gitkeep)
    Data/                    (AppDbContext.cs)
    Models/                  (vazia — .gitkeep)
    appsettings.json / appsettings.Development.json
    Properties/launchSettings.json
  Api.Tests/
    PetGest.Api.Tests.csproj
```
O "projeto único" de §4.3/D5 é sobre a API não virar `Application/Domain/Infrastructure`; um projeto de testes ao lado não contraria isso e é onde a T-13 vai portar os casos de `rls_test.sql`. `TreatWarningsAsErrors` desde o início porque é barato num projeto vazio e caro de ligar depois.

Alternativa descartada: testes dentro do próprio projeto da API — mistura dependências de teste no binário publicado.

### D2. Minimal APIs em `Endpoints/`, não Controllers
Cada área vira um arquivo com um método de extensão (`app.MapHealthEndpoints()`, depois `MapProductEndpoints()` etc.) chamado no `Program.cs`. Para ~16 endpoints num domínio só (T-11 D5), minimal APIs são menos cerimônia, têm suporte nativo a OpenAPI e, no .NET 10, validação embutida de parâmetros.

Alternativa descartada: Controllers — também atende, mas traz filtros/atributos/convenções que o tamanho do projeto não pede. O `ROADMAPV1.md` já aceita as duas formas.

### D3. `/health` como endpoint minimal que usa o `HealthCheckService`
Registrar `AddHealthChecks().AddDbContextCheck<AppDbContext>()` e expor `GET /health` por um endpoint minimal que chama `HealthCheckService.CheckHealthAsync()` e devolve só o texto do status (`Healthy`/`Unhealthy`) com `200`/`503`.

- **Por que não `MapHealthChecks("/health")`:** os endpoints do middleware de health check não passam pelo ApiExplorer, então não entrariam no documento OpenAPI que a spec exige. O endpoint minimal entra, e fica em `Endpoints/`, validando o padrão de D2.
- `AddDbContextCheck` usa `CanConnectAsync` do EF — prova a cadeia inteira (configuração → `DbContext` → Npgsql → banco), que é o que a T-12 quer provar, sem precisar de nenhuma tabela.
- Corpo só com o status: nada de `exception`/`description` na resposta (a spec proíbe vazar conexão ou erro); o detalhe vai para o log.
- `AllowAnonymous` explícito no endpoint, para que a autenticação global da T-14 não o feche sem querer.

Alternativa descartada: pacote `AspNetCore.HealthChecks.NpgSql` (terceiro) — faria o mesmo sem passar pelo EF.

### D4. `AppDbContext` sem entidades, conexão por configuração
`AppDbContext : DbContext` vazio em `Data/`, registrado com `UseNpgsql(builder.Configuration.GetConnectionString("Default"))`. Sem string de conexão configurada, a API falha na inicialização com mensagem dizendo qual chave falta — mesmo espírito do `supabaseClient.ts` do V0.

A string de desenvolvimento fica em `appsettings.Development.json` (credenciais só do contêiner local, sem valor fora da máquina). `appsettings.json` não tem string de conexão: em qualquer outro ambiente ela vem de variável de ambiente (`ConnectionStrings__Default`), que é como a T-17 vai injetá-la no App Service.

### D5. Postgres local: Docker Compose, `postgres:17`, porta `5450` no host
`backend/docker-compose.yml` com um serviço `db` (`postgres:17`), usuário/senha/banco `petgest`/`petgest_dev`/`petgest`, volume nomeado para persistir entre reinícios e `healthcheck` com `pg_isready`.

- **Versão 17:** mesma major do Supabase de produção (17.6) — evita que a T-13 use algo que só existe no 18.
- **Porta 5450 no host:** `5432`–`5434` e `5440` já estão em uso por contêineres de outros projetos (a 5433 do plano original também estava); uma porta própria evita conflito sem mexer neles. O CI usa o mesmo mapeamento, então a mesma string de conexão serve nos dois lugares.

### D6. CORS por configuração: lista exata + padrão de prévia
Seção `Cors` na configuração:
```json
"Cors": {
  "AllowedOrigins": [ "https://pet-gest.vercel.app", "http://localhost:5183" ],
  "AllowedOriginPatterns": [ "^https://pet-gest-[a-z0-9-]+-<escopo>\\.vercel\\.app$" ]
}
```
Uma política padrão com `SetIsOriginAllowed(origem => exata || casa algum padrão)`, `AllowAnyHeader`, `AllowAnyMethod` e **sem** `AllowCredentials` (a spec proíbe; o JWT da T-14 vai no cabeçalho `Authorization`). As listas vêm da configuração para a T-17 sobrescrever por ambiente.

- **Prévias:** a Vercel gera `pet-gest-<hash>-<escopo>.vercel.app` e `pet-gest-git-<branch>-<escopo>.vercel.app`, onde `<escopo>` é o slug da conta/time na Vercel. Ancorar o padrão no sufixo `-<escopo>.vercel.app` impede aceitar prévias de outros projetos; `*.vercel.app` inteiro seria aceitar qualquer site hospedado na Vercel.
- `localhost:5183` fica na lista base porque a porta é fixa (`strictPort`) no Vite; em produção a T-17 pode retirá-la sobrescrevendo a lista.

### D7. OpenAPI nativo + Swagger UI, só em Development
`AddOpenApi()` (pacote `Microsoft.AspNetCore.OpenApi`, OpenAPI 3.1 no .NET 10) com `MapOpenApi()` em `/openapi/v1.json`, e `Swashbuckle.AspNetCore.SwaggerUI` servindo a interface em `/swagger` apontando para esse documento. Os dois só são mapeados quando `IsDevelopment()`; em outro ambiente as rotas não existem (`404`, como a spec pede). A T-16 gera os tipos TypeScript contra a API local, então produção não precisa servir o contrato.

Alternativa descartada: Swashbuckle completo (gerador + UI) — o gerador nativo é o padrão desde o .NET 9 e o Swashbuckle ficaria só pela UI. Scalar seria outra UI possível; Swagger UI mantém o nome que o roadmap usa.

### D8. Testes: xUnit + `WebApplicationFactory<Program>` contra Postgres real
`Api.Tests` sobe a API em memória e cobre os cenários da spec:
- saúde com banco no ar (`200 Healthy`) e com banco inalcançável — string de conexão sobrescrita para `Host=127.0.0.1;Port=1` com timeout curto (`503 Unhealthy`, corpo sem detalhes);
- CORS: produção, `localhost:5183`, uma URL no formato de prévia, origem desconhecida, prévia de outro projeto, *preflight* `OPTIONS` e ausência de `Allow-Credentials`;
- OpenAPI: `200` com `/health` no documento em Development, `/swagger` carrega, e `404` para os dois com o ambiente `Production`.

O teste "banco no ar" precisa do contêiner do D5 rodando (local) ou do serviço do CI. Testcontainers foi descartado nesta etapa: mais uma dependência e Docker dentro do teste, quando o compose e o serviço do Actions já dão o mesmo Postgres 17. A T-13 pode rever isso se precisar de bancos isolados por teste.

Se o `Program` gerado pelas *top-level statements* não ficar visível para o projeto de testes, adicionar `public partial class Program;` no fim do `Program.cs`.

### D9. GitHub Actions: build + teste, sem deploy
`.github/workflows/backend.yml`:
- gatilhos `push` e `pull_request` para `dev` e `main`, com `paths: [backend/**, .github/workflows/backend.yml]` — mudanças só no frontend não disparam;
- `ubuntu-latest`, `actions/setup-dotnet` lendo `backend/global.json`;
- serviço `postgres:17` com as mesmas credenciais do compose e porta `5450:5432`, com `--health-cmd pg_isready`;
- `dotnet restore`, `dotnet build --no-restore -c Release`, `dotnet test --no-build -c Release` em `backend/`.

É o primeiro workflow do repositório; a T-17 acrescenta o job de deploy nele ou num arquivo ao lado.

## Risks / Trade-offs

- [Padrão de prévia amplo demais ou errado] → ancorado no sufixo `-<escopo>.vercel.app`; testes com uma URL de outro projeto garantem que não passa. O `<escopo>` real é conferido na Vercel antes de fechar a tarefa. CORS não é autenticação: mesmo se uma origem indevida passar, sem JWT (T-14) ela não lê dados.
- [Portas comuns do Postgres ocupadas por outros projetos na máquina] → compose na 5450 (D5); se ela também ficar ocupada, trocar em `docker-compose.yml`, `appsettings.Development.json`, `ApiFactory` e no workflow.
- [Health check com banco lento segura a requisição] → timeout curto na string de conexão do teste; o timeout de produção é ajustado na T-17 junto com a health check do App Service.
- [Pacotes .NET 10 / EF Core 10 / Npgsql 10 com versões recentes] → fixar as versões estáveis mais novas no momento da implementação; o CI pega incompatibilidade no primeiro push.
- [Credenciais de desenvolvimento versionadas] → só valem para o contêiner local e o serviço do CI; nenhuma credencial do Supabase ou de produção entra no repositório (T-17 usa as configurações do App Service).

## Migration Plan

Nada a migrar e nenhum efeito em produção: `backend/` não é publicado e a Vercel continua com Root Directory `frontend`. Rollback é reverter os commits da T-12.

## Open Questions

- Slug do escopo da Vercel usado no padrão de prévia (D6) — lido no painel da Vercel durante a implementação; muda só um valor de configuração.
