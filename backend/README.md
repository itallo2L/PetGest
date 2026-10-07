# PetGest — backend

API do PetGest **V1** (ASP.NET Core, .NET 10), em desenvolvimento. A produção
(`pet-gest.vercel.app`) continua no V0, sobre o Supabase, até a T-18 — esta API
não se conecta ao banco de produção antes disso. Publicação no Azure App Service:
[`DEPLOY.md`](DEPLOY.md) (T-17). Decisões em
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

Segredos de desenvolvimento ficam **fora do repositório**, no `user-secrets` (só em
Development). Para ligar o cadastro por foto e voz (T-19/T-20) localmente:

```bash
dotnet user-secrets set "Ai:OpenAI:ApiKey" "sk-..." --project Api
```

Qualquer configuração também pode ir na linha de comando, depois de `--`. Por
exemplo, para os links dos e-mails abrirem no celular pela rede local:
`dotnet run --project Api -- --Auth:FrontendBaseUrl=https://<ip>:5183`.

| Endereço | O que é |
|---|---|
| `http://localhost:5080/health` | `200 Healthy` com o banco no ar; `503 Unhealthy` sem ele |
| `http://localhost:5080/swagger` | Swagger UI (só em Development) — botão *Authorize* para colar o token de acesso |
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
| `IdentitySchema` | Schema `identity`: contas do Identity (`users`, `user_claims`, `user_logins`, `user_tokens`) e `refresh_tokens` |
| `ProfilesUserFk` | FK de `profiles.id` para `identity.users` (troca a do V0 para `auth.users`, se existir) |
| `DataProtectionKeys` | `identity.data_protection_keys`: chaves que assinam os links enviados por e-mail, persistidas entre reinícios e deploys (T-17) |

Na T-18, a importação das contas do Supabase acontece **entre** `IdentitySchema` e
`ProfilesUserFk` — a ordem é ensaiada pelo `SchemaCompatibilityTests`.

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
`openspec/changes/archive/2026-10-03-T-13-api-data-model/design.md`, D4–D5):

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

## Autenticação

Contas do ASP.NET Core Identity com sessão por JWT (design da T-14 em
`openspec/changes/archive/2026-10-04-T-14-identity-jwt/design.md`). **Todo endpoint exige token**,
a não ser os marcados com `AllowAnonymous` — e o teste
`ProtectedEndpointTests.So_as_rotas_publicas_da_spec_dispensam_token` lista as
rotas públicas permitidas: rota nova sem token entra lá de propósito.

| Endpoint | Token | O que faz |
|---|---|---|
| `POST /auth/signup` | não | Conta + petshop + vínculo numa transação; devolve a sessão (`201`) |
| `POST /auth/login` | não | Abre uma sessão com e-mail e senha |
| `POST /auth/refresh` | não | Troca o refresh token por uma sessão nova (o usado deixa de valer) |
| `POST /auth/logout` | não | Revoga a linha de renovações do refresh token (sempre `204`) |
| `POST /auth/confirm-email` | não | Confirma o e-mail com `userId` + `code` do link |
| `POST /auth/resend-confirmation` | não | Reenvia o link de confirmação (`202` sempre; só envia para conta não confirmada) — T-22 |
| `POST /auth/forgot-password` | não | Envia o link de redefinição de senha, válido por 1 hora (`202` sempre) — T-22 |
| `POST /auth/reset-password` | não | Troca a senha com `userId` + `code` do link; confirma o e-mail e encerra as sessões — T-22 |
| `GET /auth/me` | sim | Usuário, e-mail, confirmação e petshop da sessão |

Sessão devolvida por cadastro, login e renovação:

```json
{ "accessToken": "…", "tokenType": "Bearer", "expiresIn": 900,
  "refreshToken": "…", "refreshTokenExpiresAt": "…" }
```

- **Token de acesso:** JWT HS256 de 15 minutos com `sub`, `email` e
  `petshop_id` (o que o isolamento lê). Vai no cabeçalho
  `Authorization: Bearer …`.
- **Refresh token:** opaco, 30 dias, guardado só como hash SHA-256. Cada uso
  gera um novo; reusar um token já trocado derruba todas as sessões daquela
  linha — o frontend precisa renovar **uma vez por vez** (T-16).
