## Why

Todas as telas do V0 existem (T-05 a T-08), mas só rodam nos deploys de prévia da branch `dev`. O teste ponta a ponta em campo (T-10) precisa de um endereço de produção estável, servido a partir da `main`, com a configuração conferida — e a promessa central de segurança do V0 (nenhuma chave que ignore o RLS no frontend) verificada no build publicado, não só no local.

Parte do deploy já foi adiantada: variáveis `VITE_SUPABASE_*` na Vercel (T-05) e `vercel.json` com Vite/`dist`/rewrite de SPA (correção pós-T-05).

## What Changes

- **Produção = `main`** no domínio padrão da Vercel (ex.: `<projeto>.vercel.app`), HTTPS automático. Conferir no painel: Root Directory `frontend`, preset Vite, Production Branch `main`, variáveis em Production.
- **Merge `dev` → `main` só depois da validação no iPhone** (regra do `CLAUDE.md`: `main` recebe apenas o que foi validado). A T-09 prepara e verifica tudo; o PR é o último passo, feito pelo usuário.
- **Supabase Auth:** Site URL passa de `http://localhost:3000` para a URL de produção; Redirect URLs recebem produção e prévias. **Confirmação de e-mail continua desligada** — reativá-la vira change própria antes do primeiro cliente real (`PLANOMVP.md` §3.9).
- **Verificação de segurança no build publicado:** nenhum valor de `service_role`/`sb_secret_` no bundle nem nas variáveis da Vercel; a chave no bundle é a pública.
- **Teste de fumaça em produção:** endereços diretos (`/entrar`, `/produtos`, `/configuracoes`, `/spike`) abrem o app (rewrite de SPA), cadastro/login funcionam contra o Supabase.
- **`frontend/README.md`** troca o texto do template do Vite por: como rodar localmente (`.env.local`), variáveis, deploy (dev = prévia, main = produção) e a regra da chave pública.
- **`ROADMAPV0.md`** com o status de T-09 e a URL de produção.

Fora desta etapa: reativar confirmação de e-mail, domínio próprio, cabeçalhos de segurança HTTP, divisão do bundle (aviso de 500 kB), remoção do `/spike` (T-07 4.4).

## Capabilities

### New Capabilities
- `deployment`: o app publicado em produção — origem (`main`), HTTPS, endereços diretos funcionando e ausência de chave de serviço no que é entregue ao navegador.

### Modified Capabilities
<!-- nenhuma -->

## Impact

- **Arquivos:** `frontend/README.md` (reescrito), `ROADMAPV0.md`. `vercel.json` já está pronto (sem mudança prevista).
- **Sistemas externos:** painel da Vercel (conferência) e do Supabase (Site URL / Redirect URLs) — feitos pelo usuário.
- **Git:** PR `dev` → `main` aberto pelo usuário depois do teste no iPhone.
- **Supabase tier gratuito pausa o projeto após ~7 dias sem uso** — relevante para produção (ver design, riscos).
