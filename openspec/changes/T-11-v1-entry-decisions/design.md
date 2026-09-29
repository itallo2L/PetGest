## Context

Motivação em `proposal.md`. Sem specs (`skip_specs: true`): esta change fixa decisões que as T-12 a T-21 vão implementar, cada uma com os próprios deltas de spec.

- **V0 em produção** (`pet-gest.vercel.app`): React + Vite na Vercel, Supabase (Auth + Postgres + RLS) em São Paulo. A T-10 está aberta: Android validado, iPhone pendente (sem aparelho).
- **Acoplamento do banco ao Supabase Auth** (`supabase/schema.sql`): `profiles.id` referencia `auth.users(id)`; `current_petshop_id()` e `signup_petshop()` leem `auth.uid()`; as políticas de RLS e os `grant`s são para o papel `authenticated`. O frontend chama `supabase.auth` / `.from` / `.rpc` direto (14 pontos em `frontend/src`).
- **Usuários:** poucas contas, todas do próprio usuário (teste de campo), sem petshop cliente ainda.

## Goals / Non-Goals

**Goals:**
- Cada escolha que o `PLANOMVP.md` deixou "para a migração" tem uma decisão com motivo e alternativa descartada, ou está explicitamente em aberto com critério e prazo.
- As T-12 a T-18 podem ser propostas sem reabrir estas decisões.

**Non-Goals:**
- Escolher o provedor de IA (fica para o início da T-19, com o critério daqui).
- Detalhar endpoints, DTOs, migrations ou telas — são das T-12 a T-16.
- Fechar o V0: a T-10 segue o próprio caminho.

## Decisions

### D1. Gatilho: foto/voz + IA; V1 começa com o V0 aberto
Gatilho de `PLANOMVP.md` §4.5, 2º item. Os outros três não estão presentes (lógica cabe em RLS/RPC, sem jobs pesados, sem volume) — registrado para não parecer que o V1 resolve um problema que não existe.

**Exceção à regra "Quando começar" (decisão do usuário):** o teste em iPhone depende de um aparelho que o usuário não tem agora, e ele não bloqueia nenhuma decisão de backend. Limites da exceção:
- a T-10 continua aberta e é a única dona do fechamento do V0;
- defeitos do iPhone são corrigidos no V0 (changes T-05 a T-09), não no V1;
- **a T-18 (virada da produção) não começa antes de a T-10 ser arquivada** — o V1 não vai a produção por cima de um V0 não validado.

Alternativa descartada: esperar o iPhone. Parado sem prazo, sem ganho de risco (T-12 a T-17 não tocam produção).

### D2. Banco: Postgres do Supabase, só como banco
A API (EF Core + `Npgsql`) conecta no mesmo Postgres do projeto Supabase de produção. Supabase deixa de ser "o backend" e vira hospedagem de Postgres (com backups e painel).

- **Por quê:** os dados de `petshops`/`products` não mudam de lugar — a T-18 deixa de copiar dados entre bancos e passa a só trocar o dono das contas; sem custo novo de banco gerenciado; `JSONB` e `pgvector` disponíveis do mesmo jeito (`PLANOMVP.md` §2.3).
- **Conexão:** pelo pooler do Supabase (Supavisor) — a conexão direta é só IPv6 sem o add-on de IPv4, e o App Service sai por IPv4. Modo *session* (porta 5432) para migrations e para a API com um pool pequeno; revisar o modo *transaction* só se o número de conexões virar problema.
- **Região:** App Service em **Brazil South**, perto do Supabase em São Paulo — cada requisição passa a ter um salto a mais (Vercel → API → banco) e a distância entre API e banco é o que pesa.
- **Papel de banco da API:** um papel dedicado (ex.: `petgest_api`) com `grant`s só nas tabelas do app — nunca o `postgres`. Esse papel ignora RLS (`bypassrls`); o isolamento por petshop passa para a API (filtro global no `DbContext`, T-13), como o `ROADMAPV1.md` já prevê.
- **Superfície do Supabase fechada:** depois da virada, a Data API (PostgREST) do projeto é desligada ou os `grant`s para `anon`/`authenticated` são revogados — senão as tabelas continuam acessíveis pela chave anon pública que o V0 publicou.
- **Tabelas do Identity** num schema próprio (`identity`), fora do schema exposto pela Data API.

