## Why

No V0, quem garante que um petshop nunca vê nem altera os dados de outro é o RLS do Postgres, amarrado ao `auth.uid()` do Supabase Auth. No V1 a API conecta com um papel que ignora RLS (T-11, D2), então essa garantia precisa passar para a API **antes** de existir qualquer endpoint de dados (T-15) ou login (T-14). A T-12 deixou o `AppDbContext` vazio de propósito; agora ele precisa ter as tabelas do V0, as mesmas regras e o isolamento por petshop, provados por testes.

## What Changes

- Entidades EF Core `Petshop`, `Product` e `Profile` (vínculo usuário → petshop) em `backend/Api/Data/`, mapeadas com os **mesmos nomes** de tabelas, colunas, índices e constraints de `supabase/schema.sql`, para que na T-18 o banco de produção seja só marcado como já migrado, sem recriar nada.
- Migrations EF versionadas: uma que reproduz o schema do V0 e outra com o que o V1 acrescenta em `products`:
  - `source` passa a aceitar também `photo_ai` e `voice_ai` (os valores `barcode` e `manual` do V0 continuam válidos);
  - coluna `JSONB` para a resposta bruta da IA, nula para `barcode`/`manual`.
- As mesmas invariantes do V0, garantidas pelo banco: EAN único por petshop (ignorando `NULL`), preço `>= 0`, nome/categoria não vazios, EAN com 8 a 14 dígitos e `updated_at` automático.
- **Isolamento por petshop na API:** um contexto da requisição com o usuário e o petshop lidos das *claims* do token (o token em si é emitido na T-14); filtro global de consulta no `AppDbContext` e uma verificação na gravação que preenche o petshop dos produtos novos e recusa gravar, mover ou apagar dados de outro petshop, ou trocar o próprio vínculo.
- Testes de integração contra Postgres real portando os casos de `supabase/tests/rls_test.sql`.
- Ferramenta `dotnet-ef` como ferramenta local do repositório; `backend/README.md` com como aplicar as migrations.
- **Fica para a T-14** (registrado no `ROADMAPV1.md`): as tabelas do Identity no schema `identity` e a FK de `profiles.id` para elas. Nesta etapa `profiles.id` não tem FK para nenhuma tabela de usuários.
- Nenhum endpoint novo e nenhuma mudança no frontend nem no projeto Supabase.

## Capabilities

### New Capabilities
- `api-tenant-data`: dados de cada petshop guardados pela API do V1 — isolamento por petshop feito pela API (leitura e gravação), vínculo usuário → petshop imutável, invariantes do produto, origem do produto com a resposta bruta da IA e schema versionado compatível com o banco do V0.

### Modified Capabilities
<!-- nenhuma — tenant-data continua descrevendo o V0 em produção (garantia pelo RLS); é reconciliada com api-tenant-data na T-18 -->

## Impact

- **Arquivos novos:** entidades, configurações EF, contexto da requisição e interceptador de gravação em `backend/Api/Data/`; `backend/Api/Data/Migrations/`; `backend/.config/dotnet-tools.json`; testes em `backend/Api.Tests/`.
- **Arquivos alterados:** `backend/Api/Data/AppDbContext.cs`, `backend/Api/Program.cs`, `backend/Api/PetGest.Api.csproj`, `backend/README.md`, `ROADMAPV1.md`, `CLAUDE.md`.
- **Dependências novas (NuGet):** `Microsoft.EntityFrameworkCore.Design` (só em tempo de desenvolvimento) e `EFCore.NamingConventions`; ferramenta `dotnet-ef`.
- **Banco:** só o Postgres local do Docker Compose e o serviço do CI (banco de testes separado do de desenvolvimento). O projeto Supabase não é tocado: produção segue no V0 (T-11, riscos).
- **Workflow do CI:** sem mudança esperada; os testes novos rodam no mesmo serviço `postgres:17`.
