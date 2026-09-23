## Why

O app ainda não tem porta de entrada: a URL publicada abre direto o spike do scanner e o login do protótipo só simula. T-06 (produtos) e T-08 (configurações) dependem de um usuário autenticado e vinculado a um petshop — o RLS de T-02 só devolve dados nessa condição. Esta etapa troca a simulação por Supabase Auth de verdade, cria o cadastro de conta + loja e monta o shell do protótipo onde as próximas telas vão entrar.

## What Changes

- **Tela "Entrar"** portada do protótipo, com `signInWithPassword`, mensagens de erro em português e botão de mostrar/ocultar senha. **Removidos** do protótipo: "Manter conectado" (a sessão sempre persiste) e "Esqueci minha senha" (recuperação por e-mail fica para quando a confirmação de e-mail for reativada).
- **Tela "Criar conta"** (nova — não existe no protótipo): nome da loja, telefone (opcional), e-mail e senha → `signUp` seguido de `rpc('signup_petshop')`. O e-mail de login é também o e-mail da loja (editável depois em T-08).
- **Cadastro incompleto:** conta autenticada sem petshop (ex.: `signUp` deu certo e o `rpc` falhou) cai numa tela "Concluir cadastro da loja" em vez de um app vazio.
- **Proteção de rota** via `onAuthStateChange`: sem sessão → "Entrar"; depois de entrar, volta para a página que tentou abrir.
- **Shell do protótipo:** sidebar (Produtos, Configurações, nome da loja, Sair), topbar e gaveta de navegação no celular. As áreas Produtos e Configurações ficam com um estado vazio "em breve" até T-06/T-08.
- **Sair** com `signOut`.
- **Rotas** com `react-router`: `/entrar`, `/criar-conta`, `/produtos`, `/configuracoes` (protegidas) e **`/spike` pública** — o spike do scanner continua acessível sem login para terminar os testes de T-01, até T-07 integrar o scanner.
- **CSS portado para `shared/ui/`** só do que estas telas usam: layout, sidebar, topbar, botões, formulário/campos, estado vazio, botão de sair, tela de login e o trecho responsivo da gaveta (regra de T-04, design D2).

## Capabilities

### New Capabilities
- `app-shell`: estrutura de navegação do app autenticado — áreas Produtos e Configurações, identificação da loja, gaveta no celular e rota pública do spike.

### Modified Capabilities
- `auth`: acrescenta os fluxos de tela — entrar, criar conta com a loja, concluir cadastro incompleto, proteção de rota e sair. Os requisitos atuais (conta já autenticada, login, sessão persistida, chave pública) não mudam.

## Impact

- **Dependência nova:** `react-router` em `frontend/`.
- **Código novo:** `features/auth/` (telas, sessão, guarda de rota), `shared/ui/` (CSS de componentes + shell), `App.tsx` passa a ser o roteador.
- **Spike (T-01):** sai de `/` para `/spike`; nenhum arquivo de `features/scanner/` muda. Quem testar a T-01 pelo celular usa `<url>/spike`.
- **Supabase:** nenhuma mudança de schema ou configuração — usa `signup_petshop` (T-02) e o Auth de T-03.
- **Teste obrigatório em celular real** (Android e iPhone) antes de arquivar, conforme `CLAUDE.md`.
- **Dependência do roadmap:** `ROADMAPV0.md` diz que T-05 só avança com T-01 pronta; T-01 ainda tem testes de campo pendentes. Esta change não depende tecnicamente do scanner, então segue em paralelo — o fechamento de T-01 continua obrigatório antes de T-07.
