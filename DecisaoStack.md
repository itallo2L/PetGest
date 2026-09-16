# Decisão de stack — V0 (Cadastro + Scanner de código de barras)

> Nota de honestidade: a busca na web não esteve disponível para mim durante esta análise (bloqueada na sessão). As afirmações sobre suporte de navegadores/manutenção de bibliotecas abaixo vêm do meu conhecimento treinado (corte em janeiro de 2026) e, embora eu esteja razoavelmente confiante nelas — é um ecossistema que muda devagar —, vale uma checagem rápida em caniuse.com e nos repositórios das libs antes de travar a decisão final.

## Recomendação final

**Para este projeto, para o V0 e considerando a evolução futura para foto + IA e voz + IA, eu escolheria: React + TypeScript + Vite (SPA mobile-first) no frontend, ASP.NET Core Web API no backend, PostgreSQL como banco, o pacote `barcode-detector` para o scanner, e ASP.NET Core Identity + JWT para autenticação.**

Isso é muito próximo da stack que você já tinha cogitado (React+TS+Vite / ASP.NET Core), com uma mudança: PostgreSQL no lugar de SQL Server. Abaixo explico o raciocínio completo, as alternativas descartadas e por quê.

### Stack recomendada

```text
Frontend:     React + TypeScript + Vite (SPA, mobile-first, instalável como PWA)
Backend:      ASP.NET Core Web API (C#, minimal APIs ou controllers)
Banco:        PostgreSQL (Npgsql + EF Core)
Scanner:      pacote "barcode-detector" (BarcodeDetector nativo quando disponível,
              fallback WASM/zxing-wasm quando não)
Autenticação: ASP.NET Core Identity + JWT bearer (um único papel: dono/funcionário)
Comunicação:  REST/JSON (HTTPS), multipart/form-data já previsto para
              upload de imagem/áudio no futuro
Deploy:       Frontend em host estático (Vercel/Netlify/Azure Static Web Apps);
              Backend em Azure App Service; Banco em Azure Database for
              PostgreSQL (ou Supabase/Neon no V0 para custo zero)
```

Duas perguntas em aberto que dependem de informação que você não deu (respondo de forma provisória e sigo em frente, mas vale confirmar):

1. **Onde pretende hospedar / qual orçamento de infra para o V0?** Assumi Azure para o backend (aproveita sua familiaridade com o ecossistema Microsoft) e um Postgres gerenciado barato. Se você já tem preferência por outro provedor, isso não muda a stack de código, só o deploy.
2. **O app precisa funcionar offline/com conexão ruim dentro do petshop?** Não veio no seu contexto. Não muda a escolha de stack para o V0, mas pode influenciar decisões futuras (ex.: fila local de produtos escaneados esperando sincronizar). Por ora, assumo conexão normal de 3G/4G/Wi-Fi.

---

## 1. Frontend: React + TypeScript + Vite (SPA), não Next.js, não vanilla

| Opção | V0 (câmera/scanner) | Evolução (foto+IA, voz+IA) | Evolução (SaaS completo) | Encaixe com seu perfil |
|---|---|---|---|---|
| **React + TS + Vite** | getUserMedia/MediaRecorder funcionam igual em qualquer SPA React; sem atrito | Upload de foto e gravação de áudio são APIs de navegador, não dependem do framework | Cresce naturalmente para telas de catálogo, dashboards, etc. | Você já domina React/TS |
| **Next.js** | Mesma capacidade de câmera, mas você paga a complexidade de SSR/rotas de servidor sem usar essa parte | Idem — nenhuma vantagem real para captura de mídia | Next brilha quando precisa de SEO/conteúdo público; um app operacional atrás de login não precisa disso | Curva de aprendizado extra (App Router, server/client components) sem retorno claro agora |
| **HTML/CSS/JS puro** | Também acessa câmera sem problema | Você reimplementaria roteamento, estado, componentização à mão conforme a IA/voz forem chegando | Não escala bem para uma UI que você já sabe que vai crescer (catálogo, telas de confirmação, futuros módulos) | Você tem experiência em React — não há motivo para abrir mão dela |

