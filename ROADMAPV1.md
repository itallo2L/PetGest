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

**Começou em 2026-09-29, com uma exceção registrada na T-11.** A regra
original pedia **as duas condições** abaixo antes de qualquer tarefa do V1:

1. **V0 fechado:** T-10 arquivada, com o teste no iPhone registrado e o
   `ROADMAPV0.md` marcando o V0 como concluído.
2. **Pelo menos um gatilho de §4.5 presente**, registrado na T-11:
   - lógica de negócio complexa demais para caber bem em RLS/RPC;
   - foto+IA / voz+IA precisando de orquestração no servidor que uma
     função SQL não comporta;
   - necessidade de controle de infraestrutura que o Supabase não oferece
     (processamento assíncrono pesado, jobs agendados complexos);
   - volume de uso que justifique manter uma API própria.

A condição 2 está atendida: foto/voz + IA precisando de orquestração no
servidor (T-11, D1). A condição 1 **não**: o teste no iPhone da T-10
espera um aparelho disponível. Exceção consciente (T-11, D1):

- o V1 começa em paralelo à T-10, que continua aberta e é a única dona
  do fechamento do V0;
- defeitos achados no iPhone são corrigidos no V0 (changes T-05 a T-09),
  não no V1;
- **a T-18 (virada da produção) não começa antes de a T-10 ser
  arquivada** — T-12 a T-17 não tocam produção.

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

