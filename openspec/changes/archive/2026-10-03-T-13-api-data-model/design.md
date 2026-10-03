## Context

Motivação em `proposal.md`; comportamento exigido em `specs/api-tenant-data/spec.md`.

- **API hoje (T-12):** `backend/Api/` com `AppDbContext` vazio (`UseNpgsql` com `ConnectionStrings:Default`), `/health`, CORS e OpenAPI; testes em `Api.Tests/` com `ApiFactory` (`WebApplicationFactory<Program>`) contra o Postgres 17 do Docker Compose (`localhost:5450`, banco `petgest`); o CI sobe o mesmo Postgres como serviço. Pacotes EF Core / Npgsql 10. `TreatWarningsAsErrors` ligado.
- **Banco do V0** (`supabase/schema.sql`): `petshops`, `profiles` e `products` em `public`, com checks inline (nomes automáticos do Postgres: `products_price_check`, `products_ean_check`, `products_source_check`…), índice único parcial `products_petshop_ean_key`, índice `profiles_petshop_id_idx`, trigger `products_set_updated_at`. Partes que dependem do Supabase: FK `profiles.id → auth.users(id)`, default `products.petshop_id = current_petshop_id()` (que lê `auth.uid()`), RLS, `grant`s para `anon`/`authenticated` e a função `signup_petshop`.
- **Decisões herdadas (T-11):** mesmo banco do V0 (D2); a API usa um papel com `bypassrls`, então o isolamento é da API (D2); usuários do Identity com o mesmo `Guid` de `auth.users` (D4); tabelas do Identity no schema `identity` (D2); antes da T-18 a API só roda contra banco de desenvolvimento/teste.
- **Casos a portar** (`supabase/tests/rls_test.sql`): cadastro cai no próprio petshop; EAN repetido no mesmo petshop / permitido entre petshops / vários sem EAN; B só vê os próprios produtos, petshop e vínculo; busca por EAN isolada; insert com `petshop_id` alheio, mover produto, update/delete de produto alheio; trocar o próprio vínculo; atualizar a própria loja; `updated_at` automático; usuário sem petshop e anônimo sem acesso.

## Goals / Non-Goals

**Goals:**
- Qualquer consulta escrita nas T-14/T-15 já sai isolada por petshop sem o autor lembrar de filtrar, e qualquer gravação indevida falha antes de chegar ao banco.
- A migration inicial descreve o banco do V0 com fidelidade suficiente para a T-18 só registrar que ela já foi aplicada em produção.
- Testes que falham se alguém remover o filtro, o interceptador ou uma constraint.

**Non-Goals:**
- Identity, tabelas `identity.*`, emissão e validação de JWT, cadastro atômico (sucessor de `signup_petshop`) — T-14.
- Endpoints, DTOs, `ProductDraft`, tradução de erros para HTTP (`403`/`404`/`409`) — T-15.
- Papel `petgest_api`, aplicar migrations em ambiente publicado, pooler — T-17.
- Qualquer mudança no projeto Supabase ou em `supabase/schema.sql` — T-18.

## Decisions

### D1. Entidades com os nomes do V0, nomes de constraints explícitos
Entidades em `Data/Entities/` (`Petshop`, `Profile`, `Product`) e uma `IEntityTypeConfiguration<T>` por entidade em `Data/Configurations/`. Nomes de colunas em *snake_case* pelo `EFCore.NamingConventions` (`UseSnakeCaseNamingConvention()`), e **todo nome que o Postgres gerou no V0 fica explícito** na configuração: tabelas (`petshops`, `profiles`, `products`), PKs (`petshops_pkey`…), FKs (`profiles_petshop_id_fkey`, `products_petshop_id_fkey`), índices (`products_petshop_ean_key` com filtro `ean IS NOT NULL`, `profiles_petshop_id_idx`) e checks (`petshops_name_check`, `petshops_email_check`, `products_name_check`, `products_category_check`, `products_price_check`, `products_ean_check`, `products_source_check`), com o mesmo SQL de `schema.sql`.

