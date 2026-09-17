# PLANOMVP — Plano do produto e da stack (PetGest)

> Une o que antes eram dois documentos separados (`DecisaoStack.md` e
> `PlanoBackendSupabaseVercel.md`) em um único plano com duas fases: o que
> se constrói **agora (V0)** e o que fica reservado **para o futuro**,
> quando o produto tiver volume/funcionalidades que justifiquem.

## 1. Visão geral e fases

- **Fase V0 (ativa agora):** Supabase (Auth + Postgres + Row Level
  Security) como todo o "backend", frontend React + TypeScript + Vite
  hospedado na Vercel. Sem API própria de longa duração.
- **Fase futura (pós-V0, quando justificar):** migração para uma API
  própria em **ASP.NET Core Web API** com **ASP.NET Core Identity + JWT**
  para autenticação, hospedada em **Azure App Service**, com PostgreSQL
  gerenciado (Azure Database for PostgreSQL). Essa é a arquitetura da
  decisão original deste projeto — ela não foi descartada, só adiada: o V0
  usa Supabase para validar o produto mais rápido e mais barato; quando
  fizer sentido ter uma API própria (features de IA mais elaboradas,
  volume, lógica de negócio que não cabe bem em RLS/RPC), a stack ASP.NET
  Core descrita na seção 4 é o destino planejado.

## 2. Decisões compartilhadas entre as duas fases

Estas decisões não mudam independente de qual backend está rodando por
trás — valem tanto para o V0 (Supabase) quanto para a fase futura (ASP.NET
Core).

### 2.1 Frontend: React + TypeScript + Vite (SPA), não Next.js, não vanilla

| Opção | V0 (câmera/scanner) | Evolução (foto+IA, voz+IA) | Evolução (SaaS completo) | Encaixe com o perfil do dev |
|---|---|---|---|---|
| **React + TS + Vite** | `getUserMedia`/`MediaRecorder` funcionam igual em qualquer SPA React; sem atrito | Upload de foto e gravação de áudio são APIs de navegador, não dependem do framework | Cresce naturalmente para telas de catálogo, dashboards, etc. | Domínio já existente de React/TS |
| **Next.js** | Mesma capacidade de câmera, mas paga a complexidade de SSR/rotas de servidor sem usar essa parte | Idem — nenhuma vantagem real para captura de mídia | Next brilha quando precisa de SEO/conteúdo público; um app operacional atrás de login não precisa disso | Curva de aprendizado extra (App Router, server/client components) sem retorno claro |
| **HTML/CSS/JS puro** | Também acessa câmera sem problema | Reimplementaria roteamento, estado, componentização à mão | Não escala bem para uma UI que já vai crescer | Não há motivo para abrir mão do React |

**Por que não Next.js:** o valor do Next.js está em SSR/SSG e API routes
para apps com necessidade de SEO/conteúdo público. O PetGest é uma
ferramenta operacional logada — não há página pública para indexar. E,
tanto no V0 (Supabase) quanto na fase futura (API ASP.NET Core separada),
as API routes do Next ficariam redundantes.

**Por que não vanilla JS:** funcionaria tecnicamente para o scanner
isolado, mas o produto já tem plano de crescer para um SaaS com várias
telas.

**PWA:** vale empacotar como PWA (manifest + service worker, ex.
`vite-plugin-pwa`) para "adicionar à tela inicial" e resiliência offline
mínima — incremental, não precisa decidir agora.

### 2.2 Scanner de código de barras: pacote `barcode-detector`

**Recomendação, válida para as duas fases:** o pacote `barcode-detector`.

Implementa a interface padrão `BarcodeDetector` do navegador: usa a
implementação **nativa** quando existe (Chrome/Edge em Android) e cai para
**fallback em WASM** (motor ZXing-C++, via `zxing-wasm`) quando não há
suporte nativo — caso do **Safari/iOS** (a Apple nunca implementou a
BarcodeDetector API nativa, por preocupação com fingerprinting) e do
Firefox.

