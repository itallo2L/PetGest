## Context

Motivação em `proposal.md`. Requisitos em `specs/auth/spec.md` (delta) e `specs/app-shell/spec.md` (nova).

- **Protótipo:** tela de login em `index.html` (`.auth-screen`/`.auth-card`, linhas 60–111) e lógica em `script.js` §12 (validação de e-mail por regex, estado "Entrando…", mostrar/ocultar senha). Shell em `index.html` (sidebar, topbar, backdrop) e `script.js` §4 (navegação) e §10 (gaveta: `is-open`, backdrop, foco no botão fechar/menu, `is-locked` no body). Não existe tela de cadastro no protótipo.
- **CSS relevante no `style.css`:** LAYOUT (140–164), SIDEBAR (165–319), TOPBAR (320–410), BOTÕES (423–497), EMPTY STATES (1293–1331), FORMULÁRIOS (1412–1481, até `.form__error`), CAMPO COM AÇÃO (1507–1514), trechos de RESPONSIVO (1978–2032) e REFINAMENTO MOBILE ligados a sidebar/topbar/formulário/gaveta (2354–2396), BOTÃO DE SAIR (2532–2552), TELA DE LOGIN (2553–2663).
- **Supabase:** `signup_petshop(petshop_name, petshop_email, petshop_phone)` exige usuário autenticado, recusa segundo cadastro (`23505`) e só `authenticated` executa. Auth com confirmação de e-mail desligada (T-03): `signUp` já devolve sessão. Senha mínima padrão: 6 caracteres.
- **Frontend hoje:** `App.tsx` renderiza o spike direto; `shared/supabaseClient.ts` lança erro se faltar variável de ambiente; `vercel.json` já reescreve qualquer caminho para `index.html` (rotas do SPA funcionam no deploy).
- **Deploy:** a Vercel publica o spike hoje sem `VITE_SUPABASE_*` porque nada importa o client. A partir desta change o `App` importa o client — sem as variáveis na Vercel, o app inteiro (inclusive `/spike`) quebra no carregamento.

## Goals / Non-Goals

**Goals:**
- Um único estado de sessão do app (sessão + petshop), consumido pelas rotas e pelo shell.
- Telas visualmente iguais ao protótipo, reaproveitando classes e CSS dele.
- Nenhum caminho que deixe o usuário logado num app vazio sem saber o que fazer.

**Non-Goals:**
- Conteúdo de Produtos (T-06) e Configurações (T-08), toasts, modais.
- Recuperação de senha, "manter conectado", confirmação de e-mail, login social.
- Testes automatizados de UI (sem runner no `frontend/`; verificação manual guiada + celular real).

## Decisions

### D1. `react-router` com rotas declarativas
Rotas: `/entrar`, `/criar-conta`, `/concluir-cadastro`, `/produtos`, `/configuracoes`, `/spike`; `/` e qualquer outro caminho redirecionam para `/produtos`. As rotas protegidas ficam dentro de um layout que renderiza o shell (`<Outlet />`).
Alternativa descartada: trocar de área por estado React, como o protótipo — perde endereço próprio, recarregar volta para Produtos e o botão voltar do Android sai do app (contraria o requisito de navegação). Roteador feito à mão com `history` resolveria, mas T-06/T-07 vão precisar de parâmetros (ex.: produto em edição) e o `react-router` já cobre isso.

### D2. `SessionProvider` em `features/auth/` como fonte única da sessão
Contexto com `status: 'loading' | 'error' | 'signed-out' | 'no-petshop' | 'ready'`, `session`, `petshop` (`id`, `name`) e `refreshPetshop()`. `error` (acrescentado na implementação): a sessão existe mas o petshop não carregou (rede) — mostra "Sem conexão" com "Tentar de novo" em vez de prender o usuário no carregamento.
- Na montagem: evento `INITIAL_SESSION` do `onAuthStateChange`; com sessão, `select id, name from petshops` (`maybeSingle()` — o RLS devolve no máximo a loja do usuário) → `ready` ou `no-petshop`.
- `onAuthStateChange` atualiza o estado (`SIGNED_IN`, `SIGNED_OUT`, `TOKEN_REFRESHED`); o `supabase-js` já propaga o logout entre abas pelo `localStorage`.
- **Não** chamar o Supabase de dentro do callback do `onAuthStateChange` de forma síncrona: a documentação do `supabase-js` alerta para deadlock. A busca do petshop é agendada fora do callback (`setTimeout(..., 0)`).
- `refreshPetshop()` pede a sessão ao client (`getSession()`) em vez de usar a última recebida no callback: logo após o `signUp` o `SIGNED_IN` pode ainda não ter chegado.
- Cargas concorrentes: a mais antiga, ao ser superada, espera a mais nova em vez de terminar sem estado — quem aguarda `refreshPetshop()` sempre vê o status final.
- O `petshop_id` nunca é usado em query (regra do `CLAUDE.md`); o `id` só serve para saber se o vínculo existe.