Tipos: `Guid` (`uuid`), `decimal` com `HasPrecision(10, 2)` (`numeric(10,2)`), `DateTimeOffset` (`timestamptz`), `text` sem tamanho. Defaults do banco iguais aos do V0 (`gen_random_uuid()`, `now()`, `'manual'`). FKs com `ON DELETE CASCADE`, como no V0.

- **Por quê:** na T-18 o banco de produção já tem essas tabelas. Se os nomes baterem, a migration inicial é só registrada em `__EFMigrationsHistory` e as seguintes rodam normalmente; se não baterem, a primeira migration que mexer numa constraint quebra em produção.
- Alternativa descartada: mapeamento manual de cada coluna com `HasColumnName` — o mesmo resultado com mais código; a convenção cobre colunas e os nomes que não seguem convenção ficam explícitos. Se o pacote não tiver versão compatível com o EF Core 10 instalado, voltar para `HasColumnName` (mesma saída SQL).

### D2. Duas migrations: `V0Schema` e `ProductSourceAi`
- **`V0Schema`:** as três tabelas como em `schema.sql`, mais a função `set_updated_at()` e o trigger `products_set_updated_at` via `migrationBuilder.Sql` (idênticos ao V0). **Fora** dela, por dependerem do Supabase: FK para `auth.users`, default `current_petshop_id()`, RLS, `grant`s e `signup_petshop`.
- **`ProductSourceAi`:** troca `products_source_check` para `source in ('barcode','manual','photo_ai','voice_ai')`, adiciona `ai_raw_response jsonb null` e o check `products_ai_raw_response_check` (`ai_raw_response is null or source in ('photo_ai','voice_ai')`).

Separadas porque são coisas diferentes na T-18: a primeira já existe em produção (só registrar), a segunda é mudança real — compatível com o V0, que só grava `barcode`/`manual` sem a coluna nova.

Migrations em `Data/Migrations/`; `__EFMigrationsHistory` no schema `public` (padrão). A API **não** aplica migrations ao subir: em desenvolvimento, `dotnet ef database update`; nos testes, a fixture aplica (D6); em ambiente publicado, decisão da T-17.

### D3. Datas e ids continuam sendo do banco
`created_at` com `ValueGeneratedOnAdd` e `updated_at` com `ValueGeneratedOnAddOrUpdate`, ambos com default `now()`; o trigger do V0 reescreve `updated_at` em todo `UPDATE`. O EF não envia essas colunas e lê o valor de volta pelo `RETURNING`. Ids de `petshops` e `products`: default `gen_random_uuid()` no banco, como no V0 — o EF deixa o banco gerar quando o id não é informado e lê de volta. `profiles.id` nunca é gerado: é o id do usuário.

Alternativa descartada: preencher `UpdatedAt` num interceptador do EF — duplicaria o trigger que precisa continuar existindo em produção enquanto o V0 grava no mesmo banco, e um `UPDATE` fora da API ficaria sem a regra.

### D4. Contexto da requisição: `ITenantContext` a partir das claims
Interface em `Data/` com `Guid? UserId` e `Guid? PetshopId`. Implementação `ClaimsTenantContext` (scoped) lê `HttpContext.User` pelo `IHttpContextAccessor`:
- usuário: claim `sub` (ou `ClaimTypes.NameIdentifier`, conforme o mapeamento de claims que a T-14 configurar);
- petshop: claim `petshop_id`;
- valor ausente ou que não é `Guid` → `null`. Sem `HttpContext` (fora de requisição) → ambos `null`.

A T-14 só precisa emitir essas duas claims no JWT e ligar a autenticação; nada daqui muda. O petshop vem do token e não de uma consulta a `profiles` por requisição, como o roadmap pede; isso é seguro porque o vínculo é imutável (D5).

Alternativa descartada: resolver o petshop consultando `profiles` pelo `sub` a cada requisição — uma consulta a mais por chamada para proteger contra um caso (vínculo trocado) que a própria API proíbe.