**Por que não Next.js aqui:** o valor do Next.js está em SSR/SSG e nas API routes para apps com necessidade de SEO/conteúdo público. Seu produto é uma ferramenta operacional logada — não existe página pública para indexar. E como seu backend já vai ser uma API ASP.NET Core separada, as API routes do Next ficariam redundantes (você teria dois "backends" para manter em sincronia). Next.js seria peso arquitetural sem ganho concreto neste caso.

**Por que não vanilla JS:** funcionaria tecnicamente para o scanner isolado, mas você já sabe que este produto vai crescer para um SaaS com várias telas. Não faz sentido abrir mão do React (que você domina) só para o V0 e depois ter que portar tudo.

**Sobre a evolução para foto+IA e voz+IA:** nenhuma decisão de framework aqui bloqueia ou facilita isso de forma relevante. `getUserMedia` (câmera/foto) e `MediaRecorder` (áudio) são APIs nativas do navegador, usadas da mesma forma dentro de qualquer app React. O que importa é organizar o código em features (ver seção de arquitetura) para que "scanner", "captura de foto" e "captura de voz" sejam módulos irmãos, não uma reforma da tela de cadastro.

**PWA:** vale empacotar como PWA (manifest + service worker, ex. `vite-plugin-pwa`) para permitir "adicionar à tela inicial" e um mínimo de resiliência offline — isso é incremental e pode ser adicionado quando fizer sentido, não precisa decidir agora.

---

## 2. Backend: ASP.NET Core Web API (não Node/TypeScript)

Sua experiência em C#/ASP.NET Core é o fator decisivo aqui — é o maior ganho de velocidade possível para um V0 feito por uma pessoa só.

O argumento comum a favor de Node.js/TS ("é melhor para integrar com IA") não se sustenta tanto hoje: OpenAI, Azure OpenAI e Google oferecem APIs REST simples e SDKs oficiais em C# (`Azure.AI.OpenAI`, SDK oficial da OpenAI para .NET). Endpoints que recebem uma imagem, chamam um serviço de visão computacional/LLM e devolvem JSON estruturado são só mais um controller + `HttpClient` — não há nada em ASP.NET Core que torne isso mais difícil do que em Node.

Onde Node/TS levaria vantagem real:
- Compartilhar tipos entre frontend e backend (ambos em TS) — conveniência real, mas não crítica: você pode gerar tipos TS a partir do OpenAPI/Swagger do ASP.NET Core automaticamente.
- Ecossistema JS de IA (Vercel AI SDK, LangChain.js) tem ergonomia um pouco mais polida para streaming de chat — irrelevante aqui, porque foto→dados estruturados e voz→dados estruturados são chamadas request/response de "tiro único", não chat em streaming.

Conclusão: ASP.NET Core ganha em velocidade de desenvolvimento (seu conhecimento profundo) sem nenhuma desvantagem arquitetural real para as features de IA futuras.

---

## 3. Banco de dados: PostgreSQL (em vez de SQL Server)

Ambos resolveriam bem o schema que você descreveu (petshops, produtos, categorias, imagens, dados extraídos por IA, vendas, estoque futuro). A escolha entre eles não é "certo vs. errado", é uma inclinação com dois motivos concretos:

1. **Hospedagem/custo para um SaaS pequeno começando:** Postgres tem opções gerenciadas muito baratas ou gratuitas para validar o produto (Supabase, Neon, Azure Database for PostgreSQL no tier burstable), o que ajuda num momento em que você ainda está validando a hipótese com usuários reais.
2. **JSONB nativo:** quando foto+IA e voz+IA chegarem, você vai querer guardar a resposta bruta (JSON) que o modelo de IA devolveu — para depuração, auditoria e eventualmente re-treinar/ajustar prompts — ao lado dos campos normalizados que o usuário de fato confirmou. O tipo `JSONB` do Postgres (indexável, consultável) é uma correspondência natural para isso. SQL Server tem suporte a JSON, mas é mais limitado (armazenado como `NVARCHAR` com funções JSON, sem um tipo binário indexável equivalente). Postgres também tem `pgvector`, útil se um dia você quiser busca por similaridade (ex.: "produtos parecidos com esta foto").

