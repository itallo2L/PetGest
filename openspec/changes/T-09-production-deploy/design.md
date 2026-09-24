## Context

Motivação em `proposal.md`. Requisitos em `specs/deployment/spec.md`.

- **Git:** `dev` está 13 commits à frente da `main`; o último merge em `main` foi o PR #1 (spike da T-01). Regra do `CLAUDE.md`: trabalho só em `dev`; `main` recebe o que foi validado.
- **Vercel (estado conhecido):** projeto conectado ao repositório; deploys de `dev` funcionam desde a correção do `vercel.json` (`framework: vite`, `buildCommand`, `outputDirectory: dist`, rewrite `/(.*)` → `/index.html`); `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` cadastradas em Production e em Preview (branch `dev`), com a chave `sb_publishable_…`. Proteção de deploy padrão da Vercel exige login só em prévias.
- **Supabase:** projeto `sa-east-1`, tier gratuito; Auth com "Confirm email" desligado; Site URL ainda `http://localhost:3000`, sem Redirect URLs.
- **Build:** ~537 kB de JS (aviso de chunk > 500 kB, não bloqueia); `.wasm` do ZXing carregado do jsDelivr no iPhone (T-01 D6).
- **`frontend/README.md`:** ainda é o texto do template do Vite.

## Goals / Non-Goals

**Goals:**
- Um endereço de produção estável para a T-10, com a mesma configuração verificada da prévia.
- Prova, no que foi publicado, de que só a chave pública chega ao navegador.

**Non-Goals:**
- Reativar confirmação de e-mail (change própria antes de clientes reais).
- Domínio próprio, cabeçalhos HTTP de segurança, CI de testes, divisão do bundle, servir o `.wasm` localmente.

## Decisions

### D1. Produção é o deploy da `main` no domínio `.vercel.app`
Sem configuração nova além de conferir **Production Branch = `main`** e as variáveis em Production. A prévia de `dev` continua sendo o ambiente de teste. Alternativa (promover um deploy de prévia manualmente) descartada: quebraria a regra "`main` = validado" e deixaria produção sem ligação com um commit da `main`.

### D2. Merge `dev` → `main` por PR, depois do iPhone
A T-09 termina com o PR `dev` → `main` aberto pelo usuário **depois** que o teste no iPhone (T-04 a T-08 e T-01 5.4) estiver registrado. As tarefas de verificação desta change rodam na **prévia de `dev`**, que usa a mesma configuração; depois do merge, só um teste de fumaça curto na URL de produção.

### D3. Site URL e Redirect URLs agora, confirmação de e-mail depois
Site URL = URL de produção; Redirect URLs = produção, `https://*-<time>.vercel.app/**` (prévias) e `http://localhost:5183/**`. Hoje nada usa redirect (sem confirmação nem recuperação de senha), mas deixar certo evita que, ao reativar a confirmação, os e-mails apontem para `localhost:3000`.

### D4. Verificação de segredos no que foi servido, não só no local
Baixar os `.js` de `/assets/` do deploy de prévia (e de produção após o merge) e procurar `service_role`, `sb_secret_` e JWTs com `role=service_role`; confirmar que a chave encontrada é a `sb_publishable_…` do `.env.local`. Complementa a checagem local da T-03 (3.3): cobre o caso de variável errada cadastrada só na Vercel.

### D5. Teste de fumaça por endereço direto
Abrir `/entrar`, `/produtos`, `/configuracoes`, `/spike` e um caminho inexistente direto no navegador (sem navegação interna) — valida o rewrite do `vercel.json` na infraestrutura real. Criar uma conta de teste na prévia e confirmar cadastro/login contra o Supabase.

### D6. `frontend/README.md` como guia curto do projeto
Rodar local (`npm install`, `.env.local` a partir de `.env.example`, `npm run dev` na porta 5183), scripts (`build`, `lint`), deploy (`dev` → prévia, `main` → produção, variáveis), e a regra "só a chave pública; nunca `service_role`/`sb_secret_`". Sem duplicar `PLANOMVP.md` — aponta para ele.

### Observado na implementação
- A produção nunca teve deploy: o único build da `main` (merge do PR #1, 17/09) falhou antes da correção do `vercel.json`. `pet-gest.vercel.app` aparece como "No Deployment" até o PR desta change.
- As variáveis ficaram numa entrada única "Production and Preview" por chave (vale para qualquer branch de prévia), no lugar da divisão Production / Preview-`dev`.
- Três falhas de configuração apareceram na prévia e foram corrigidas no painel: Root Directory vazio (`vite: command not found`), variáveis ausentes no build (trava "Configuração do Supabase ausente") e a chave colada sem o `s` inicial (`Invalid API key`). Todas pegas pela verificação desta change — o código não mudou por causa delas.
- Correções pequenas feitas junto: título da aba (`index.html` ainda dizia "Spike do scanner") e sublinhado nos itens da barra lateral (links sem `text-decoration: none`, defeito da T-05).

## Risks / Trade-offs

- [Supabase gratuito pausa o projeto depois de ~7 dias sem requisições] → em produção de teste, um período sem uso deixa o app sem banco até reativar no painel; registrar no README e no `ROADMAPV0.md`; considerar plano pago antes de clientes reais.
- [Confirmação de e-mail desligada em produção] → qualquer pessoa com a URL cria conta com e-mail de terceiros; aceitável na T-10 com URL não divulgada; change própria antes de clientes reais.
- [`/spike` público em produção] → só expõe a tela de teste do scanner, sem dados; sai na T-07 4.4.
- [`.wasm` do jsDelivr] → dependência de CDN externo no iPhone (herdada da T-01).

## Migration Plan

1. Conferir Vercel e Supabase (usuário).
2. Verificações na prévia de `dev` (segredos, endereços diretos, cadastro/login).
3. Teste no iPhone (pendente das T-04 a T-08).
4. PR `dev` → `main` (usuário) → deploy de produção → fumaça na URL de produção.
Rollback: na Vercel, "Promote" do deploy de produção anterior (instantâneo), e reverter o merge na `main`.