- **Compatibilidade mobile:** cobre Android (API nativa, mais
  rápida/leve) e iPhone (WASM) sem branches de código por plataforma.
- **EAN-13:** suportado nativamente tanto na API nativa quanto no ZXing.
- **Troca futura sem afetar o resto do app:** como o código conversa com a
  interface *padrão* `BarcodeDetector`, trocar por um SDK comercial
  (Dynamsoft, Scandit) no futuro só muda o adaptador.
- **HTTPS obrigatório:** `getUserMedia` só funciona em contexto seguro —
  Vercel (V0) e Azure App Service (futuro) já entregam HTTPS de graça.
- **Câmera traseira:** via constraint `facingMode: "environment"`.
- **Manutenção:** `@zxing/library` (port JS "clássico") está com ritmo de
  manutenção mais lento; o ecossistema girou para `zxing-wasm`, que o
  pacote `barcode-detector` já encapsula.

**Fallback obrigatório:** campo de digitação manual do código — cobre
produtos sem código de barras e falha/negação de permissão de câmera.

### 2.3 Banco de dados: PostgreSQL

Tanto no V0 (Postgres gerenciado pelo Supabase) quanto na fase futura
(Azure Database for PostgreSQL) o banco é Postgres, pelos mesmos motivos:

1. **Hospedagem/custo para um SaaS pequeno começando:** opções gerenciadas
   baratas ou gratuitas (Supabase, Neon, Azure Database for PostgreSQL
   tier burstable).
2. **JSONB nativo:** quando foto+IA e voz+IA chegarem, vai ser necessário
   guardar a resposta bruta (JSON) que o modelo de IA devolveu — para
   depuração, auditoria e eventual re-treino/ajuste de prompts — ao lado
   dos campos normalizados confirmados pelo usuário. O tipo `JSONB`
   (indexável, consultável) do Postgres é a correspondência natural.
   Postgres também tem `pgvector`, útil para busca por similaridade (ex.:
   "produtos parecidos com esta foto") no futuro.

Suporte a EF Core (usado na fase futura) é maduro para Postgres via
`Npgsql`, então a troca não custa produtividade.

**Modelo de dados (regra que vale nas duas fases):** mesmo EAN pode
existir em vários petshops, mas a combinação `(petshop, ean)` precisa ser
única — índice único composto `(petshop_id, ean)`, ignorando `ean IS
NULL` (produtos sem código de barras não devem colidir entre si).

## 3. Fase V0 — Supabase + Vercel (ativa agora)

### 3.1 Arquitetura

```text
React + TS + Vite (SPA)  ──HTTPS──>  Supabase
   hospedado na Vercel                 ├─ Auth (e-mail/senha, sessão via JWT)
                                        ├─ Postgres (petshops, profiles, products)
                                        └─ Row Level Security (isola os dados por petshop)
```

Não existe uma API própria de longa duração no V0 (nada de ASP.NET Core,
nada de Node/Express rodando 24h — isso fica para a fase futura, seção 4).
O que seria "o backend" vira, no V0:

1. **Supabase Auth** cuidando de login/sessão/hash de senha — a mesma
   responsabilidade que o ASP.NET Core Identity teria na fase futura, só
   que gerenciada.
2. **Row Level Security (RLS)** no Postgres do Supabase fazendo o papel de
   autorização multi-tenant que os endpoints da API fariam na fase
   futura.
3. Uma **função SQL (`RPC`, `security definer`)** para o único caso que o
   Supabase não resolve sozinho de graça: criar o petshop e vincular o
   usuário recém-criado a ele, em uma única operação atômica, no cadastro.
   Se no futuro (já na fase ASP.NET Core) fizer mais sentido mover essa
   lógica para a API própria, é um detalhe de implementação, não uma
   mudança de arquitetura.