- **Erros:** `ProblemDetails` com a extensão `code` — `email_taken`,
  `weak_password`, `invalid_credentials`, `email_not_confirmed`,
  `invalid_refresh_token`, `invalid_confirmation`, `invalid_reset`. Formato inválido do corpo
  volta como `400` de validação.
- **E-mails (confirmação e redefinição de senha):** entregues ao `IEmailSender`
  escolhido por `Email:Provider`. Em desenvolvimento (`log`, o padrão), o link
  aparece **no console da API** (`E-mail (envio de desenvolvimento, não
  enviado)…`). Nos ambientes do Azure, `acs` envia pelo Azure Communication
  Services (T-22; configuração em [`DEPLOY.md`](DEPLOY.md)). A exigência de e-mail
  confirmado para entrar é `Auth:RequireConfirmedEmail`, desligada até a T-18.
- **Senhas do V0:** contas com hash bcrypt (importadas do Supabase Auth) entram
  normalmente e o hash é regravado no formato do Identity no primeiro login.
- **Limite de tentativas:** cadastro, login e confirmação aceitam
  `RateLimit:Auth:PermitLimit` chamadas por `WindowSeconds` por IP (`429`
  acima disso).

Para testar pelo Swagger: `POST /auth/signup` (ou `/login`), copie o
`accessToken`, clique em *Authorize*, cole o token e chame `GET /auth/me`.

## Produtos e loja

Tudo exige token, e a loja é sempre a do token (`petshop_id`) — nenhum
endpoint recebe petshop do cliente (design da T-15 em
`openspec/changes/archive/2026-10-04-T-15-products-store-api/design.md`). Recurso de outra loja
responde `404`, igual a um que não existe.

| Endpoint | O que faz |
|---|---|
| `GET /products` | Todos os produtos da loja, ordenados por nome (busca, filtro e ordenação por categoria ficam no cliente, como no V0) |
| `GET /products/{id}` | Um produto da loja (`404 product_not_found`) |
| `GET /products/by-ean/{ean}` | Busca do scanner: `200` com o produto da loja ou `404`; código fora de 8–14 dígitos → `400` |
| `POST /products` | Cadastra (`201`); corpo `ProductDraft`: `name`, `category`, `price`, `ean?`, `source?` (`barcode`/`manual`) |
| `PUT /products/{id}` | Substitui nome, categoria, preço e código; a origem não muda |
| `DELETE /products/{id}` | Exclui (`204`) |
| `GET /products/drafts/availability` | Se o cadastro por foto e por voz está disponível (provedor de IA configurado) — T-19 |
| `POST /products/drafts/photo` | Foto da embalagem (`multipart`, campo `image`) → rascunho `photo_ai` para o formulário — T-19 |
| `POST /products/drafts/voice` | Áudio (`multipart`, campo `audio`) → transcrição + rascunho `voice_ai` — T-20 |
| `GET /petshop` | Dados da loja: `id`, `name`, `email`, `phone` |
| `PUT /petshop` | Salva nome, e-mail de contato e telefone (vazio → sem telefone) |
| `POST /petshop` | Cria a loja de uma conta que ainda não tem (`201`, `sessionRenewalRequired: true`) |

Produto devolvido:

```json
{ "id": "…", "name": "Ração X 1kg", "category": "Ração", "price": 39.9,
  "ean": "7891000100103", "source": "barcode", "updatedAt": "…" }
```

- **Código repetido na loja:** `409` com `code: ean_taken` e o produto que já
  tem o código em `product: { id, name }`. O mesmo código em outra loja é
  aceito.
- **Validação:** nome (até 200) e categoria (até 100, texto livre) não vazios,
  preço de 0 a 99.999.999,99 com no máximo duas casas, código com 8 a 14
  dígitos — `400` indicando o campo.
- **Conta sem loja:** `GET`/`PUT /petshop` → `404 petshop_not_found`;
  `POST /products` → `403 petshop_required`. Depois do `POST /petshop`, renove a
  sessão (`/auth/refresh`) para o token passar a trazer a loja.
