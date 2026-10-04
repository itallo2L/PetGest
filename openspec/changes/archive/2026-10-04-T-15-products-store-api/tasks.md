## 1. Base comum

- [x] 1.1 Generalizar o `AuthError` da T-14 num `ApiError` (status, `code`, título, erros por campo, dados extras), sem mudar os `code` nem as respostas de `/auth`; mover a conversão da origem para extensões do enum (`ToWire`/`FromWire`) usadas pelo `ProductConfiguration` (design D1, D2); verificar que `dotnet build` passa sem avisos, que `has-pending-model-changes` não acusa nada e que a suíte existente (119) continua verde
- [x] 1.2 Registrar `AddProblemDetails()` + um `IExceptionHandler` que traduz `TenantViolationException` para `403` com `code: tenant_violation` e `UseExceptionHandler()` (design D6); verificar com um teste que força a exceção (contexto com tenant de outro petshop gravando via serviço) que a resposta é `403` em `ProblemDetails`, não `500`

## 2. Produtos

- [x] 2.1 Criar os DTOs `ProductDraft`, `ProductUpdate` e `ProductResponse` em `Models/` com as validações do design D2 e o `ProductService` (listar ordenado por nome/id, consultar, buscar por EAN, cadastrar com `petshop_required` quando o token não tem loja, editar mantendo a origem, excluir carregando pelo filtro, casas decimais do preço, trims, EAN vazio → `null`, conflito `ean_taken` com `{id, name}` antes de gravar e no `23505`) (design D1–D3); verificar que `dotnet build` passa sem avisos
- [x] 2.2 Criar `Endpoints/ProductEndpoints.cs` (`GET /products`, `GET /products/{id}`, `GET /products/by-ean/{ean}` com `400` para código fora de 8–14 dígitos, `POST`, `PUT /products/{id}`, `DELETE /products/{id}`), todos protegidos, com `Produces`/`ProducesProblem` para o OpenAPI (design D4); verificar com a API rodando, pelo Swagger com *Authorize*, um cadastro, a busca pelo código, um `409` de código repetido mostrando o produto dono e a exclusão

## 3. Loja

- [x] 3.1 Criar `PetshopRequest`/`PetshopResponse`, o `PetshopService` e `Endpoints/PetshopEndpoints.cs` (`GET`/`PUT /petshop` com `404 petshop_not_found` para conta sem loja; `POST /petshop` criando loja + vínculo numa transação, `409 petshop_exists`, `201` com `sessionRenewalRequired: true`) (design D5); verificar pelo Swagger a consulta, a alteração do nome e, com uma conta sem loja, a criação seguida de `/auth/refresh` devolvendo token com `petshop_id`

## 4. Testes

- [x] 4.1 Acrescentar ao `AuthApi` a chamada autenticada com token e corpo JSON; escrever `ProductsApiTests` cobrindo listagem (só da loja, ordem por nome, vazia, sem token `401`), consulta (`200`/`404` igual para outra loja e inexistente), cadastro (sem código, com `barcode`, petshop no corpo ignorado, `photo_ai` → `400`, conta sem loja → `403 petshop_required`), validação (preço negativo, 3 casas, acima do limite, nome em branco, nome > 200, código `12345`, categoria livre aceita), conflito (`409 ean_taken` com id e nome no cadastro e na edição, mesmo código em outra loja aceito, manter o próprio código), edição (`200` com preço e `updatedAt` novos, origem mantida, outra loja `404` sem alterar) e exclusão (`204`, outra loja `404` sem excluir); verificar que passam
- [x] 4.2 Escrever `ProductLookupTests` (código da loja `200`, código só em outra loja `404`, código cadastrado por outro "aparelho" — outro cliente da mesma conta — encontrado, código inválido `400`) e `PetshopApiTests` (consultar, alterar nome e consultar de novo, telefone vazio → sem telefone, id de outra loja no corpo não altera B, e-mail da loja trocado sem afetar o login, nome vazio e e-mail `contato@` → `400`, conta sem loja `404` no `GET`/`PUT`, `POST` em conta sem loja `201` + refresh com `petshop_id`, `POST` em conta com loja `409 petshop_exists`); atualizar o `ProtectedEndpointTests` com as rotas novas; verificar que passam e que **remover o filtro global de `Product` faz testes de isolamento da T-15 falharem** (conferir e desfazer)
- [x] 4.3 Rodar a suíte inteira e fazer push na `dev`; verificar que fica verde localmente e no workflow `backend.yml` do GitHub Actions — _verificado em 2026-10-04: 171/171 local; workflow `backend.yml` verde no commit ebe90bc_

## 5. Documentação

- [x] 5.1 Atualizar `backend/README.md` (endpoints de produtos e loja, formato de `ProductResponse`/`PetshopResponse`, `409 ean_taken` com o produto dono, `sessionRenewalRequired` do `POST /petshop`, novos `code`), `ROADMAPV1.md` (status da T-15; na T-16, o mapa de cada chamada do `productsApi.ts`/`petshopApi.ts`/`signup_petshop` para o endpoint novo e a renovação depois do `POST /petshop`) e `CLAUDE.md`; verificar seguindo o README pelo Swagger do zero
