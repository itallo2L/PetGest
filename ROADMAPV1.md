# ROADMAPV1 — Roadmap de implementação do V1 (fase futura)

> Quebra a **fase futura** de `PLANOMVP.md` §4 (ASP.NET Core + Identity/JWT
> + Azure) e os entregáveis "Futuro" de §5 em conjuntos de tarefas
> numerados, no mesmo formato do `ROADMAPV0.md`.
>
> A numeração **continua a do V0** (`T-11` em diante), para que as pastas
> em `openspec/changes/` nunca colidam com as do V0 já arquivadas:
>
> ```
> openspec/changes/T-1X-<slug-da-tarefa>/
> ```

## Quando começar

**Ainda não.** Conforme `PLANOMVP.md` §4.5 e o `CLAUDE.md`, a stack do V0
(Supabase + Vercel) continua sendo onde todo o desenvolvimento acontece
até que **as duas condições** abaixo sejam verdadeiras:

1. **V0 fechado:** T-10 arquivada, com o teste no iPhone registrado e o
   `ROADMAPV0.md` marcando o V0 como concluído.
2. **Pelo menos um gatilho de §4.5 presente**, registrado na T-11:
   - lógica de negócio complexa demais para caber bem em RLS/RPC;
   - foto+IA / voz+IA precisando de orquestração no servidor que uma
     função SQL não comporta;
   - necessidade de controle de infraestrutura que o Supabase não oferece
     (processamento assíncrono pesado, jobs agendados complexos);
   - volume de uso que justifique manter uma API própria.

Até lá, este documento é só planejamento. Nenhuma pasta `backend/` nem
dependência .NET entra no repositório antes da T-11 aprovada.

## Ordem e dependências

```
T-11 ──> T-12 ──> T-13 ──> T-14 ──> T-15 ──> T-16 ──> T-17 ──> T-18 ──┬──> T-19 ──┐
                                                                        └──> T-20 ──┴──> T-21
```

- **Paridade antes de novidade:** T-12 a T-18 trocam o backend sem mudar
  o que o usuário vê — o app faz exatamente o que o V0 faz, agora sobre a
  API própria. Só depois disso entram foto+IA (T-19) e voz+IA (T-20).
- T-19 e T-20 são independentes entre si e podem correr em paralelo.
- T-18 (virada da produção) e T-21 (teste de campo) têm o mesmo papel que
  T-09/T-10 no V0: nenhuma mudança fica "pronta" sem celular real.

## O que não muda (vale do V0 para o V1)

Decisões de `PLANOMVP.md` §2, válidas nas duas fases:

- Frontend React + TypeScript + Vite (SPA), sem Next.js (§2.1).
- Scanner com o pacote `barcode-detector` e digitação manual como
  alternativa obrigatória (§2.2).
- Banco PostgreSQL; índice único `(petshop_id, ean)` ignorando
  `ean IS NULL` (§2.3).
- Um petshop por usuário, papel único — sem permissões granulares
  (§3.9, §4.2).
- Escopo de telas do V0 (`PLANOMVP.md` §3.8): estoque, estoque mínimo,
  fornecedores, relatórios, dashboard, situação, preço de custo, unidade
  de medida e SKU **continuam fora**. O V1 muda a arquitetura e adiciona
  formas de cadastro, não reabre o sistema de estoque.

---

## T-11 — Decisões de entrada do V1

Formaliza, numa change só de design (sem código), as escolhas que o
`PLANOMVP.md` deixa para "o momento da migração".

- Registrar qual gatilho de §4.5 motivou o V1 e a evidência (uso real,
  pedido de petshop, limite atingido no Supabase).