Suporte a EF Core é igualmente maduro para os dois hoje (o provider `Npgsql` é usado amplamente em produção), então trocar para Postgres não custa nada em produtividade com EF.

**Se** você já tiver alguma razão para padronizar em Microsoft/Azure (créditos, suporte, política da empresa), SQL Server continua sendo uma escolha tecnicamente sólida — não é uma decisão que quebraria nada, apenas uma que eu não escolheria por padrão aqui.

**Sobre o modelo de dados multi-tenant:** a regra que você descreveu — mesmo EAN pode existir em vários petshops, mas a combinação (petshop, código do produto) precisa ser única, e o ID interno não precisa ser o EAN — é direta em qualquer um dos dois bancos: uma tabela `Products` com `Id` (chave primária própria, ex. GUID ou identity), `PetshopId` (FK) e `Ean` (nullable, já que nem todo produto tem código de barras), com um **índice único composto em `(PetshopId, Ean)`** (filtrado para ignorar `Ean IS NULL`, já que vários produtos sem código de barras do mesmo petshop não devem colidir).

---

## 4. Scanner de código de barras

**Recomendação para o V0: o pacote `barcode-detector`.**

Esse pacote implementa a interface padrão `BarcodeDetector` do navegador (a mesma API nativa), mas por baixo dos panos: usa a implementação **nativa** do navegador quando ela existe (Chrome/Edge em Android, por exemplo), e cai para um **fallback em WASM** (baseado no motor ZXing-C++, via `zxing-wasm`) quando o navegador não tem suporte nativo — que é o caso notório do **Safari/iOS** (a Apple nunca implementou a BarcodeDetector API nativa, por preocupações com fingerprinting) e do Firefox.

Por que isso resolve exatamente o que você pediu:
- **Compatibilidade mobile:** cobre tanto Android (via API nativa, mais rápida/leve) quanto iPhone (via WASM), sem você ter que escrever branches de código diferentes por plataforma — importante porque donos/funcionários de petshop certamente vão usar uma mistura de Android e iPhone.
- **EAN-13:** suportado nativamente pelo formato `ean_13` tanto na API nativa quanto no motor ZXing.
- **Troca futura sem afetar o resto do app:** como seu código conversa com a interface *padrão* `BarcodeDetector`, se um dia você quiser trocar por um SDK comercial (Dynamsoft, Scandit) por precisão/performance, só o adaptador muda — o resto do fluxo (vídeo, captura de frame, exibição do resultado) permanece intacto. Isso é exatamente o "poder substituir a implementação futuramente" que você pediu.
- **HTTPS:** obrigatório — `getUserMedia` só funciona em contexto seguro (HTTPS), exceto em `localhost` durante desenvolvimento. Qualquer host razoável (Azure App Service, Vercel, Netlify) já dá HTTPS de graça, então isso não é um obstáculo, só um lembrete de configurar certo desde o primeiro deploy de teste.
- **Câmera traseira:** controlado via constraint `facingMode: "environment"` no `getUserMedia` — suportado amplamente.
- **Manutenção:** `@zxing/library` (o port JS "clássico") está com ritmo de manutenção mais lento; o ecossistema mais recente girou em torno do `zxing-wasm` (build WASM do zxing-cpp, ativamente mantido) — o pacote `barcode-detector` já encapsula essa escolha para você.

**Fallback obrigatório:** campo de digitação manual do código, exatamente como você já havia especificado — cobre tanto produtos sem código de barras quanto falha/negação de permissão de câmera.

---

## 5. Autenticação

**Recomendação: ASP.NET Core Identity emitindo JWT**, com um único papel (dono/funcionário do petshop) — sem sistema de permissões granular por enquanto, exatamente como você pediu.