### D5. Isolamento: filtro global na leitura, interceptador na gravação
**Leitura.** `AppDbContext` recebe o `ITenantContext` e expõe `CurrentPetshopId`/`CurrentUserId` como propriedades. Filtros globais:
- `Product`: `PetshopId == CurrentPetshopId`
- `Petshop`: `Id == CurrentPetshopId`
- `Profile`: `Id == CurrentUserId`

Os filtros referenciam **propriedades do próprio `DbContext`**, que o EF parametriza por instância; referenciar uma variável capturada congelaria o valor do primeiro contexto no modelo em cache. Com `null`, `PetshopId == null` não casa com nenhuma linha (colunas `NOT NULL`), o que cobre sem petshop e anônimo.

**Gravação.** `TenantWriteGuard : SaveChangesInterceptor` (em `Data/`), rodando em `SavingChanges`/`SavingChangesAsync`, percorre o `ChangeTracker` e lança `TenantViolationException` (sem gravar nada) quando:
- `Product` **Added**: sem petshop na requisição → recusa; `PetshopId` vazio → preenche com o da requisição; `PetshopId` diferente → recusa;
- `Product` **Modified/Deleted**: valor **original** de `PetshopId` diferente do da requisição, ou `PetshopId` alterado → recusa;
- `Petshop` **Modified/Deleted**: `Id` diferente do da requisição → recusa;
- `Profile` **Modified**: `PetshopId` alterado → recusa (sempre, para qualquer usuário);
- `Petshop`/`Profile` **Added**: permitido — o cadastro atômico da T-14 é quem cria os dois; decidir quem pode chamar esse cadastro é da T-14.

O valor original importa porque o filtro de leitura não cobre entidades anexadas à mão (`Attach`/`Update`/`Remove` com um objeto montado pelo chamador). Mas num objeto anexado à mão o "original" é o que o chamador informou: um produto de A anexado dizendo ser de B passaria pelo interceptador. Por isso `Product.PetshopId` é também **token de concorrência** (decidido na implementação): `UPDATE`/`DELETE` saem com `WHERE id = … AND petshop_id = <original>`, o banco não encontra a linha de A e o EF lança `DbUpdateConcurrencyException`. Não muda o schema. `TenantViolationException` fica em `Data/`; a T-15 traduz para HTTP.

Alternativa descartada: só o filtro global, confiando que os serviços sempre carregam antes de gravar — um `Update(entidade)` montado a partir do corpo da requisição gravaria em outro petshop sem passar pelo filtro. Alternativa descartada: manter o RLS e fazer a API setar `request.jwt.claims` por conexão — mantém o banco amarrado ao formato do Supabase, que a T-18 desmonta, e complica o pool de conexões.

### D6. `profiles` sem FK para usuários até a T-14
Nesta etapa `profiles.id` é só a PK (`uuid`), sem FK: `auth.users` não existe no Postgres local e as tabelas do Identity só nascem na T-14. A T-14 cria o schema `identity`, as tabelas do Identity e uma migration que adiciona `profiles_id_fkey → identity.users(id)` (o nome exato da tabela de usuários é da T-14). O `ROADMAPV1.md` é atualizado: o item "a FK de `profiles.id` troca…" sai da T-13 e vai para a T-14.

Alternativa descartada: fazer o `AppDbContext` herdar de `IdentityDbContext` já agora só para ter a tabela de usuários — traz o Identity inteiro (pacotes, tabelas, configuração) para uma tarefa que não autentica ninguém.

### D7. Testes de integração com banco próprio e um ensaio da T-18
Uma *collection fixture* do xUnit (`DatabaseFixture`) usa o mesmo Postgres do compose/CI, num banco separado `petgest_tests`: no início da execução, `EnsureDeleted` + `Migrate` (o usuário `petgest` do contêiner pode criar bancos). Cada teste cria os próprios petshops com `Guid`s novos, então os testes não dependem de ordem nem de limpeza. Os testes usam `AppDbContext` com um `ITenantContext` fixo (classe de teste simples, sem HTTP) — o caminho das claims tem testes unitários próprios com `ClaimsPrincipal` montado. O semeio (petshops e vínculos de A, B e C) usa um contexto com tenant `null`, que pode inserir `Petshop`/`Profile` (D5).

