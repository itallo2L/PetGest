## Why

O gatilho do V1 é o cadastro por foto e por voz com IA (T-11, D1). Hoje o dono do petshop cadastra digitando nome, categoria e preço, ou escaneando, mas o scanner só traz o código: o resto é digitado. Com a foto da embalagem, a IA lê nome, categoria e código, e o usuário só confere e completa o preço. Esta change entrega a foto e a base comum de IA que a voz (T-20) reaproveita.

## What Changes

- **Provedor de IA:** OpenAI, atrás do `IProductDraftExtractor` (T-11, D6). A escolha é **provisória**: o teste de bancada com embalagens reais, que a T-11 pede antes da escolha, não pôde ser feito nesta etapa e fica como tarefa do usuário (design D1). Trocar de provedor é trocar o adaptador e a configuração.
- **API:**
  - `GET /products/drafts/availability` diz se foto e voz estão disponíveis (provedor configurado);
  - `POST /products/drafts/photo` (`multipart/form-data`, campo `image`) devolve um rascunho com `source = photo_ai`. Os campos vêm normalizados: categoria só entre as sete, código só com dígito verificador válido, preço só se aparecer na foto.
- **Resposta bruta da IA no produto:** o rascunho fica guardado por 30 minutos; `POST /products` com `source = photo_ai` e o `draftId` grava a resposta bruta em `ai_raw_response`.
- **Cadastro aceita as origens de IA:** `photo_ai` e `voice_ai` deixam de ser recusadas em `POST /products`.
- **Limite de uso por usuário** nas chamadas de IA, para conter o custo; o limite de tentativas passa a rodar depois da autenticação.
- **Frontend (modo `api`):** bloco "Preencher com IA" no topo do formulário de cadastro, com o botão "Foto":
  - abre a câmera traseira e reduz a foto para JPEG de até 1600 px antes de enviar;
  - preenche os campos reconhecidos e mostra um aviso para conferir.
  
  O mesmo formulário é a tela de confirmação (`PLANOMVP.md` §4.3). Sem IA configurada, ou no modo `supabase`, o bloco não aparece.

## Capabilities

### New Capabilities
- `api-product-drafts`: rascunhos de produto sugeridos pela IA a partir de uma foto (e, na T-20, da voz), com disponibilidade, validação do arquivo, normalização, limite de uso e ligação com o produto salvo.
- `product-ai-capture`: cadastro de produto assistido por IA no frontend — preencher o formulário a partir de uma foto (e, na T-20, da voz) e salvar com a origem certa.

### Modified Capabilities
- `api-products`: o cadastro aceita as origens `photo_ai` e `voice_ai` e grava a resposta bruta da IA de um rascunho da mesma loja.

## Impact

- **Backend, arquivos novos:**
  - `Services/Ai/` (`AiSettings`, `IProductDraftExtractor`, `OpenAiProductDraftExtractor`, `DraftNormalizer`), `Services/ProductDraftService.cs`, `Models/DraftModels.cs`, `Endpoints/ProductDraftEndpoints.cs`, `AiSetup.cs`;
  - testes em `Api.Tests/Ai/`.
- **Backend, arquivos alterados:**
  - `ProductModels.cs` (`ProductDraft` com `DraftId` e origens de IA), `ProductService.cs`, `Program.cs` (ordem do rate limiter e mapeamento);
  - `ProductsApiTests` (origem de IA não é mais recusada), `ProtectedEndpointTests` e `AuthApi` (serviços substituíveis nos testes).
- **Frontend, arquivos novos:** `features/products/ai/` (`AiFill`, `photo.ts`, `aiHelpers.ts` + teste, `ai.css`), `shared/backend/api/drafts.ts` + teste; ícones `mic`, `stop` e `sparkles`.
- **Frontend, arquivos alterados:** `ProductFormModal`, `shared/backend/types.ts`/`errors.ts`, `api/client.ts` (envio de `FormData`), `api/catalog.ts`, `api/index.ts`, `api/testing.ts`, `schema.ts`.
- **Banco:** nenhuma migration (`photo_ai`/`voice_ai` e `ai_raw_response` existem desde a T-13).
- **Dependências:** nenhuma nova.
- **Configuração:** `Ai:OpenAI:ApiKey` (segredo, App Service), modelos e limites opcionais.
- **Produção:** nenhum efeito até a T-18 e até a chave ser configurada.
