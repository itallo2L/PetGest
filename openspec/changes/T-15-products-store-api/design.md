## Context

Motivação em `proposal.md`; comportamento exigido em `specs/api-products/spec.md` e `specs/api-store/spec.md`.

- **API hoje (T-12 a T-14):**
  - `AppDbContext` com filtros globais por petshop/usuário e o `TenantWriteGuard`, que preenche o petshop de produtos novos e lança `TenantViolationException` em gravação indevida;
  - JWT com `sub`/`petshop_id`, lido pelo `ClaimsTenantContext`; todo endpoint protegido por padrão, com uma auditoria das rotas públicas em `ProtectedEndpointTests`;
  - erros de `/auth` em `ProblemDetails` + `code` (`AuthError`); validação embutida dos DTOs (`AddValidation()`).
- **O que o frontend do V0 faz hoje:**
  - `productsApi.ts`: lista tudo, paginando de 1000 em 1000 por limitação do PostgREST, ordenado por `name` e `id`; busca por EAN com `maybeSingle`; insert com `source`; update sem `source`; delete;
  - `petshopApi.ts`: `select` e `update` da própria loja;
  - `CompleteSignupPage`: `signup_petshop` para conta autenticada sem loja;
  - busca, filtro e ordenação por categoria são feitos **no cliente** sobre a lista inteira (spec `products`, T-06).
- **Banco (T-13):** `products` com checks de nome/categoria/preço/EAN, índice único `(petshop_id, ean)` filtrado e `updated_at` por trigger; `price numeric(10,2)`; categoria é texto livre (as 7 categorias são do frontend, `categories.ts`, que inclusive preserva categorias fora da lista).

## Goals / Non-Goals

**Goals:**
- A T-16 troca cada chamada do `productsApi.ts`/`petshopApi.ts`/`signup_petshop` por uma chamada à API, sem mudar tela nem regra.
- Isolamento sem exceção: nenhum endpoint recebe petshop do cliente, e recurso de outra loja é indistinguível de recurso inexistente (`404`).
- Erros com `code` estável para o frontend mapear às mensagens que já existem.

**Non-Goals:**
- Busca, filtro, ordenação por categoria e paginação no servidor. O V0 faz isso no cliente, e uma loja tem centenas de produtos, não milhões. Revisitar se o uso real pedir.
- Cadastro com origem `photo_ai`/`voice_ai` e gravação da resposta bruta da IA (T-19/T-20).
- Mudanças no schema (nenhuma migration).

## Decisions

### D1. Serviços finos sobre o `AppDbContext` filtrado
`ProductService` e `PetshopService` em `Services/` usam o `AppDbContext` sem filtrar petshop à mão, porque os filtros globais da T-13 já restringem tudo:
- "inexistente" e "de outra loja" caem no mesmo `null`, que vira `404 product_not_found` / `petshop_not_found`;
- edição e exclusão **carregam pelo filtro** e depois alteram (`Remove` na exclusão), em vez de `ExecuteUpdate`/`ExecuteDelete`, para passar pelo `TenantWriteGuard` como o README da T-13 pede.

Resultado no mesmo estilo da T-14: um `ApiError` com status, `code`, título e, opcionalmente, erros por campo ou dados extras. O `AuthError` da T-14 passa a ser um uso desse mesmo tipo, para não haver dois formatos de erro, sem mudar os `code` já existentes.

### D2. DTOs: `ProductDraft` como corpo do cadastro
Em `Models/`:
- **`ProductDraft`** (nome, categoria, preço, EAN opcional, origem opcional) é o corpo de `POST /products`, e também o contrato que foto e voz vão produzir (§4.3). `Source` aceita só `barcode`/`manual` (`[AllowedValues]`); a T-19 amplia junto com a resposta bruta da IA.
- **`ProductUpdate`** (nome, categoria, preço, EAN) é o corpo do `PUT`. A origem fica como estava, como no V0, onde o update não envia `source`.
- **`ProductResponse`** traz `id`, `name`, `category`, `price`, `ean`, `source`, `updatedAt`.
- **`PetshopRequest`** (nome, e-mail, telefone) serve para `PUT` e `POST /petshop`; a resposta é **`PetshopResponse`** (`id`, `name`, `email`, `phone`).

Nenhum DTO de entrada tem `petshopId`; um campo extra no JSON é ignorado pelo desserializador, o que cumpre o cenário "petshop informado no corpo é ignorado".

Validação:
- **No DTO (DataAnnotations):** `Required` (rejeita só espaços), `MaxLength`, `Range` do preço, `RegularExpression(^\d{8,14}$)` no EAN (aceita vazio), `EmailAddress`.
- **No serviço:** casas decimais do preço (`decimal.Scale` depois de normalizado), trims e EAN vazio → `null`.