- **Outros `code`:** `product_not_found`, `petshop_exists`, `invalid_request`
  e `tenant_violation` (`403`, rede de segurança do isolamento).

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
| `petgest_tests` | isolamento e invariantes (`Api.Tests/Data/`), autenticação (`Api.Tests/Auth/`) e produtos/loja pela API (`Api.Tests/Catalog/`) |
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
    Endpoints/          um arquivo por área, com MapXxxEndpoints() (Health, Auth, Product, Petshop)
    Services/           regras de negócio (Auth, Session, Product, Petshop; ApiError para os erros com `code`)
    Data/               AppDbContext, isolamento por petshop (ClaimsTenantContext, TenantWriteGuard)
      Entities/         Petshop, Profile, Product, AppUser, RefreshToken
      Configurations/   mapeamento EF com os nomes do schema do V0
      Migrations/       V0Schema, ProductSourceAi, IdentitySchema, ProfilesUserFk
    Models/             DTOs de request/response
  Api.Tests/            xUnit + WebApplicationFactory; Data/ (banco), Auth/ (autenticação) e Catalog/ (produtos e loja)
  .config/              dotnet-tools.json (dotnet-ef)
  docker-compose.yml    Postgres 17 de desenvolvimento
```

## Configuração

| Chave | Onde fica | Para quê |
|---|---|---|
| `ConnectionStrings:Default` | `appsettings.Development.json` (só o banco local) | Postgres da API. Sem ela a API não sobe |
| `Cors:AllowedOrigins` | `appsettings.json` | Origens exatas do frontend: produção e `http://localhost:5183` |
| `Cors:AllowedOriginPatterns` | `appsettings.json` | Regex das prévias da Vercel do projeto (`pet-gest-…-itallo2ls-projects.vercel.app`) |
| `Jwt:SigningKey` | `appsettings.Development.json` (só um valor local) | Segredo de assinatura do JWT, mínimo 32 bytes. Sem ela a API não sobe |
| `Jwt:Issuer` / `Jwt:Audience` | `appsettings.json` | Emissor e audiência do JWT |
| `Auth:RequireConfirmedEmail` | `appsettings.json` (`false`) | Exige e-mail confirmado para entrar — ligar na T-18 |
| `Auth:FrontendBaseUrl` | `appsettings.json` | Base dos links enviados por e-mail |
| `RateLimit:Auth:PermitLimit` / `WindowSeconds` | `appsettings.json` (10 / 60) | Limite de tentativas nos endpoints públicos de `/auth` (menos renovação e logout) |
| `Email:Provider` | padrão `log` | `log` (console) ou `acs` (Azure Communication Services) — T-22 |
| `Email:AcsConnectionString` / `Email:Sender` | só no App Service | Credencial e remetente do ACS (com `acs`, sem elas a API não sobe) |
| `Ai:OpenAI:ApiKey` | só no App Service (ou `--Ai:OpenAI:ApiKey=` local) | Chave da OpenAI; sem ela, foto e voz ficam indisponíveis (`503 ai_unavailable`) — T-19 |
| `Ai:OpenAI:Model` / `TranscriptionModel` | padrão `gpt-4.1-mini` / `gpt-4o-mini-transcribe` | Modelos da foto/estruturação e da transcrição |
| `Ai:OpenAI:BaseUrl` | padrão `https://api.openai.com/v1/` | Endpoint compatível com a API da OpenAI (o ensaio local usou um servidor falso) |
| `RateLimit:Ai:PermitLimit` / `WindowSeconds` | padrão 20 / 60 | Extrações por IA por usuário |
| `ForwardedHeaders:Enabled` | padrão `false` | Lê o IP do cliente do `X-Forwarded-For` atrás do proxy do App Service — T-17 |

Fora de Development, os valores vêm de variáveis de ambiente (é assim que a
T-17 vai configurar o App Service), com `__` no lugar de `:`:

- `ConnectionStrings__Default`
- `Cors__AllowedOrigins__0`, `Cors__AllowedOrigins__1`, …
- `Cors__AllowedOriginPatterns__0`, …
- `Jwt__SigningKey` (segredo — gere um valor aleatório de 48+ caracteres por ambiente)
- `Auth__RequireConfirmedEmail`, `Auth__FrontendBaseUrl`
- `Email__Provider`, `Email__AcsConnectionString` (segredo), `Email__Sender`
- `Ai__OpenAI__ApiKey` (segredo), `Ai__OpenAI__Model`, `Ai__OpenAI__TranscriptionModel`
- `ForwardedHeaders__Enabled`

> **Nunca** versione a string de conexão do Supabase, a chave JWT de produção ou
> qualquer outro segredo. As únicas credenciais no repositório são as locais (o
> contêiner e a chave `dev-only-…`).