**Status:** aprovada em 2026-09-29 (`openspec/changes/T-11-v1-entry-decisions/`).
Decisões: gatilho foto/voz + IA, V1 em paralelo à T-10 (D1); banco =
Postgres do projeto Supabase, só como banco (D2); ASP.NET Core Identity +
JWT (D3); usuários importados com o hash bcrypt e re-hash no login (D4);
projeto único com pastas, .NET 10 (D5); provedor de IA em aberto, escolhido
no início da T-19 (D6).

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
- Depende de: V0 concluído — dispensado pela exceção de D1 (ver "Quando
  começar").
- Ref: `PLANOMVP.md` §4.1, §4.2, §4.5, §5.

## T-12 — Scaffold do backend ASP.NET Core

Cria a pasta `backend/` definitiva, sem regra de negócio, e prova o
caminho de build e deploy antes de qualquer tela depender dela.

**Status:** concluída e arquivada em 2026-09-29 (`openspec/changes/archive/2026-09-29-T-12-backend-scaffold/`, spec `api-platform`).
`backend/Api/` (.NET 10, minimal APIs) com `GET /health` checando o banco,
CORS por configuração (produção, prévias `pet-gest-…-itallo2ls-projects.vercel.app`
e `localhost:5183`), OpenAPI + Swagger UI só em Development e `AppDbContext`
vazio; Postgres 17 local via Docker Compose (porta 5450); 18 testes em
`backend/Api.Tests/`; GitHub Actions com build + testes, sem deploy — o
deploy no Azure fica todo na T-17.

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

**Status:** concluída e arquivada em 2026-10-03 (`openspec/changes/archive/2026-10-03-T-13-api-data-model/`, spec `api-tenant-data`).
Entidades `Petshop`/`Profile`/`Product` com os mesmos nomes de tabelas,
colunas, índices e constraints do V0; migrations `V0Schema` (o schema do V0)
e `ProductSourceAi` (`photo_ai`/`voice_ai` e `ai_raw_response jsonb`);
petshop e usuário lidos das claims `petshop_id`/`sub`, filtros globais no
`AppDbContext` e `TenantWriteGuard` na gravação; testes portando o
`rls_test.sql` e um ensaio automático da T-18 (`schema.sql` → baseline de
`V0Schema` → migrations seguintes).

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
- **Mesmo banco do V0** (T-11, D2): as tabelas `petshops`/`products`/
  `profiles` já existem — as migrations EF mapeiam o que está lá.
  `profiles.id` fica sem FK para usuários até a T-14 (design D6 da T-13).
- Depende de: T-12.
- Ref: `PLANOMVP.md` §2.3, §3.2 (invariantes), §4.3.

## T-14 — Autenticação com Identity + JWT

Substitui o Supabase Auth, mantendo o comportamento que as specs `auth` e
`tenant-data` do V0 exigem.

- Cadastro atômico de usuário + petshop numa transação — sucessor da
  função `signup_petshop` (§3.1: "detalhe de implementação, não mudança
  de arquitetura").
- Tabelas do Identity no schema próprio `identity`, fora do schema exposto
  pela Data API, e migration com a FK de `profiles.id` para a tabela de
  usuários do Identity (mesmo `Guid`, T-11 D4) — veio da T-13 (design D6).
- O JWT traz as claims `sub` e `petshop_id`, que o isolamento da T-13 lê
  (`ClaimsTenantContext`).
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
- App Service na região **Brazil South**, perto do Supabase em São Paulo
  (`sa-east-1`) — T-11, D2.
- Banco: o Postgres do projeto Supabase (T-11, D2), conectado pelo pooler
  (Supavisor) em modo *session* (porta 5432, IPv4), com pool pequeno — o
  projeto tem limite de 60 conexões. A API usa um papel dedicado
  `petgest_api` (`grant`s só nas tabelas do app, `bypassrls`), nunca o
  `postgres`.
- Ambiente de teste da API: segundo projeto Supabase gratuito ou Postgres
  em contêiner — decidir aqui.
- Segredos (string de conexão, chave de assinatura do JWT, chave da IA)
  só nas configurações do App Service — nunca no frontend nem na Vercel.
- Frontend continua na Vercel (§4.4 permite); prévia da `dev` apontando
  para um ambiente de teste da API.
- Nada de Kubernetes, filas, Redis ou Elasticsearch (§4.4).
- Depende de: T-16.
- Ref: `PLANOMVP.md` §4.4.

## T-18 — Migração dos dados e virada da produção

- **Pré-requisitos:** T-10 arquivada (T-11, D1) e projeto Supabase no
  plano Pro — no gratuito ele pausa após 7 dias sem uso, e com a API em
  cima uma pausa derruba a produção.
- **Sem cópia de dados entre bancos** (T-11, D2): `petshops` e `products`
  já estão no banco que a API usa.
- **Usuários** (T-11, D4): cada linha de `auth.users` vira um usuário do
  Identity com o mesmo `id`, e-mail, estado de confirmação e o hash bcrypt
  copiado; um `IPasswordHasher` compatível verifica o bcrypt e regrava em
  PBKDF2 no primeiro login. Conferir antes, numa cópia, o prefixo
  (`$2a$`/`$2b$`) e o custo dos hashes. Plano B, só se a conferência
  falhar: redefinição de senha no primeiro acesso. Comunicar os petshops
  antes da virada.
- Schema: registrar a migration `V0Schema` como aplicada no banco de
  produção (baseline, ensaiado pelo `SchemaCompatibilityTests` da T-13) e
  aplicar `ProductSourceAi` e as migrations da T-14.
- Janela de virada: importar usuários → trocar a FK de `profiles.id` →
  remover `auth.uid()` das funções/políticas que deixam de ser usadas →
  conferência de contagens por petshop → deploy da `main` com
  `VITE_API_URL` de produção.
- **Fechar a Data API do Supabase** (desligar o PostgREST ou revogar os
  `grant`s de `anon`/`authenticated`) — senão as tabelas seguem
  acessíveis pela chave anon que o V0 publicou.
- Rollback: "Instant Rollback" na Vercel para o deploy do V0 enquanto o
  Supabase Auth não for desativado.
- Teste de campo de paridade (roteiro da T-10) em Android e iPhone, em
  produção.
- Desligar o **Supabase Auth** só depois de um período de observação — o
  projeto Supabase continua, agora só como banco.
- Depende de: T-17.
- Ref: `PLANOMVP.md` §5 "Futuro", `CLAUDE.md` §Testes.

## T-19 — Cadastro de produto por foto + IA

- **Primeiro passo: escolher o provedor de IA** (T-11, D6) com o teste de
  bancada — ~20 fotos de embalagens reais e ~10 áudios, os mesmos para
  OpenAI, Azure OpenAI e Google; critérios na ordem: acerto dos campos em
  PT-BR → custo por cadastro → latência do Brasil → retenção de
  dados/LGPD → SDK. Provedor atrás de `IProductDraftExtractor`, como
  adaptador. A escolha vale também para a T-20.
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