- **Banco:** Azure Database for PostgreSQL (tier burstable) ou manter o
  Postgres do Supabase só como banco (§5 "Futuro": "a decidir no momento
  da migração").
- **Autenticação:** ASP.NET Core Identity + JWT (recomendação de §4.2) ou
  manter um provedor externo (Supabase Auth, Clerk, Auth0) — §4.2 pede
  para reavaliar.
- **Usuários existentes:** como migrar as contas do Supabase Auth
  (importar os hashes bcrypt com um `IPasswordHasher` compatível ou pedir
  redefinição de senha no primeiro acesso).
- **Estrutura do backend:** projeto único com pastas (§4.3) — confirmar
  que o número de casos de uso ainda não justifica separar em
  `Api/ Application/ Domain/ Infrastructure/`.
- **Provedor de IA** para foto e voz (OpenAI, Azure OpenAI ou Google, via
  SDK oficial em C# — §4.1), com estimativa de custo por cadastro.
- Atualizar o `CLAUDE.md` (stack ativa passa a ser a do V1) só quando esta
  change for aprovada.
- Depende de: V0 concluído.
- Ref: `PLANOMVP.md` §4.1, §4.2, §4.5, §5.

## T-12 — Scaffold do backend ASP.NET Core

Cria a pasta `backend/` definitiva, sem regra de negócio, e prova o
caminho de build e deploy antes de qualquer tela depender dela.

- `backend/Api/` com um único projeto ASP.NET Core Web API, pastas
  `Endpoints/` (ou `Controllers/`), `Services/`, `Data/`, `Models/`
  (§4.3).
- EF Core com `Npgsql` apontando para um Postgres local (§2.3).
- OpenAPI/Swagger ligado — base para gerar os tipos TypeScript do
  frontend (§4.1).
- Endpoint de saúde (`/health`) e CORS liberado só para as origens do
  frontend (produção, prévias da Vercel, `localhost:5183`).
- `frontend/` e `backend/` continuam independentes para deploy (§4.3).
- Depende de: T-11.
- Ref: `PLANOMVP.md` §4.1, §4.3.

## T-13 — Modelo de dados e isolamento por petshop na API

Reproduz em EF Core o que `supabase/schema.sql` garante hoje, trocando o
papel do RLS por regras da API.

- Entidades `Petshop` e `Product` e o vínculo usuário → petshop (o que
  hoje é `profiles`), com migrations EF versionadas.
- Mesmas invariantes do V0: índice único `(PetshopId, Ean)` filtrado
  por `Ean IS NOT NULL`, preço `>= 0`, `UpdatedAt` automático.
- `Source` passa a aceitar `Barcode | Manual | PhotoAI | VoiceAI` (§4.3);
  valores do V0 (`barcode`, `manual`) continuam válidos.
- Coluna `JSONB` para guardar a resposta bruta da IA ao lado dos campos
  confirmados (§2.3) — nula para `Barcode`/`Manual`.
- **Isolamento:** o `PetshopId` vem sempre do token, nunca do corpo da
  requisição; filtro global de consulta no `DbContext` por petshop — o
  equivalente ao "nunca filtrar `petshop_id` na query" do V0.
- Testes de integração portando os casos de `supabase/tests/rls_test.sql`
  (ler/gravar em outro petshop, trocar o próprio vínculo, anônimo).
- Depende de: T-12.
- Ref: `PLANOMVP.md` §2.3, §3.2 (invariantes), §4.3.

## T-14 — Autenticação com Identity + JWT

Substitui o Supabase Auth, mantendo o comportamento que as specs `auth` e
`tenant-data` do V0 exigem.

- Cadastro atômico de usuário + petshop numa transação — sucessor da
  função `signup_petshop` (§3.1: "detalhe de implementação, não mudança
  de arquitetura").
- Login devolvendo JWT (e refresh token), logout, papel único (§4.2).
- Rate limit simples no login com o middleware nativo (§4.2).
- Recuperação de senha e **confirmação de e-mail** — pendência herdada do
  V0 (`PLANOMVP.md` §3.3, §3.9), agora pelo Identity e com envio de
  e-mail real.
- Sem 2FA nem rate limiting elaborado nesta fase (§4.2).
- Depende de: T-13.
- Ref: `PLANOMVP.md` §4.2, `openspec/specs/auth/`, `openspec/specs/tenant-data/`.

## T-15 — Endpoints de produtos e da loja

Expõe na API tudo o que o frontend do V0 faz hoje direto no Supabase.

- Produtos: listar, criar, editar, excluir e buscar por EAN (desfechos do
  scanner: já cadastrado / não encontrado, sem base externa — §3.4).
- Código repetido na loja devolve conflito dizendo a qual produto
  pertence (mesma mensagem da spec `products`).
- Loja: consultar e salvar nome, e-mail de contato e telefone.
- DTOs em `Models/`, incluindo o contrato **`ProductDraft`** (nome,
  categoria, preço, ean opcional, `Source`) que o scanner, a foto e a voz
  vão produzir (§4.3).
- Depende de: T-14.
- Ref: `PLANOMVP.md` §3.4, §4.3, specs `products`, `product-scanning`,
  `store-settings`.

## T-16 — Frontend consumindo a API

Troca o "backend" do frontend sem mudar nenhuma tela.

- Criar `shared/apiClient.ts` (único cliente HTTP do app, no lugar de
  `shared/supabaseClient.ts`) com o JWT anexado e renovação de sessão.
- Tipos TypeScript gerados do OpenAPI da API (§4.1).
- Portar `features/auth`, `products`, `petshop` e a busca do scanner para
  o cliente novo; remover `@supabase/supabase-js`.
- Variável `VITE_API_URL` no lugar de `VITE_SUPABASE_URL` /
  `VITE_SUPABASE_ANON_KEY`.
- Todas as specs do V0 continuam valendo — reexecutar o `roteiro.md` da
  T-10 contra a API local como critério de paridade.
- Depende de: T-15.
- Ref: `PLANOMVP.md` §4.3, `roteiro.md` da T-10 (em
  `openspec/changes/archive/` depois do fechamento do V0).

## T-17 — Deploy do backend no Azure

- Backend em **Azure App Service** (tier gratuito/básico), HTTPS padrão,
  CI/CD via GitHub Actions (§4.4).
- Banco conforme a decisão da T-11 (Azure Database for PostgreSQL tier
  burstable, ou o Postgres do Supabase).
- Segredos (string de conexão, chave de assinatura do JWT, chave da IA)
  só nas configurações do App Service — nunca no frontend nem na Vercel.
- Frontend continua na Vercel (§4.4 permite); prévia da `dev` apontando
  para um ambiente de teste da API.
- Nada de Kubernetes, filas, Redis ou Elasticsearch (§4.4).
- Depende de: T-16.
- Ref: `PLANOMVP.md` §4.4.

## T-18 — Migração dos dados e virada da produção

- Script de migração do Supabase para o banco novo: `petshops`,
  vínculos e `products` (preservando `source`, `created_at`,
  `updated_at`).
- Usuários conforme a decisão da T-11 (hash importado ou redefinição de
  senha); comunicar os petshops antes da virada.
- Janela de virada: Supabase em somente leitura → migração → conferência
  de contagens por petshop → deploy da `main` com `VITE_API_URL` de
  produção.
- Rollback: "Instant Rollback" na Vercel para o deploy do V0 enquanto o
  Supabase não for desligado.
- Teste de campo de paridade (roteiro da T-10) em Android e iPhone, em
  produção.
- Desligar o projeto Supabase só depois de um período de observação.
- Depende de: T-17.
- Ref: `PLANOMVP.md` §5 "Futuro", `CLAUDE.md` §Testes.

## T-19 — Cadastro de produto por foto + IA

- Frontend: botão "Foto" no cadastro de produto, captura pela câmera
  (mesma permissão e HTTPS do scanner).
- API: endpoint `multipart/form-data` que recebe a imagem, chama o
  serviço de visão/LLM (`async`/`await`, sem fila — §4.3), valida a
  resposta e devolve um `ProductDraft` com `Source = PhotoAI`.
- O rascunho abre **na mesma tela de confirmação** que o scanner já usa;
  o usuário revisa antes de gravar (§4.3).
- Resposta bruta da IA gravada no `JSONB` do produto (§2.3).
- Fila/webhook só se o volume real mostrar necessidade (§4.3).
- Depende de: T-18.
- Ref: `PLANOMVP.md` §2.3, §4.1, §4.3.

## T-20 — Cadastro de produto por voz + IA

- Frontend: gravação de áudio com `MediaRecorder` no cadastro de produto
  (§2.1).
- API: endpoint `multipart/form-data` que recebe o áudio, transcreve,
  extrai os campos e devolve um `ProductDraft` com `Source = VoiceAI`.
- Mesma tela de confirmação, mesma gravação da resposta bruta em `JSONB`.
- Depende de: T-18 (independente da T-19).
- Ref: `PLANOMVP.md` §2.1, §4.1, §4.3.

## T-21 — Teste ponta a ponta em campo e fechamento do V1

- Estender o roteiro da T-10 com foto+IA e voz+IA (embalagens reais,
  ambiente de petshop com ruído) e rodar em Android e iPhone, em
  produção, com rede móvel.
- Medir tempo de resposta e acerto dos campos sugeridos pela IA, e o
  custo real por cadastro contra a estimativa da T-11.
- Qualquer problema vira ajuste pontual na tarefa de origem, não tarefa
  nova (mesma regra do V0).
- Fecha o V1: arquivar as changes T-11 a T-21 e marcar o V1 como
  concluído aqui.
- Depende de: T-19 e T-20.
- Ref: `CLAUDE.md` §Testes.

---

## Ideias fora do V1 (sem tarefa)

Citadas no `PLANOMVP.md` como possibilidades, sem decisão tomada — entram
num roadmap próprio só se o uso real pedir:

- **PWA** (manifest + service worker, `vite-plugin-pwa`) para "adicionar à
  tela inicial" (§2.1: "incremental, não precisa decidir agora").
- **Offline / conexão ruim no petshop:** fila local de produtos
  escaneados esperando sincronizar (§3.9).
- **Múltiplos funcionários por petshop:** o modelo já permite vários
  usuários no mesmo petshop sem migration (§3.9), mas o papel continua
  único.
- **Busca por similaridade** ("produtos parecidos com esta foto") com
  `pgvector` (§2.3).
- **SDK comercial de leitura** (Dynamsoft, Scandit) no lugar do
  `barcode-detector`, trocando só o adaptador (§2.2).
- **Base de referência de produtos do setor** (catálogo externo que
  preencha nome/categoria pelo EAN) — infraestrutura própria, fora do V0
  e do V1 (§3.4).
