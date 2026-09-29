## Why

O próximo salto do PetGest é cadastrar produto por **foto + IA** e **voz + IA** — receber imagem/áudio, chamar um modelo externo, validar a resposta e devolver um `ProductDraft`. Isso é orquestração no servidor que o Supabase (RLS + funções SQL) não comporta bem, que é exatamente o gatilho de `PLANOMVP.md` §4.5 para abrir a fase de API própria. O `PLANOMVP.md` deixa várias escolhas "para o momento da migração"; esta change as fixa antes que qualquer código de backend exista (`ROADMAPV1.md` T-11).

## What Changes

Change só de decisão — nenhum código, nenhuma pasta `backend/`, nenhuma dependência .NET.

- **Gatilho registrado:** foto/voz + IA precisando de orquestração no servidor (`PLANOMVP.md` §4.5, 2º item). Evidência: é a próxima funcionalidade planejada (§5 "Futuro") e não cabe em RLS/RPC; não há pedido de petshop nem limite do Supabase atingido.
- **Exceção consciente à regra "Quando começar"** do `ROADMAPV1.md`: o V1 começa **sem o V0 fechado**. A T-10 continua aberta em paralelo, bloqueada só pelo teste em iPhone (sem aparelho disponível). Nada do V1 vai para produção (T-18) antes de a T-10 fechar.
- **Banco:** o Postgres do projeto Supabase continua sendo o banco, agora acessado pela API via EF Core/Npgsql. Azure Database for PostgreSQL fica descartado nesta fase.
- **Autenticação:** ASP.NET Core Identity + JWT substitui o Supabase Auth (recomendação de §4.2). Supabase passa a ser **só banco**.
- **Usuários existentes:** importados para o Identity preservando o UUID e o hash bcrypt, com verificação compatível e re-hash no primeiro login (detalhe e alternativa no design).
- **Estrutura do backend:** projeto único ASP.NET Core Web API com pastas (§4.3) — confirmado; separar em `Api/ Application/ Domain/ Infrastructure/` não se justifica.
- **Provedor de IA:** **em aberto**. O design compara OpenAI, Azure OpenAI e Google (SDK C#) e define como estimar o custo por cadastro; a escolha acontece antes da T-19.
- **Documentos atualizados depois da aprovação:** `CLAUDE.md` (stack ativa passa a ser a do V1), `ROADMAPV1.md` (T-11 concluída, banco decidido nas T-13/T-17/T-18) e `PLANOMVP.md` §5 ("a decidir" → decidido).

## Capabilities

### New Capabilities
<!-- nenhuma -->

### Modified Capabilities
<!-- nenhuma -->

Esta change declara `skip_specs: true`: registra decisões de arquitetura, sem comportamento novo para o usuário. As mudanças de requisito (auth, produtos, captura por IA) entram com delta de spec nas T-13 a T-20.

## Impact

- **Documentos:** `CLAUDE.md`, `ROADMAPV1.md`, `PLANOMVP.md` (§4.3/§4.4/§5, só onde a decisão contradiz o texto).
- **Tarefas seguintes:** T-12 a T-18 passam a assumir Supabase Postgres + Identity; a T-18 encolhe (não há cópia de `petshops`/`products` entre bancos, só a troca de `auth.users` pelo Identity). T-19/T-20 dependem da escolha do provedor de IA.
- **Supabase:** o projeto não é desligado no fim do V1 (vira só banco) — o passo "desligar o Supabase" da T-18 muda para "desligar o Supabase Auth e as políticas que dependem de `auth.uid()`".
- **Código:** nenhum.
