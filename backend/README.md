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
docker compose up -d --wait               # Postgres 17 em localhost:5450
dotnet tool restore                       # dotnet-ef, na versão do EF Core da API
dotnet ef database update --project Api   # cria/atualiza as tabelas no banco `petgest`
dotnet run --project Api                  # API em http://localhost:5080
```

A API **não** aplica migrations ao subir: rode `dotnet ef database update`
sempre que puxar uma migration nova.

| Endereço | O que é |
|---|---|
| `http://localhost:5080/health` | `200 Healthy` com o banco no ar; `503 Unhealthy` sem ele |
| `http://localhost:5080/swagger` | Swagger UI (só em Development) |
| `http://localhost:5080/openapi/v1.json` | Documento OpenAPI (só em Development) — base dos tipos TypeScript da T-16 |

O Postgres usa a porta **5450** no host porque as portas mais comuns
(5432–5434) costumam estar ocupadas por outros projetos. Para zerar o banco:
`docker compose down -v`.

## Banco e migrations

As tabelas `petshops`, `profiles` e `products` são as mesmas do V0
([`supabase/schema.sql`](../supabase/schema.sql)), com os **mesmos nomes** de
colunas, índices e constraints — na T-18 o banco de produção só registra a
migration `V0Schema` como aplicada. Migrations em `Api/Data/Migrations/`:

| Migration | O que faz |
|---|---|
| `V0Schema` | O schema do V0, sem o que depende do Supabase (RLS, `grant`s, `auth.uid()`, FK para `auth.users`) |
| `ProductSourceAi` | `source` aceita `photo_ai`/`voice_ai`; coluna `ai_raw_response jsonb` (só para origens de IA) |

Para mudar o modelo: altere a entidade/configuração em `Api/Data/` e gere a
migration:

```bash
dotnet ef migrations add NomeDaMudanca --project Api --output-dir Data/Migrations
dotnet ef database update --project Api
```

Todo nome de constraint/índice novo fica explícito na configuração (o padrão é
o que o Postgres geraria: `<tabela>_<coluna>_check`, `_fkey`, `_key`, `_idx`).
`created_at`, `updated_at` e os ids são preenchidos pelo banco (default +
trigger `products_set_updated_at`).

## Isolamento por petshop

A API conecta com um papel que ignora o RLS do V0, então quem isola os dados de
cada petshop é ela (design da T-13 em
`openspec/changes/T-13-api-data-model/design.md`, D4–D5):

- **De onde vem o petshop:** só das claims do token — `sub` (usuário) e
  `petshop_id` (`ClaimsTenantContext`). Nunca do corpo, rota ou query.
- **Leitura:** filtros globais no `AppDbContext` — produtos e loja do petshop do
  token, vínculo do próprio usuário. Sem petshop (anônimo ou sem vínculo), nada.
  **Não** filtre `PetshopId` à mão nas consultas.
- **Gravação:** o `TenantWriteGuard` preenche o petshop dos produtos novos e
  lança `TenantViolationException` ao gravar, mover ou excluir dados de outro
  petshop, ou trocar o vínculo usuário → petshop. `PetshopId` de produto é token
  de concorrência: um `UPDATE`/`DELETE` só alcança linhas do petshop do token.

Cuidados:

- `IgnoreQueryFilters()` desliga o isolamento — só no cadastro (T-14) e em testes.
- `ExecuteUpdate`/`ExecuteDelete` e SQL cru não passam pelo `TenantWriteGuard`.
  Não use em `products` sem o filtro de petshop.

## Testes

```bash
docker compose up -d --wait
dotnet test
```

Os testes sobem a API em memória e usam o mesmo Postgres do compose, em bancos
próprios (recriados a cada execução):

| Banco | Para quê |
|---|---|
| `petgest` | o de desenvolvimento — só os testes de `/health` se conectam nele, sem gravar |
| `petgest_tests` | testes de isolamento e invariantes (`Api.Tests/Data/`) |
| `petgest_v0` | `supabase/schema.sql` aplicado sobre um stub do Supabase (`Api.Tests/Sql/`) — ensaio da T-18 |
| `petgest_v0_ef` | só a migration `V0Schema`, comparada com `petgest_v0` pelo catálogo |

Se `supabase/schema.sql` mudar sem uma migration correspondente, o
`SchemaCompatibilityTests` falha. No GitHub
Actions ([`.github/workflows/backend.yml`](../.github/workflows/backend.yml)) o
banco é um serviço `postgres:17` na mesma porta; o workflow roda em push e PR
para `dev` e `main` quando algo em `backend/` muda. Não há deploy ainda (T-17).

## Estrutura

```text
backend/
  Api/                  projeto único ASP.NET Core (minimal APIs)
    Endpoints/          um arquivo por área, com MapXxxEndpoints()
    Services/           regras de negócio
    Data/               AppDbContext, isolamento por petshop (ClaimsTenantContext, TenantWriteGuard)
      Entities/         Petshop, Profile, Product
      Configurations/   mapeamento EF com os nomes do schema do V0
      Migrations/       V0Schema, ProductSourceAi
    Models/             DTOs de request/response
  Api.Tests/            xUnit + WebApplicationFactory; Data/ com os testes de banco
  .config/              dotnet-tools.json (dotnet-ef)
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