**Conferido em 2026-09-29** (projeto `cqkqfypdmpwiuhdczlmu`, Postgres 17.6; documentação do Supabase):
- O pooler compartilhado (Supavisor) aceita IPv4 em todos os planos: modo *session* na porta 5432, modo *transaction* na porta 6543, host no formato `aws-[região].pooler.supabase.com`. A conexão direta só é IPv6, a não ser que se contrate o add-on de IPv4 (disponível só no Pro). Isso confirma a escolha pelo modo *session*.
- O modo *transaction* não aceita *prepared statements*. Se um dia a API migrar para ele, desligar o `Max Auto Prepare` do Npgsql.
- Projetos no plano gratuito pausam depois de 7 dias com pouca atividade no banco; projetos pagos nunca pausam. Isso reforça o risco de pausa listado abaixo.
- Painel (conferido pelo usuário): região **South America (São Paulo), `sa-east-1`** — confirma Brazil South para o App Service; o host do pooler fica em `sa-east-1` (o endereço exato entra na configuração da T-17). Compute `t4g.nano`, limite de **60 conexões** — a API usa um pool pequeno (ex.: `Maximum Pool Size` ≤ 10) para não disputar conexões com Auth/PostgREST/Storage.
- Plano atual: **gratuito**. O projeto pausa se ficar 7 dias sem uso — aceitável enquanto só o V0 roda e nada do V1 está em produção; **passar para o Pro é pré-requisito da T-18** (ver Riscos).

Alternativa descartada: Azure Database for PostgreSQL (tier burstable) — ganho de ficar tudo na Azure, mas custo mensal fixo novo e uma migração de dados a mais na T-18, sem benefício funcional para foto/voz. Pode voltar a ser avaliada se o Supabase limitar (conexões, pausa, preço).

### D3. Autenticação: ASP.NET Core Identity + JWT
Recomendação de `PLANOMVP.md` §4.2, confirmada pelo usuário. Identity com chave `Guid` (o mesmo tipo de `auth.users.id`), papel único, JWT de acesso de vida curta + refresh token com rotação guardado com hash no banco. O cadastro usuário + petshop vira uma transação na API (sucessor de `signup_petshop`). Confirmação de e-mail e recuperação de senha passam a ser do Identity (pendência herdada do V0).

Onde o frontend guarda os tokens (memória + `localStorage`, como o `supabase-js` faz hoje, ou cookie `HttpOnly` cross-site) é decisão da T-14 — não muda esta escolha.

Alternativa descartada: manter o Supabase Auth e a API só validar o JWT do Supabase. Seria o caminho mais curto (sem migrar usuários), mas mantém dois fornecedores no caminho crítico do login, deixa o cadastro atômico dividido entre `supabase.auth.signUp` e a API, e prende o banco a `auth.users`. Clerk/Auth0: custo por usuário e mais um fornecedor, sem ganho para um papel único.

### D4. Usuários existentes: importar com o hash bcrypt, re-hash no login
Na T-18, cada linha de `auth.users` vira um usuário do Identity com **o mesmo `id`**, o mesmo e-mail, o estado de confirmação (`email_confirmed_at`) e o hash de `encrypted_password` (bcrypt `$2a$`) copiado para `PasswordHash`. Um `IPasswordHasher` próprio reconhece o prefixo `$2`, verifica com bcrypt (`BCrypt.Net-Next`) e devolve `SuccessRehashNeeded` — o Identity regrava o hash no formato padrão (PBKDF2) no primeiro login e o bcrypt some sozinho.

- Com o mesmo `id`, `profiles.id` não muda de valor: só a FK troca de `auth.users(id)` para a tabela de usuários do Identity.
- O usuário não percebe a virada: mesma senha, mesma loja.

**Conferido em 2026-09-29:** `auth.users` do projeto de produção está vazia (as contas de teste da T-09/T-10 foram apagadas), então não há hash para conferir agora. A conferência do prefixo (`$2a$`/`$2b$`) e do custo passa para o checklist da T-18, numa cópia, antes da virada.

Alternativa (plano B, não o padrão): marcar todos para redefinir a senha no primeiro acesso. Descartada como padrão porque exige envio de e-mail funcionando no dia da virada e cria atrito; usada só se a importação falhar na conferência da T-18 (poucas contas, reversível).

### D5. Backend: projeto único com pastas
Confirma `PLANOMVP.md` §4.3: `backend/Api/` com `Endpoints/`, `Services/`, `Data/`, `Models/`. Contagem de casos de uso do V1 inteiro: auth (cadastro, login, refresh, logout, confirmar e-mail, pedir/redefinir senha), produtos (listar, criar, editar, excluir, buscar por EAN), loja (ler, salvar), rascunho por foto e por voz — cerca de 16 endpoints e um único domínio. Não justifica `Api/ Application/ Domain/ Infrastructure/`; a separação continua sendo um refactor mecânico se um dia justificar.

Runtime: **.NET 10 (LTS)**, a versão com suporte longo vigente — evita trocar de versão no meio do V1.

### D6. Provedor de IA: em aberto, com critério e prazo
A escolha acontece no início da T-19 (antes de qualquer código de IA), com um teste de bancada: ~20 fotos de embalagens reais e ~10 áudios gravados no petshop, os mesmos para todos os candidatos.