Arquivos: `TenantIsolationTests` (leitura e gravação, portados de `rls_test.sql`), `ProductInvariantTests` (checks, EAN, origem/IA, `updated_at`), `TenantContextTests` (claims), `SchemaCompatibilityTests`.

**`SchemaCompatibilityTests`** — o ensaio da T-18, automático no CI:
1. cria o banco `petgest_v0`, aplica um *stub* mínimo do Supabase (`Api.Tests/Sql/supabase-stub.sql`: schema `auth`, `auth.users(id uuid primary key)`, `auth.uid()` devolvendo `null`, papéis `anon`/`authenticated` se não existirem) e depois o próprio `supabase/schema.sql` lido do repositório;
2. compara, pelo catálogo (`information_schema.columns`, `pg_constraint`, `pg_indexes`), as três tabelas de `petgest_v0` com as de um banco migrado só até `V0Schema` — mesmas colunas, tipos, nulidade, defaults (exceto `products.petshop_id`), índices e checks, ignorando a FK para `auth.users`;
3. registra `V0Schema` em `__EFMigrationsHistory` de `petgest_v0`, roda `Migrate` e confere que `ProductSourceAi` aplica sem erro sobre o banco do V0 com uma linha `barcode` já gravada.

Alternativa descartada: Testcontainers (um contêiner por execução) — o compose e o serviço do CI já dão o Postgres 17; um banco por propósito no mesmo servidor isola o suficiente. Comparar por `pg_dump` + `diff` — depende do binário `pg_dump` na máquina e no runner, e a saída muda com detalhes irrelevantes (ordem, comentários).

### D8. Ferramenta `dotnet-ef` local ao repositório
`backend/.config/dotnet-tools.json` com `dotnet-ef` na mesma versão do EF Core, e `Microsoft.EntityFrameworkCore.Design` com `PrivateAssets=all` na API. Assim `dotnet tool restore` basta numa máquina nova e a versão da ferramenta não diverge da biblioteca.

## Risks / Trade-offs

- [Nome de constraint ou tipo diferente do V0 passa despercebido] → `SchemaCompatibilityTests` compara pelo catálogo e roda no CI a cada push em `backend/**`.
- [`schema.sql` mudar no V0 (correção da T-10) sem a migration acompanhar] → o mesmo teste lê o `schema.sql` do repositório e quebra; a correção vira uma migration nova.
- [Consulta com `IgnoreQueryFilters()` vazar dados] → regra: só o cadastro da T-14 e testes podem usá-la; revisar na T-14/T-15 com uma busca por `IgnoreQueryFilters` no código da API.
- [SQL cru (`FromSql`, `ExecuteUpdate`/`ExecuteDelete`) contorna o interceptador] → `ExecuteUpdate`/`ExecuteDelete` respeitam o filtro de consulta mas não passam pelo `SaveChanges`; não usar para `products` sem incluir o filtro. Registrado no `backend/README.md` junto com o modelo de isolamento.
- [Divergência entre o banco de desenvolvimento e produção por causa dos objetos do Supabase] → aceitável e listada (D2); a T-18 remove de produção o que depende de `auth.uid()` e adiciona a FK da T-14.
- [`EFCore.NamingConventions` atrasado em relação ao EF Core 10] → alternativa de D1 (mapeamento explícito), sem efeito no SQL gerado.

## Migration Plan

Nada vai para produção nesta change. Em desenvolvimento: `docker compose up -d`, `dotnet tool restore`, `dotnet ef database update --project Api`. Efeito na T-18 (detalhado lá, ensaiado pelo `SchemaCompatibilityTests`): registrar `V0Schema` como aplicada no banco de produção e aplicar `ProductSourceAi` e as migrations da T-14. Rollback desta change: reverter os commits; o banco local pode ser recriado com `docker compose down -v`.