Ou seja: "criar o backend" no V0 é, na prática, **modelar o banco +
políticas de segurança do Supabase + uma função SQL**, não escrever e
hospedar um servidor.

### 3.2 Modelagem de dados (Supabase / Postgres)

```sql
-- petshops: um por conta (dono/funcionário único, como já decidido)
create table petshops (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  email      text not null,
  phone      text,
  created_at timestamptz not null default now()
);

-- profiles: liga um usuário do Supabase Auth a um petshop.
-- 1 profile = 1 usuário (auth.users), mas petshop_id pode um dia ser
-- compartilhado por mais de um profile (múltiplos funcionários) sem
-- mudar o schema.
create table profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  petshop_id uuid not null references petshops (id) on delete cascade,
  created_at timestamptz not null default now()
);

-- products: o cadastro por código de barras cai aqui.
-- "source" prepara o terreno para foto+IA e voz+IA.
create table products (
  id         uuid primary key default gen_random_uuid(),
  petshop_id uuid not null references petshops (id) on delete cascade,
  name       text not null,
  category   text not null,
  price      numeric(10,2) not null check (price >= 0),
  ean        text,
  source     text not null default 'manual' check (source in ('barcode', 'manual')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- mesmo EAN pode existir em petshops diferentes, mas não duas vezes no
-- mesmo petshop.
create unique index products_petshop_ean_key
  on products (petshop_id, ean) where ean is not null;
```

#### Row Level Security

```sql
alter table petshops enable row level security;
alter table profiles enable row level security;
alter table products enable row level security;

-- profiles: cada usuário só enxerga/edita o próprio vínculo
create policy "profiles: dono vê e edita o próprio" on profiles
  for select using (id = auth.uid());
create policy "profiles: dono atualiza o próprio" on profiles
  for update using (id = auth.uid());

-- petshops: só quem tem profile apontando pra ele
create policy "petshops: acesso do próprio dono" on petshops
  for select using (id = (select petshop_id from profiles where id = auth.uid()));
create policy "petshops: dono atualiza dados da loja" on petshops
  for update using (id = (select petshop_id from profiles where id = auth.uid()));

-- products: isolamento total por petshop (o coração do multi-tenant)
create policy "products: acesso restrito ao próprio petshop" on products
  for all using (petshop_id = (select petshop_id from profiles where id = auth.uid()))
  with check (petshop_id = (select petshop_id from profiles where id = auth.uid()));
```

Com essas políticas, o app React nunca precisa filtrar `WHERE petshop_id =
...` manualmente — qualquer `select`/`insert`/`update` do usuário logado
já vem automaticamente restrito ao petshop dele.

#### A função de cadastro (petshop + usuário juntos)

```sql
create or replace function signup_petshop(
  petshop_name text,
  petshop_email text,
  petshop_phone text
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_petshop_id uuid;
begin
  insert into petshops (name, email, phone)
  values (petshop_name, petshop_email, petshop_phone)
  returning id into new_petshop_id;

  insert into profiles (id, petshop_id)
  values (auth.uid(), new_petshop_id);

  return new_petshop_id;
end;
$$;
```

Fluxo de cadastro no frontend: `supabase.auth.signUp({ email, password })`
→ (usuário já autenticado, `auth.uid()` disponível) →
`supabase.rpc('signup_petshop', { petshop_name, petshop_email, petshop_phone })`.
As duas chamadas ficam encadeadas no mesmo formulário de "criar conta".

### 3.3 Autenticação (Supabase Auth)

- **Login:** `supabase.auth.signInWithPassword({ email, password })` —
  troca a validação manual de e-mail/senha da tela de login atual (a que
  só simula) por essa chamada de verdade. A sessão fica persistida
  sozinha (localStorage) pelo `supabase-js`; `supabase.auth.onAuthStateChange`
  informa quando logar/deslogar e mostrar a tela certa.