O texto da origem (`barcode`, `manual`, `photo_ai`, `voice_ai`) sai de um só lugar: a conversão que o `ProductConfiguration` da T-13 já tem passa para extensões do enum (`ProductSource.ToWire()`/`FromWire()`), usadas pelo EF e pelos DTOs.

### D3. Conflito de EAN com o produto dono do código
Antes de gravar, o serviço procura, pelo filtro da loja, um produto com o mesmo EAN e `id` diferente. Se existir, responde `409 ean_taken` com `product: { id, name }` como dado extra do `ProblemDetails`, para a T-16 montar a mensagem "O código … já pertence a {nome}".

Dois cadastros simultâneos passam pela verificação; nesse caso o índice único lança `23505`, o serviço captura, procura de novo o dono e responde o mesmo `409`.

Alternativa descartada: só capturar o `23505`. Funciona, mas cada conflito comum (o caso normal do scanner) viraria uma transação abortada mais uma consulta.

### D4. Busca por EAN como rota própria
`GET /products/by-ean/{ean}` com a validação de 8–14 dígitos no próprio endpoint (`400` sem consulta). Não é `GET /products?ean=` porque os desfechos são diferentes: busca por chave devolve `200` ou `404`, enquanto a listagem devolve sempre `200` com lista. É exatamente o "já cadastrado" ou "não encontrado" do scanner.

### D5. Loja: `GET`/`PUT /petshop` e `POST /petshop` para conta sem loja
- **`GET`:** `Petshops.SingleOrDefault()` pelo filtro; sem petshop no token → `404 petshop_not_found`.
- **`PUT`:** carrega pelo filtro, aplica os trims (telefone vazio → `null`) e grava. Um identificador no corpo nem existe no DTO.
- **`POST`:**
  1. conta sem usuário no token → `401`, que a política de fallback já garante;
  2. confere se já existe vínculo (`Profiles.AnyAsync()`, que o filtro restringe ao usuário) → `409 petshop_exists`;
  3. senão cria `Petshop` + `Profile` numa transação — o `TenantWriteGuard` já permite inserir os dois;
  4. um `23505` na PK de `profiles` (duas chamadas simultâneas) vira o mesmo `409`.

O token da chamada continua sem `petshop_id`. A resposta `201` traz `sessionRenewalRequired: true`, e a renovação da T-14 relê o vínculo, então o token seguinte já traz a loja (spec). Não devolvemos uma sessão nova direto porque isso exigiria o refresh token, que não vem nessa chamada.

### D6. `TenantViolationException` → `403`
Um `IExceptionHandler` registrado com `AddProblemDetails()` + `UseExceptionHandler()` traduz a exceção para `403` com `code: tenant_violation`.

Pelos endpoints da T-15 ela não deveria acontecer: o caso esperado, cadastro de produto por conta sem petshop, é conferido antes no serviço e responde `403 petshop_required` (spec). O tratador é a rede de segurança para qualquer caminho futuro, em vez de um `500`.

### D7. Testes pela API
Em `Api.Tests/Catalog/` (`ProductsApiTests`, `ProductLookupTests`, `PetshopApiTests`), usando o `AuthApi` da T-14 com dois métodos novos: chamada autenticada com token e corpo JSON, e criação de lojas A/B por cadastro.
- Cada cenário da spec vira um teste, incluindo os de isolamento por HTTP: A não lê, edita nem exclui produto de B (`404`), e o identificador de outra loja no corpo é ignorado.
- O `ProtectedEndpointTests` passa a conferir que as rotas novas existem e **não** estão na lista de públicas. A auditoria já pega isso sozinha, e a lista explícita documenta.

## Risks / Trade-offs

- [Lista inteira sem paginação] → paridade com o V0 (que já carrega tudo). Uma loja com milhares de produtos ainda cabe numa resposta. Paginação e busca no servidor ficam como melhoria quando o uso real pedir; o contrato de hoje não impede acrescentar `?page=` depois.
- [Categoria livre na API] → aceito: é o que o banco já aceita e o frontend preserva categorias fora da lista. Restringir na API quebraria produtos existentes com outra categoria.
- [`POST /petshop` deixa o token desatualizado até a renovação] → explícito na resposta (`sessionRenewalRequired`) e documentado para a T-16, que já renova sessão.
- [`409` revela o nome de um produto] → só produtos da própria loja, pelo filtro. Um código que existe só em outra loja é aceito e nunca é revelado.

## Migration Plan

Sem migration e sem efeito em produção. Rollback: reverter os commits.
