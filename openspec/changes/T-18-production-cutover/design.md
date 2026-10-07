## Context

Motivação em `proposal.md`; o passo a passo do dia está em `runbook.md`.

- **Decisões herdadas:**
  - **T-11:** sem cópia de dados (D2); contas importadas com o hash bcrypt e re-hash no login (D4); a T-18 não começa antes de a T-10 ser arquivada (D1).
  - **T-13:** migration `V0Schema` igual ao `schema.sql` (ensaiado).
  - **T-14:** ordem `IdentitySchema` → importar → `ProfilesUserFk`.
  - **T-16:** `VITE_BACKEND=api` na Vercel.
  - **T-17:** App Service `production`.
  - **T-22:** e-mail real e recuperação de senha.
- **Situação conhecida da produção (2026-10-06):**
  - uma conta de cliente (loja "Rusticão"), mantida de propósito;
  - a conta e a loja do teste de campo ("Pet Shop Amigo Fiel"), mantidas;
  - uma loja órfã ("Pet test"), cujo usuário foi apagado no painel.
  
  Nada disso pode ser apagado pela virada.
- **Restrição desta etapa:** a preparação foi feita sem acesso de escrita à produção e sem executar nada nela.

## Goals / Non-Goals

**Goals:**
- Virada sem perda: toda conta ativa entra com a senha de sempre, toda loja e todo produto continuam visíveis para o dono.
- Cada passo idempotente e conferido por uma consulta; rodar de novo nunca piora.
- Volta ao V0 possível durante a janela e no período de observação.

**Non-Goals:**
- Executar a virada (tarefas do usuário, depois da T-10).
- Apagar dados órfãos ou de teste.
- Remover o caminho Supabase do frontend (`@supabase/supabase-js`): fica para uma change depois da observação, como a T-16 previu.

## Decisions

### D1. Scripts SQL em vez de `dotnet ef database update` contra a produção
A virada roda no SQL Editor do Supabase, como `postgres`, com arquivos versionados.
- Os passos de migration (3 e 5) são gerados pelo próprio EF (`dotnet ef migrations script --idempotent`), com o comando de regeneração no cabeçalho de cada arquivo.
- Os passos manuais (baseline, importação, conferências) são SQL escrito à mão.
- **Por quê:**
  - a ordem tem um passo que não é migration (importar contas) no meio;
  - o papel da API (`petgest_api`) não tem DDL (T-17, D5);
  - um arquivo revisável no repositório é melhor que um comando com a string de conexão da produção no terminal.

### D2. Ensaio automático com os arquivos de verdade
`T18RehearsalTests` monta um banco igual ao de produção:
- simulacro do Supabase, agora com `encrypted_password`, `email_confirmed_at`, `deleted_at` e `is_anonymous`;
- `supabase/schema.sql`;
- dados do V0: hash `$2a$10$` gerado pelo mesmo bcrypt, uma conta confirmada, uma não confirmada, uma apagada e uma loja órfã.

Depois roda os seis arquivos **duas vezes** (idempotência) e confere:
- nenhuma migration pendente (pega um passo 5 desatualizado);
- as conferências do passo 6;
- e-mail normalizado;
- conta apagada fora;
- loja órfã intacta.

Por fim, sobe a API contra esse banco: login com a senha do V0 (com outra caixa no e-mail), produtos da loja, re-hash, conta não confirmada barrada e recuperada pela T-22, conta apagada recusada. Também ensaia fechar e reabrir a Data API.

### D3. Quem é importado e como
Entram as contas de `auth.users` com `deleted_at is null`, não anônimas e com e-mail, com:
- **id:** o mesmo, então `profiles.id` continua valendo;
- **e-mail:** em minúsculas, com `user_name` igual ao e-mail e as versões normalizadas em maiúsculas, como o cadastro da API grava;
- **confirmação:** `email_confirmed = email_confirmed_at is not null`. No V0 a confirmação estava desligada, então o Supabase marcava as contas como confirmadas no cadastro;
- **senha:** `password_hash` = o hash bcrypt;
- **carimbos:** de segurança e de concorrência novos.

A conferência inicial (passo 1) mostra o prefixo e o custo dos hashes, que a T-11 mandou conferir antes. Se não forem `$2a$`/`$2b$`, o roteiro para e vai para o plano B: importar sem senha e pedir "Esqueci minha senha", que a T-22 viabiliza. O passo 1 também lista **vínculos de contas que não serão importadas**: com eles, a FK do passo 5 falharia. Decidir antes, sem apagar.

### D4. Data API fechada só depois da observação
O roadmap pedia fechar a Data API na janela. Isso, porém, quebraria o próprio rollback: o frontend do V0 lê as tabelas por ela. A ordem passa a ser:
1. **janela:** virar o frontend para a API, mantendo o V0 intacto;
2. **observação** (sugestão: 7 dias com uso normal);
3. **depois:** `fechar-data-api.sql`, com `reabrir-data-api.sql` à mão para emergência.

Enquanto a Data API estiver aberta, a chave anon publicada pelo V0 continua dando acesso **só** ao que o RLS do V0 já permitia (cada usuário à própria loja). Não há exposição nova.

### D5. Rollback por etapa
| Momento | Como voltar | Efeito colateral |
|---|---|---|
| Passos 1–4 | nada a desfazer: só criaram tabelas novas e copiaram contas; o V0 continua igual | — |
| Passo 5 (FK) | o V0 continua lendo e gravando | **cadastro novo no V0** falha (a FK aponta para `identity.users`) até o fim do rollback |
| Vercel virada | remover `VITE_BACKEND`/`VITE_API_URL` e Redeploy, ou *Instant Rollback* para o deploy do V0 | senha trocada pela API não vale no V0; conta criada pela API não existe no V0 |
| Depois de fechar a Data API | `reabrir-data-api.sql` + rollback da Vercel | — |

Produtos gravados pela API durante a janela ficam nas mesmas tabelas e aparecem no V0 (o RLS do V0 vale para eles).

## Risks / Trade-offs

- [Hash em formato inesperado] → passo 1 detecta; plano B (D3).
- [Migration nova sem regerar o passo 5] → o ensaio falha; o cabeçalho do arquivo traz o comando.
- [Projeto Supabase pausar com a API em cima] → pré-requisito: plano Pro (`ROADMAPV1.md`, T-18).
- [Usuário com sessão aberta no V0 durante a virada] → ao recarregar no V1, vai para a tela de entrar; a senha é a mesma.
- [E-mail real não configurado] → `RequireConfirmedEmail=true` com envio só no log impede a API de subir (T-22, `EmailSettings.Validate`).