- **Logout:** `supabase.auth.signOut()` no lugar do "Sair" que hoje só
  volta pra tela de login sem sair de verdade.
- **Proteção de rota:** sem sessão ativa → mostra a tela de login (mesma
  ideia visual que já existe, só trocando a validação simulada pela
  chamada real e tratando o erro de credenciais inválidas).
- **Confirmação de e-mail:** por padrão o Supabase exige confirmar o
  e-mail antes do primeiro login. Para agilizar os testes do V0,
  recomenda-se **desativar essa exigência** nas configurações de Auth do
  projeto agora e reativar antes de qualquer uso com clientes reais — é
  uma configuração de um clique no painel do Supabase, não uma decisão de
  código.

### 3.4 Scanner de código de barras (implementação real do V0)

Substitui a simulação visual atual pela implementação real (pacote
`barcode-detector` — ver seção 2.2):

- `getUserMedia({ video: { facingMode: "environment" } })` para abrir a
  câmera traseira; HTTPS obrigatório (a Vercel já entrega isso de graça em
  qualquer deploy, inclusive nas prévias de PR).
- Mesma máquina de estados visual que o protótipo já tem
  (`asking → scanning → found/erro`), só trocando o "código de
  demonstração sorteado" por uma leitura de verdade do quadro de vídeo.
- **Diferença importante em relação ao protótipo visual:** a "base de
  referência" que preenchia nome/categoria sozinha era só uma
  demonstração fictícia. No V0 real **não há uma base de produtos externa
  integrada** — o scanner só reconhece um código que já esteja cadastrado
  *naquele mesmo petshop*. Os desfechos reais ficam em dois, não três:
  1. código já cadastrado no petshop → abre para edição;
  2. código não encontrado → preenche só o campo de código de barras,
     completando o resto manualmente.
  Uma base de referência de produtos de verdade (um catálogo do setor) é
  infraestrutura própria, fora do escopo deste V0.
- Consulta ao Postgres via `supabase-js`
  (`select * from products where ean = codigo` — o RLS já restringe ao
  petshop do usuário logado sozinho, sem precisar passar `petshop_id` à
  mão).

### 3.5 Migração do frontend para React + TypeScript + Vite

Estrutura de pastas alvo:

```text
frontend/
  src/
    features/
      auth/       (tela de login/cadastro, sessão, proteção de rota)
      scanner/    (câmera + barcode-detector)
      products/   (listagem, cadastro/edição)
      petshop/    (dados da loja — tela de Configurações)
    shared/
      supabaseClient.ts   (único client Supabase do app — sempre usar este)
      ui/                 (componentes portados do design system atual)
  index.css / tokens      (portar as variáveis de style.css: cores,
                            espaçamento, tipografia, sprite de ícones)
supabase/
  schema.sql              (tabelas + RLS + função signup_petshop, versionado)
```

O trabalho aqui é majoritariamente **portar** o que já existe — o design
(`style.css`), as três telas (login, produtos, configurações) e a
estrutura de estados do scanner —, trocando por baixo o que hoje é
simulado (arrays em memória, `setTimeout`) pelas chamadas reais ao
Supabase.

### 3.6 Deploy (V0)

```text
Repositório:  1 repo no GitHub (frontend/ + supabase/schema.sql)
Vercel:       conecta no repo, build "Vite", root em frontend/,
              variáveis de ambiente:
                VITE_SUPABASE_URL       (pública — endereço do projeto)
                VITE_SUPABASE_ANON_KEY  (pública por design — protegida pelo RLS,
                                          não pela obscuridade)
Supabase:     projeto no tier gratuito; schema aplicado via SQL editor
              (ou supabase CLI, se quiser versionar migrations formalmente)
```

