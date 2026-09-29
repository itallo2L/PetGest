# PetGest — backend

API do PetGest **V1** (ASP.NET Core, .NET 10), em desenvolvimento. A produção
(`pet-gest.vercel.app`) continua no V0, sobre o Supabase, até a T-18 — esta API
ainda não é publicada nem se conecta ao banco de produção. Decisões em
[`PLANOMVP.md`](../PLANOMVP.md) §4 e etapas em [`ROADMAPV1.md`](../ROADMAPV1.md).

## Pré-requisitos

- .NET SDK 10 (a versão mínima está em [`global.json`](global.json))
- Docker (para o Postgres de desenvolvimento)

## Rodar localmente

Na pasta `backend/`:

```bash
docker compose up -d --wait     # Postgres 17 em localhost:5450
dotnet run --project Api        # API em http://localhost:5080
```

| Endereço | O que é |
|---|---|
| `http://localhost:5080/health` | `200 Healthy` com o banco no ar; `503 Unhealthy` sem ele |
| `http://localhost:5080/swagger` | Swagger UI (só em Development) |
| `http://localhost:5080/openapi/v1.json` | Documento OpenAPI (só em Development) — base dos tipos TypeScript da T-16 |

O Postgres usa a porta **5450** no host porque as portas mais comuns
(5432–5434) costumam estar ocupadas por outros projetos. Para zerar o banco:
`docker compose down -v`.

## Testes

```bash
docker compose up -d --wait
dotnet test
```

Os testes sobem a API em memória e usam o mesmo Postgres do compose. No GitHub
Actions ([`.github/workflows/backend.yml`](../.github/workflows/backend.yml)) o
banco é um serviço `postgres:17` na mesma porta; o workflow roda em push e PR
para `dev` e `main` quando algo em `backend/` muda. Não há deploy ainda (T-17).

## Estrutura

```text
backend/
  Api/                  projeto único ASP.NET Core (minimal APIs)
    Endpoints/          um arquivo por área, com MapXxxEndpoints()
    Services/           regras de negócio (a partir da T-13)
    Data/               AppDbContext, entidades e migrations (entidades na T-13)
    Models/             DTOs de request/response
  Api.Tests/            xUnit + WebApplicationFactory
  docker-compose.yml    Postgres 17 de desenvolvimento
```

## Configuração

| Chave | Onde fica | Para quê |
|---|---|---|
| `ConnectionStrings:Default` | `appsettings.Development.json` (só o banco local) | Postgres da API. Sem ela a API não sobe |
| `Cors:AllowedOrigins` | `appsettings.json` | Origens exatas do frontend: produção e `http://localhost:5183` |
| `Cors:AllowedOriginPatterns` | `appsettings.json` | Regex das prévias da Vercel do projeto (`pet-gest-…-itallo2ls-projects.vercel.app`) |

Fora de Development, os valores vêm de variáveis de ambiente (é assim que a
T-17 vai configurar o App Service), com `__` no lugar de `:`:

- `ConnectionStrings__Default`
- `Cors__AllowedOrigins__0`, `Cors__AllowedOrigins__1`, …
- `Cors__AllowedOriginPatterns__0`, …

> **Nunca** versione a string de conexão do Supabase ou qualquer segredo de
> produção. A única credencial no repositório é a do contêiner local.