| | OpenAI | Azure OpenAI | Google (Gemini) |
|---|---|---|---|
| SDK C# | `OpenAI` (oficial) | `Azure.AI.OpenAI` | `Google.GenAI` (confirmar maturidade) |
| Foto → campos | modelo multimodal com saída em JSON Schema | mesmos modelos da OpenAI | multimodal com saída em JSON Schema |
| Voz → campos | transcrição + extração (2 chamadas) ou modelo com entrada de áudio | idem, conforme disponibilidade na região | áudio direto no modelo multimodal (1 chamada) |
| A favor | modelos novos primeiro, SDK simples | cobrança e segredos na mesma assinatura Azure do App Service | uma chamada para voz; preço costuma ser menor |
| Contra | mais um fornecedor/conta | exige criar deployments; modelos chegam depois e nem todos em Brazil South | mais um fornecedor/conta |

**Critérios, nesta ordem:** acerto dos campos (nome, categoria, preço) em PT-BR nas embalagens do bench → custo por cadastro → latência medida do Brasil → retenção de dados/LGPD (não usar os dados para treino) → ergonomia do SDK.

**Estimativa de custo por cadastro** (preencher com a tabela de preços vigente no dia da escolha — preços mudam demais para fixar aqui):
- Foto: `tokens_imagem + ~400 tokens de prompt` de entrada, `~150 tokens` de saída (JSON do `ProductDraft`); imagem reduzida no cliente para ≤ 1024 px no lado maior antes do envio.
- Voz: áudio de 10–20 s (por minuto, ou em tokens de áudio) + a mesma extração de texto.
- `custo = entrada × preço_entrada + saída × preço_saída (+ áudio × preço_áudio)`, multiplicado por um volume de referência (ex.: 500 cadastros/mês por petshop) para comparar com o custo fixo da infra.

Independente do provedor: o serviço fica atrás de uma interface (`IProductDraftExtractor`) e o provedor é um adaptador — trocar depois é trocar a classe e a configuração, não o fluxo.

### D7. Atualização dos documentos só depois da aprovação
Com esta change aprovada pelo usuário: `CLAUDE.md` passa a dizer que o V1 está em desenvolvimento (a produção segue no V0 até a T-18), `ROADMAPV1.md` recebe as consequências de D1–D6 nas tarefas afetadas e `PLANOMVP.md` troca o "a decidir" por decidido (§4.3, §4.4, §5). Antes da aprovação nenhum desses arquivos muda.

## Risks / Trade-offs

- [iPhone revela defeito que exige mudar o frontend enquanto a T-16 o porta] → correções do V0 entram na `dev` antes da porta da feature afetada; a T-16 reexecuta o roteiro da T-10 como critério de paridade.
- [Plano gratuito do Supabase pausa o projeto por inatividade] → o projeto está no plano gratuito (conferido em 2026-09-29); passar para o Pro antes da T-18 — com a API em cima, uma pausa derruba a produção inteira.
- [Tabelas continuam expostas pela Data API depois da virada] → revogar `anon`/`authenticated` ou desligar a Data API faz parte do checklist da T-18 (D2).
- [Papel `bypassrls` da API sem filtro por petshop em alguma consulta] → filtro global no `DbContext` e testes de integração portados de `supabase/tests/rls_test.sql` (T-13) antes de qualquer endpoint de dados.
- [Salto a mais por requisição (Vercel → Azure → Supabase)] → mesma região (Brazil South / São Paulo); medir no roteiro de paridade da T-16/T-18.
- [Formato do hash do Supabase diferente do esperado] → conferir o prefixo e o custo dos hashes numa cópia antes da virada; plano B de D4.
- [Dois sistemas de auth durante T-12 a T-17] → produção fica só no Supabase Auth; o Identity roda contra um banco de desenvolvimento/teste, nunca contra o de produção antes da T-18.

## Migration Plan

Sem migração nesta change. Efeito na T-18 (a ser detalhado lá): não há cópia de `petshops`/`products`; os passos passam a ser importar `auth.users` → Identity (D4), trocar a FK de `profiles.id`, remover `auth.uid()` das funções/políticas que deixam de ser usadas, fechar a Data API (D2) e publicar o frontend com `VITE_API_URL`. Rollback continua sendo o "Instant Rollback" da Vercel para o deploy do V0 enquanto o Supabase Auth não for desativado.

## Open Questions

- Provedor de e-mail transacional para confirmação e recuperação de senha (ex.: Azure Communication Services, Resend) — decidir na T-14; não muda D3.
- Ambiente de teste da API (T-17): um segundo projeto Supabase gratuito como banco de teste ou Postgres local em contêiner — decidir na T-17.

Aprovado em 2026-09-29