Nenhuma *service role key* do Supabase (a chave "admin", que ignora RLS)
precisa existir no frontend nem em variável de ambiente da Vercel — a
função `signup_petshop` roda com privilégio elevado *dentro do banco*,
então o cliente nunca vê uma chave perigosa. Esse é o principal ganho de
segurança de resolver o cadastro em SQL em vez de numa Function.

### 3.7 Roadmap — ordem sugerida (V0)

1. Criar o projeto no Supabase (tier gratuito); guardar Project URL e
   `anon key`.
2. Rodar o schema (tabelas, RLS, função `signup_petshop`) no SQL editor do
   Supabase — versionado em `supabase/schema.sql` no repo.
3. Configurar o provedor de e-mail/senha no Auth do Supabase; desativar
   confirmação de e-mail por enquanto (reavaliar antes de produção).
4. Criar `frontend/` com Vite + React + TS; instalar `@supabase/supabase-js`
   e `barcode-detector`.
5. Portar o design system (`style.css`) e as três telas atuais (login,
   produtos, configurações) para componentes React, organizados por
   feature.
6. Ligar o login/logout de verdade (`signInWithPassword`, `signOut`,
   `onAuthStateChange`) e a proteção de rota.
7. Implementar a tela/fluxo de "criar conta" (cadastro do petshop):
   `signUp()` seguido do `rpc('signup_petshop', ...)`.
8. Trocar o array de produtos em memória por operações reais no Supabase
   (listar, criar, editar) — o RLS cuida do isolamento por petshop.
9. Implementar o scanner de verdade (`getUserMedia` + `barcode-detector`),
   com os dois desfechos reais (já cadastrado / não encontrado).
10. Subir o repositório, conectar na Vercel, configurar as variáveis de
    ambiente, primeiro deploy.
11. Testar ponta a ponta em celular real (Android e iPhone) — login,
    câmera, HTTPS.

### 3.8 Escopo de telas do V0 (a partir do protótipo original)

O protótipo original (`Projetos/PetGest`, antes do corte) tinha **7
telas**: Dashboard, Produtos, Estoque, Reposição, Fornecedores, Relatórios
e Configurações — desenhado como um sistema completo de gestão de
estoque. As 4 conversas com petshops mostraram que controle de estoque
**não é uma dor validada** ainda, então isso foi excluído do V0.

**Usar no V0 (parcialmente):**

- **Tela "Produtos"** — base do V0:
  - Manter: busca por nome/código, botão "Cadastrar produto", lista/catálogo.
  - Manter do formulário: Nome, Categoria, campo **Código de barras +
    botão "Escanear"**, Preço de venda.
  - Remover: Fornecedor, Estoque inicial/mínimo, Situação (ativo/inativo),
    Preço de custo, Unidade de medida, Código interno/SKU.
  - Remover da listagem: colunas "Estoque", "Mínimo", "Status" e o filtro
    por status. O filtro por categoria pode ficar.
- **Tela "Configurações"** — só "Dados da loja" (nome, e-mail, telefone).
  Deixar de fora: estoque mínimo padrão, multiplicador de sugestão de
  compra, alertas. O seletor de cor principal pode ficar se for barato de
  manter.

**Não usar no V0:**

- **Dashboard** — baseado em indicadores de estoque; sem dado nenhum
  disso no V0.
- **Estoque** — é exatamente o sistema de estoque excluído.
- **Reposição** — depende de estoque mínimo/sugestão de compra.
- **Fornecedores** — fora da lista explícita do V0.
- **Relatórios** — depende de dados de estoque/movimentação inexistentes.

**Vale reaproveitar independente das telas:** o `style.css` do protótipo
tem um design system decente (variáveis CSS centralizadas, tabelas que
viram cards via container query, sprite de ícones SVG) — portar esses
tokens visuais como base de estilo do app React do V0.

**Produto no V0 tem só:** nome, categoria, preço, ean (opcional), source
(`barcode` | `manual`).

### 3.9 Decisões em aberto / riscos (V0)