- Identity já cuida de hashing de senha corretamente (você não implementa nada de criptografia na mão), reset de senha, etc. — é o "não seja amador" sem esforço extra.
- JWT faz sentido porque frontend (SPA) e backend (API) provavelmente vão morar em domínios/hosts diferentes (ex. frontend num host estático, backend no Azure) — cookies same-site ficariam mais complicados nesse cenário.
- Alternativa legítima: serviços externos de auth (Clerk, Supabase Auth, Auth0) — tiram de você a responsabilidade de armazenar senha, e podem ser mais rápidos de configurar. Vale considerar se quiser ganhar ainda mais velocidade e não se importar com uma dependência externa a mais. Mas como você já está confortável no território do ASP.NET Core Identity e quer construir isso de forma profissional, ele é minha recomendação primária.
- Nada de rate limiting elaborado ou 2FA agora — só o básico: HTTPS sempre, senha com hash forte (Identity já faz isso), e um rate limit simples no endpoint de login (o próprio ASP.NET Core tem middleware de rate limiting nativo desde o .NET 7, é uma linha de configuração).

---

## 6. Arquitetura e estrutura de pastas

```text
Frontend (SPA)
     ↓  HTTPS / JSON (multipart/form-data já previsto p/ imagem e áudio no futuro)
Backend (API ASP.NET Core)
     ↓
PostgreSQL
```

**`frontend/` e `backend/` como pastas separadas no repositório: faz sentido e é o que recomendo** — mantém os dois como unidades independentes de deploy (o frontend pode ir para um host estático sem nenhuma dependência do pipeline do backend).

**Dentro de `frontend/`:** organizar por feature, não por tipo de arquivo:

```text
frontend/
  src/
    features/
      scanner/       (câmera, detecção de código de barras)
      products/      (cadastro, listagem, confirmação)
      petshop/       (cadastro do petshop, configuração básica)
    shared/          (componentes de UI, hooks genéricos, client HTTP)
```

Assim, quando foto+IA e voz+IA chegarem, elas entram como `features/photo-capture/` e `features/voice-capture/` — pastas novas ao lado das existentes, não uma reforma do que já existe.

**Dentro de `backend/`: um único projeto ASP.NET Core Web API para o V0, organizado internamente em pastas — não a estrutura completa `Api/ Application/ Domain/ Infrastructure/` em projetos separados.**

```text
backend/
  Api/                  (projeto único ASP.NET Core Web API)
    Endpoints/          (ou Controllers/)
    Services/           (regras de negócio: IProductLookupService, etc.)
    Data/               (DbContext, entidades EF, migrations)
    Models/             (DTOs de request/response)
```

Por quê não a divisão completa em 4 projetos agora: com duas entidades (Petshop, Product) e um caso de uso (escanear/consultar), múltiplos assemblies significam mais cerimônia de DI e mais atrito exatamente no momento em que o schema ainda vai mudar rápido conforme você valida com petshops reais. Isso não quer dizer que a divisão em camadas `Api/Application/Domain/Infrastructure` esteja errada como prática — é uma estrutura legítima e você pode migrar para ela quando o número de casos de uso justificar (é um refactor mecânico de "mover pastas para projetos", não uma reescrita).

**O único cuidado arquitetural que vale fazer desde já** (isso é o "cuidado específico" que você pediu para eu avaliar): modele um DTO intermediário, algo como `ProductDraft` (nome, marca, categoria, peso/volume, preço, ean opcional, e um campo `Source`/`CaptureMethod` com valores `Barcode | Manual | PhotoAI | VoiceAI`), mesmo que hoje só `Barcode` e `Manual` sejam usados. Assim:

- O endpoint de "confirmar e salvar produto" já nasce desacoplado de como os dados chegaram até ele.
- Quando foto+IA e voz+IA chegarem, elas são apenas **novos serviços que produzem um `ProductDraft`** (`IPhotoProductExtractionService`, `IVoiceProductExtractionService`) e devolvem para a mesma tela de confirmação que o scanner já usa — não uma redesenho do fluxo de cadastro.
- Você já grava o campo `Source` desde o V0, então não precisa de uma migration futura só para isso, e já pode medir adoção de cada método assim que lançar os próximos.