### D3. Guardas de rota por status
- `RequireReady` (Produtos, Configurações): `loading` → tela de carregamento com a marca; `signed-out` → `/entrar` guardando o caminho de origem em `location.state.from`; `no-petshop` → `/concluir-cadastro`; `ready` → shell.
- `PublicOnly` (`/entrar`, `/criar-conta`): `ready` → `from` ou `/produtos`; `no-petshop` → `/concluir-cadastro`, **exceto** enquanto a tela de criar conta está enviando (ver D4).
- `RequireNoPetshop` (`/concluir-cadastro`): `signed-out` → `/entrar`; `ready` → `/produtos`.
- `/spike` fica fora de todas as guardas.

### D4. Criar conta = `signUp` + `rpc` na mesma submissão
1. Validação local: nome da loja não vazio, e-mail no formato do protótipo (`EMAIL_RE`), senha ≥ 6.
2. `signUp({ email, password })` → sessão imediata. O `SIGNED_IN` muda o status para `no-petshop`; a tela marca `submitting` num ref compartilhado com o `PublicOnly` para não ser redirecionada no meio.
3. `rpc('signup_petshop', { petshop_name, petshop_email: email, petshop_phone })` → `refreshPetshop()` → `ready` → `/produtos`.
4. Se o passo 3 falhar, a conta já existe e está logada: `refreshPetshop()` (status `no-petshop`) e navegar para `/concluir-cadastro` com a mensagem do erro. Se falhar com `23505` (loja já existe — duplo clique ou retry), só `refreshPetshop()`.
5. A flag `submitting` só é desligada quando a tela sai da árvore (ou quando o `signUp` falha e o usuário fica nela): o `navigate()` do `react-router` é uma transição e chega depois da atualização de status — desligar a flag antes faz o `PublicOnly` redirecionar sozinho e perder a mensagem.
Alternativa descartada: criar a loja por trigger em `auth.users` com metadados do `signUp` — mudaria o schema de T-02 e a decisão de `PLANOMVP.md` §3.1 (RPC `signup_petshop`).

### D5. Tradução de erros num único módulo (`features/auth/authErrors.ts`)
Mapeia `error.code` do Supabase Auth, com fallback por status:
- `invalid_credentials` → "E-mail ou senha incorretos."
- `user_already_exists` / `email_exists` → "Já existe uma conta com este e-mail." + link "Entrar"
- `weak_password` → "A senha precisa ter pelo menos 6 caracteres."
- `over_request_rate_limit` → "Muitas tentativas. Aguarde um minuto e tente de novo."
- falha de rede (`AuthRetryableFetchError` / status 0) → "Não foi possível conectar. Verifique a internet e tente de novo."
- qualquer outro → "Algo deu errado. Tente de novo." (erro original no `console.error` para diagnóstico).

### D6. CSS portado para `shared/ui/`, um arquivo por bloco do protótipo
`layout.css` (layout + sidebar + topbar + gaveta + botão de sair), `buttons.css`, `forms.css` (formulário, campos, campo com ação, `.form__error`), `empty-state.css`, e `features/auth/auth.css` (tela de login, reaproveitada por criar conta e concluir cadastro). Trechos copiados literalmente; as regras de `@media` que só tocam esses blocos vão junto ao final de cada arquivo. Classes de telas cortadas (`.nav__label` de seções que não existem, chips, KPI) não são trazidas. Removido do CSS de auth: `.auth-checkbox`, `.auth-form__forgot`, `.is-leaving` (não há mais esses elementos nem a transição de saída). `.auth-hint` foi mantido e reaproveitado como a linha "Ainda não tem conta? Criar conta" / "Já tem conta? Entrar"; `.auth-screen` deixa de ser overlay fixo e vira página de rota (única regra que difere do protótipo).

### D7. Shell como componentes pequenos, comportamento da gaveta igual ao protótipo
`AppShell` (layout + `<Outlet />`), `Sidebar`, `Topbar`. Título e subtítulo da topbar vêm de uma tabela por rota, como `script.js` §4. Gaveta: `is-open` + backdrop + `is-locked` no `body`, foco no botão fechar ao abrir e de volta no menu ao fechar, fecha em Esc, clique no backdrop e troca de rota. Iniciais da loja: primeira letra das duas primeiras palavras do nome, em maiúsculas.

### D8. Variáveis de ambiente na Vercel já nesta etapa
Adiantar de T-09 só a configuração de `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` no projeto da Vercel (ambientes Preview e Production), porque o teste em celular real exige o app publicado funcionando. T-09 continua dona do restante do deploy.

## Risks / Trade-offs

- [Contas de teste acumulam no Supabase] → tarefas de verificação usam e-mails `t05-teste-...@example.com` e o usuário apaga ao final.
- [Status `no-petshop` pisca durante o cadastro] → D4 (flag `submitting`) evita o redirecionamento; verificação cobre o fluxo feliz sem passar por `/concluir-cadastro`.
- [Mensagens do Supabase Auth mudam de código entre versões] → D5 centraliza o mapa e cai numa mensagem genérica, nunca num texto em inglês na tela.
- [Spike em `/spike` muda a URL que você usa nos testes de T-01] → registrado no `ROADMAPV0.md` e no resumo desta change.
- [`react-router` aumenta o bundle] → aceitável; é a única dependência nova e será usada por T-06/T-07/T-08.

## Migration Plan

1. Configurar as variáveis na Vercel (D8) **antes** do push, senão o deploy de `dev` publica um app que quebra ao carregar.
2. Push em `dev` → deploy → testes em celular real.
Rollback: reverter o commit; o spike volta para `/`.