- **Confirmação de e-mail:** desativada por padrão para agilizar os
  testes; reativar quando fizer sentido.
- **Um petshop por usuário:** o schema já permite mais de um `profile`
  apontando para o mesmo `petshop_id` no futuro (múltiplos funcionários)
  sem precisar de migration — mas o V0 continua com papel único.
- **Sem base de referência de produtos externa:** o scanner do V0 real só
  reconhece o que já está cadastrado naquele petshop.
- **`barcode-detector` no Safari/iOS:** primeira leitura pode ser um
  pouco mais lenta pelo download do fallback WASM; confirmar em aparelho
  real depois do deploy.
- **Offline/conexão ruim dentro do petshop:** não confirmado se é
  necessário. Não muda a stack do V0, mas pode influenciar decisões
  futuras (ex.: fila local de produtos escaneados esperando sincronizar).
  Por ora, assume-se conexão normal 3G/4G/Wi-Fi.

## 4. Fase futura — ASP.NET Core + Azure (pós-V0)

> Esta é a arquitetura originalmente cogitada para o projeto. Ela **não
> foi descartada** — fica reservada para quando o produto tiver
> volume/funcionalidades que justifiquem trocar o Supabase por uma API
> própria (ex.: lógica de negócio complexa demais para RLS/RPC,
> integrações de IA mais elaboradas, necessidade de controle fino sobre
> infraestrutura). Até lá, o V0 roda inteiramente na stack da seção 3.

### 4.1 Backend: ASP.NET Core Web API

A experiência em C#/ASP.NET Core é o fator decisivo — maior ganho de
velocidade de desenvolvimento quando o projeto migrar para uma API
própria.

O argumento comum a favor de Node.js/TS ("é melhor para integrar com IA")
não se sustenta tanto: OpenAI, Azure OpenAI e Google oferecem APIs REST
simples e SDKs oficiais em C# (`Azure.AI.OpenAI`, SDK oficial da OpenAI
para .NET). Endpoints que recebem uma imagem, chamam um serviço de
visão/LLM e devolvem JSON estruturado são só mais um controller +
`HttpClient`.

Onde Node/TS levaria vantagem real:
- Compartilhar tipos entre frontend e backend (ambos em TS) — não
  crítico: dá para gerar tipos TS a partir do OpenAPI/Swagger do ASP.NET
  Core automaticamente.
- Ecossistema JS de IA (Vercel AI SDK, LangChain.js) tem ergonomia um
  pouco mais polida para streaming de chat — irrelevante aqui, porque
  foto→dados estruturados e voz→dados estruturados são chamadas
  request/response de "tiro único", não chat em streaming.

### 4.2 Autenticação: ASP.NET Core Identity + JWT

**Recomendação para a fase futura: ASP.NET Core Identity emitindo JWT**,
com um único papel (dono/funcionário do petshop) — sem sistema de
permissões granular por enquanto.

- Identity já cuida de hashing de senha corretamente, reset de senha,
  etc.
- JWT faz sentido porque frontend (SPA) e backend (API) moram em
  domínios/hosts diferentes (frontend em host estático, backend no Azure)
  — cookies same-site ficariam mais complicados nesse cenário.
- Alternativa legítima: serviços externos de auth (Clerk, Auth0) — o
  Supabase Auth já cumpre esse papel no V0; ao migrar, reavaliar se vale
  a pena trocar por Identity+JWT ou manter um provedor externo.
- Nada de rate limiting elaborado ou 2FA nesta fase — HTTPS sempre, senha
  com hash forte (Identity já faz isso), rate limit simples no endpoint
  de login (middleware nativo do ASP.NET Core desde o .NET 7).

### 4.3 Arquitetura e estrutura de pastas (fase futura)

```text
Frontend (SPA)
     ↓  HTTPS / JSON (multipart/form-data para imagem e áudio no futuro)
Backend (API ASP.NET Core)
     ↓
PostgreSQL (Azure Database for PostgreSQL)
```