**Sobre filas/microsserviços/infra complexa:** a resposta direta é **"não faça nada especial agora"**. Uma API bem organizada, com a camada de serviços atrás de interfaces, é suficiente. Foto+IA e voz+IA, quando chegarem, são só: um endpoint que recebe `multipart/form-data` (imagem ou áudio), um serviço que chama uma API externa de IA de forma assíncrona (`async`/`await` comum — é I/O-bound, o ASP.NET Core lida bem com isso em paralelo sem fila nenhuma na escala de um V1), valida/deserializa a resposta estruturada, e devolve um `ProductDraft` para confirmação — espelhando exatamente o fluxo do scanner. Só valeria revisitar isso (processamento assíncrono de verdade, fila, webhook) se o volume real de uso mostrar que uma chamada de IA está demorando o suficiente para travar a experiência — é uma decisão de V2+ com dados reais, não uma antecipação de V0.

---

## 7. Deploy

```text
Frontend:  host estático (Vercel, Netlify ou Azure Static Web Apps) — build do Vite
Backend:   Azure App Service (tier gratuito/básico) — HTTPS por padrão, CI/CD simples via GitHub
Banco:     Azure Database for PostgreSQL (tier burstable) ou, para custo zero
           durante a validação, Supabase/Neon — migrar para Azure depois se quiser
```

Nada de Kubernetes, filas, Redis ou Elasticsearch — exatamente como você já havia delimitado.

---

## 8. Roadmap técnico do V0

### Menor protótipo possível (fazer isso ANTES de tudo o resto)

Antes de autenticação, banco ou qualquer estrutura de projeto: construa uma única página (pode ser um app Vite React minúsculo, sem backend, sem auth, sem banco) que:

1. Pede permissão de câmera;
2. Abre a câmera traseira via `getUserMedia`;
3. Roda o `barcode-detector` sobre o vídeo;
4. Mostra o EAN-13 decodificado na tela.

Suba essa página isolada em qualquer host HTTPS gratuito e teste em celulares reais (Android e iPhone, se possível) na iluminação real de um petshop. Isso responde "consigo ler um EAN de forma confiável pelo navegador?" em questão de um dia de trabalho, antes de escrever backend, auth ou banco. Se o resultado for ruim (muita luz baixa, código amassado, distância ruim), é muito mais barato descobrir isso agora do que depois de montar toda a arquitetura em volta.

### Sequência depois de validado o protótipo

1. Estrutura de repositório (`frontend/`, `backend/`), init do Vite React TS e do projeto ASP.NET Core Web API.
2. Backend: configurar EF Core + PostgreSQL, criar entidades `Petshop` e `Product` (já com `ProductDraft`-shape: nome, marca, categoria, peso/volume, preço, ean opcional, `Source`) e o índice único composto `(PetshopId, Ean)`.
3. Endpoint de cadastro de petshop (nome, e-mail, telefone) — sem lógica extra.
4. Autenticação mínima (Identity + JWT, papel único) protegendo o restante da API.
5. Integrar o protótipo de câmera/scanner validado dentro do app React real, como `features/scanner/`.
6. Endpoint `GET /products/lookup?ean=...` — verifica existência por `(petshopId, ean)`.
7. Frontend: ao escanear, chama o lookup; se não encontrado, mostra formulário mínimo de cadastro manual (`POST /products`) — só o suficiente para fechar o fluxo do diagrama que você desenhou, sem construir um cadastro manual completo.
8. Teste ponta a ponta num celular real contra o ambiente publicado (não localhost) — HTTPS, câmera real, latência de rede real.
9. Colocar o Pedro e petshops reais para testar e observar se o fluxo de escanear→resultado é rápido/confiável o suficiente na iluminação real da loja.

Essa ordem prioriza responder a pergunta técnica mais arriscada (a câmera/scanner funciona bem em campo?) antes de investir em qualquer coisa que dependa dela ter dado certo.

---

## 9. Protótipo PetGest — quais telas usar no V0

Você tem, em `Projetos/PetGest`, um protótipo navegável (HTML/CSS/JS vanilla, sem backend) com **7 telas**: Dashboard, Produtos, Estoque, Reposição, Fornecedores, Relatórios e Configurações. Antes de mapear telas, um ponto importante primeiro:

