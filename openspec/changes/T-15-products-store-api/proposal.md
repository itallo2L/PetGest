## Why

A API já identifica o usuário (T-14) e isola os dados por petshop (T-13), mas ainda não expõe dado nenhum. Tudo o que o frontend do V0 faz hoje direto no Supabase (`productsApi.ts`, `petshopApi.ts` e o `signup_petshop` da tela de concluir cadastro) precisa existir como endpoint da API. Sem isso, a T-16 não tem para onde portar o frontend.

## What Changes

- **Produtos:**
  - `GET /products` lista todos os produtos da loja, ordenados por nome;
  - `GET /products/{id}` e `GET /products/by-ean/{ean}` — a busca do scanner, com os dois desfechos do V0: já cadastrado ou não encontrado;
  - `POST /products`, `PUT /products/{id}` e `DELETE /products/{id}`.
- **Código repetido na loja:** responde `409` dizendo a qual produto o código pertence, como a mensagem da spec `products` do V0.
- **Contrato `ProductDraft`** (nome, categoria, preço, EAN opcional, origem) em `Models/`: é o que o scanner produz agora e o que foto e voz vão produzir nas T-19/T-20 (`PLANOMVP.md` §4.3). Nesta etapa o cadastro aceita só as origens `barcode` e `manual`; `photo_ai` e `voice_ai` chegam com os endpoints de IA, que também gravam a resposta bruta.
- **Loja:**
  - `GET /petshop` e `PUT /petshop` consultam e salvam nome, e-mail de contato e telefone;
  - `POST /petshop` cria a loja para uma conta autenticada que ainda não tem uma, que é a paridade com a tela de concluir cadastro do V0 (`CompleteSignupPage` + `signup_petshop`) e o caminho das contas sem vínculo previstas na T-14.
- **Tradução do isolamento para HTTP:**
  - recurso de outro petshop responde `404`, sem revelar que existe;
  - gravação recusada pelo `TenantWriteGuard` (por exemplo, sem petshop no token) responde `403`, com `ProblemDetails` + `code` como na T-14.
- Nenhuma mudança no frontend nem no projeto Supabase. A busca, o filtro e a ordenação por categoria continuam no cliente, como no V0.

## Capabilities

### New Capabilities
- `api-products`: catálogo de produtos da loja pela API do V1 — listar, consultar, buscar por código de barras (desfechos do scanner), cadastrar, editar e excluir, com validação, conflito de código por loja e origem do cadastro.
- `api-store`: dados da loja pela API do V1 — consultar e salvar nome, e-mail de contato e telefone, e criar a loja para uma conta que ainda não tem uma.

### Modified Capabilities
<!-- nenhuma — products, product-scanning e store-settings (changes abertas do V0) e tenant-data continuam descrevendo a produção; api-tenant-data não muda: os endpoints só usam o isolamento que ela já garante -->

## Impact

- **Arquivos novos:**
  - `backend/Api/Endpoints/ProductEndpoints.cs` e `PetshopEndpoints.cs`;
  - `backend/Api/Services/ProductService.cs` e `PetshopService.cs`;
  - DTOs em `backend/Api/Models/`;
  - um tratador de exceção para `TenantViolationException`;
  - testes em `backend/Api.Tests/Catalog/`.
- **Arquivos alterados:**
  - `Program.cs` (mapeamento dos endpoints e tratador de exceção);
  - `ProtectedEndpointTests` (as rotas novas são protegidas, nenhuma entra na lista de públicas);
  - `backend/README.md`, `ROADMAPV1.md`, `CLAUDE.md`.
- **Banco:** sem migration. As tabelas e invariantes são as da T-13.
- **Dependências:** nenhuma nova.
- **Produção:** nenhum efeito.