`frontend/` e `backend/` como pastas separadas no repositório — mantém os
dois como unidades independentes de deploy.

**Dentro de `backend/`:** um único projeto ASP.NET Core Web API,
organizado internamente em pastas — não a estrutura completa `Api/
Application/ Domain/ Infrastructure/` em projetos separados, a não ser
que o número de casos de uso já justifique isso na hora da migração (é um
refactor mecânico de "mover pastas para projetos", não uma reescrita):

```text
backend/
  Api/                  (projeto único ASP.NET Core Web API)
    Endpoints/          (ou Controllers/)
    Services/           (regras de negócio: IProductLookupService, etc.)
    Data/               (DbContext, entidades EF, migrations)
    Models/             (DTOs de request/response)
```

**Cuidado arquitetural a manter desde o V0:** modelar um DTO
intermediário tipo `ProductDraft` (nome, categoria, preço, ean opcional, e
um campo `Source`/`CaptureMethod` com valores `Barcode | Manual | PhotoAI
| VoiceAI`) — o campo `source` já existe no schema do V0 (seção 3.2) por
esse motivo. Assim, quando a API própria existir, foto+IA e voz+IA
entram como novos serviços que produzem um `ProductDraft` e devolvem para
a mesma tela de confirmação que o scanner já usa, sem redesenhar o fluxo.

**Filas/microsserviços/infra complexa:** não fazer nada especial na
migração inicial. Foto+IA e voz+IA são só um endpoint `multipart/form-data`
+ um serviço que chama uma API externa de IA de forma assíncrona
(`async`/`await`, I/O-bound) + valida a resposta + devolve um
`ProductDraft`. Fila/webhook só se o volume real mostrar necessidade.

### 4.4 Deploy (fase futura)

```text
Frontend:  host estático (Vercel, Netlify ou Azure Static Web Apps) — build do Vite
Backend:   Azure App Service (tier gratuito/básico) — HTTPS por padrão, CI/CD via GitHub
Banco:     Azure Database for PostgreSQL (tier burstable)
```

Nada de Kubernetes, filas, Redis ou Elasticsearch.

### 4.5 Gatilhos para migrar do V0 para esta fase

Não há uma data definida — a migração faz sentido quando um ou mais destes
ocorrerem:

- Lógica de negócio complexa demais para caber bem em RLS/RPC do Postgres.
- Features de foto+IA / voz+IA precisando de orquestração server-side
  mais elaborada do que uma function SQL permite.
- Necessidade de controle de infraestrutura que o Supabase não oferece
  (ex.: processamento assíncrono pesado, jobs agendados complexos).
- Volume de uso que justifique o custo/esforço de manter uma API própria.

Até um desses gatilhos aparecer, a fase V0 (seção 3) é onde todo o
desenvolvimento acontece.

## 5. Entregáveis

### V0 (agora)

- Login e cadastro de petshop funcionando de verdade contra o Supabase
  Auth (sem simulação).
- Cadastro de produto com scanner de código de barras real
  (`barcode-detector` + câmera), com fallback de digitação manual.
- Tela de produtos (listagem, busca, cadastro/edição) persistindo no
  Postgres do Supabase, isolado por petshop via RLS.
- Tela de Configurações com dados da loja.
- App em React + TypeScript + Vite, publicado na Vercel.
- `supabase/schema.sql` versionado no repositório.

### Futuro (pós-V0, quando os gatilhos da seção 4.5 aparecerem)

- API própria em ASP.NET Core Web API, com autenticação via Identity +
  JWT.
- Banco migrado para Azure Database for PostgreSQL (ou mantido no
  Supabase, a decidir no momento da migração).
- Suporte a cadastro de produto via foto+IA e voz+IA, usando o mesmo
  contrato `ProductDraft` já preparado desde o V0.
- Deploy do backend em Azure App Service.