**Esse protótipo foi desenhado como um sistema completo de gestão de estoque** — os indicadores do Dashboard, a tela de Estoque (entradas/saídas), a Reposição (sugestão de compra por estoque mínimo) e Fornecedores giram inteiramente em torno de controle de estoque. Isso é exatamente o que as 4 conversas com petshops mostraram **não ser uma dor validada** ainda, e é o que você mesmo excluiu explicitamente do V0. Vale confirmar com você: esse protótipo foi construído como material de venda/demonstração (para o Pedro mostrar a visão de produto a potenciais clientes), separado da entrega técnica do V0? Se for esse o caso, faz todo sentido mantê-lo como está, à parte, e usar aqui só o que interessa tecnicamente. Meu mapeamento assume isso.

### Usar no V0 (parcialmente)

**Tela "Produtos"** — é a mais próxima do que o V0 precisa, e vale usar como base:
- Manter: busca por nome/código, botão "Cadastrar produto", a lista/catálogo de produtos.
- Manter do formulário (`editForm`): Nome do produto, Categoria, e principalmente o campo **Código de barras + botão "Escanear"** — o protótipo já prevê exatamente esse fluxo (campo opcional com atalho para escanear), o que confirma que a experiência que vocês desenharam bate com a recomendação técnica (scanner com fallback manual). Manter também Preço de venda.
- Remover/ignorar por enquanto: Fornecedor (sem módulo de fornecedores no V0), Estoque inicial e Estoque mínimo, Situação (ativo/inativo), Preço de custo, Unidade de medida e Código interno/SKU (podem ficar para quando o produto realmente tiver conceito de estoque).
- Remover da listagem: colunas "Estoque", "Mínimo" e "Status", e o filtro rápido por status (Normal/Baixo/Em falta) — não existe estoque no V0. O filtro por categoria pode ficar.

**Tela "Configurações"** — usar só a parte de "Dados da loja" (nome, e-mail, telefone), que é literalmente o cadastro de petshop do V0. Deixar de fora: estoque mínimo padrão, multiplicador de sugestão de compra, alertas — tudo dependente de estoque. O seletor de cor principal (design tokens em variáveis CSS) é inofensivo e pode ficar se for barato de manter.

### Não usar no V0

- **Dashboard** — todo baseado em indicadores de estoque e "produtos que precisam de atenção"; não há dado nenhum disso no V0.
- **Estoque** — é exatamente o "sistema completo de estoque" que você decidiu excluir.
- **Reposição** — depende de estoque mínimo/sugestão de compra; fora de escopo.
- **Fornecedores** — "gestão de fornecedores" está na sua lista explícita do que não entra no V0.
- **Relatórios** — depende de dados de estoque/movimentação que o V0 não coleta; prematuro.

### O que vale reaproveitar independentemente das telas

O `style.css` do protótipo tem um design system decente (variáveis CSS centralizadas, tabelas que viram cards via container query, sprite de ícones SVG) — vale portar esses tokens visuais (cores, espaçamento, tipografia, o padrão responsivo tabela→card) como base de estilo do app React do V0, mesmo descartando a maior parte das telas e da lógica de estoque em si. Isso significa que o protótipo não foi trabalho perdido — só está resolvendo um problema (visão de produto completo) diferente do que o V0 precisa resolver agora (validar scanner + cadastro simples).

---

## 10. Atualização — infraestrutura mudou para Supabase + Vercel

As seções 2, 5 e 7 acima (PostgreSQL genérico, ASP.NET Core Identity + JWT,
deploy em Azure App Service) foram **substituídas** por uma decisão
posterior: banco de dados e autenticação passam a ser o **Supabase**, e
todo o site é hospedado na **Vercel** — sem uma API própria de longa
duração rodando à parte (ASP.NET Core sai do V0). O frontend continua
React + TypeScript + Vite, e o scanner continua recomendando o pacote
`barcode-detector` (seção 4 acima permanece válida).

O plano de implementação detalhado (modelagem das tabelas, Row Level
Security, fluxo de autenticação, migração do protótipo PetGest atual e
roadmap passo a passo) está em `claude/plano-backend-supabase-vercel.md`.