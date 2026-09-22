## Context

Motivação em `proposal.md`. Requisitos em `specs/tenant-data/spec.md`.

- Ponto de partida: SQL de `PLANOMVP.md` §3.2 (tabelas, RLS, `signup_petshop`).
- O cliente é o `supabase-js` no navegador, com a `anon key` pública. Tudo o que o RLS permitir, qualquer usuário logado consegue fazer chamando a API REST do Supabase diretamente — o frontend não é barreira de segurança.
- No Supabase, as tabelas de `public` já vêm com `GRANT` para `anon` e `authenticated`; quem restringe é o RLS. Funções em `public` também ficam executáveis por `anon` por padrão.
- Regra de `CLAUDE.md`: o frontend nunca filtra `petshop_id` manualmente.

## Goals / Non-Goals

**Goals:**
- Schema único, versionado e reaplicável (`supabase/schema.sql`).
- Isolamento por petshop garantido só pelo banco, verificável por um roteiro de teste reproduzível.
- O frontend (T-05 a T-08) nunca lida com `petshop_id`.

**Non-Goals:**
- Supabase CLI / migrations formais — o SQL Editor basta para o V0 (reavaliar se o schema começar a mudar com frequência).
- Múltiplos usuários por petshop, papéis, convites.
- Configuração do Auth (T-03).

## Decisions

### D1. Um arquivo idempotente em vez de migrations
`create table if not exists`, `create or replace function`, `drop policy if exists` + `create policy`. Rodar de novo atualiza funções/políticas sem apagar dados. Limitação conhecida: mudanças em colunas de tabela já existentes não são aplicadas por reexecução — quando isso acontecer, adotar migrations (Supabase CLI).

### D2. `current_petshop_id()` como `security definer stable`
Todas as políticas comparam com `(select public.current_petshop_id())`. Motivos: (a) lê `profiles` sem depender do RLS da própria `profiles`; (b) o `(select ...)` faz o Postgres avaliar uma vez por consulta, não por linha — recomendação de performance do Supabase para RLS; (c) um lugar só para mudar quando houver vários funcionários. `search_path = ''` e nomes qualificados evitam sequestro de `search_path` em função `security definer`.

### D3. `profiles` só com SELECT — sem política de UPDATE
O plano original tinha `for update using (id = auth.uid())`. Sem `with check` restringindo `petshop_id`, o usuário pode fazer `update profiles set petshop_id = '<id de outro petshop>'` e, a partir daí, todas as políticas o tratam como membro do outro petshop. O V0 não tem nenhum caso de uso que altere `profiles` pelo cliente; o vínculo nasce só em `signup_petshop`. O roteiro de teste cobre esse ataque (verificado: com a política antiga, o teste falha).

### D4. `products.petshop_id default current_petshop_id()`
O insert do frontend manda só `name, category, price, ean, source`. Sem o default, o cliente teria que buscar e enviar o `petshop_id`, contrariando a regra de `CLAUDE.md`. O `with check` da política continua barrando qualquer `petshop_id` alheio enviado explicitamente.

### D5. `updated_at` por trigger
Evita depender do cliente para manter o campo correto.

### D6. `signup_petshop` endurecida
- Recusa `auth.uid()` nulo (anônimo) e usuário que já tem profile (erro `23505`), em vez de cair num erro de PK genérico.
- `revoke execute ... from public, anon`; `grant ... to authenticated`.
- `btrim` em nome/e-mail; telefone vazio vira `null`.
- `petshop_phone` com default `null` (opcional na chamada).

### D7. Validações mínimas no banco
Nome e categoria não vazios; `price >= 0`; `ean` nulo ou só dígitos com 8–14 caracteres (EAN-8, UPC-A, EAN-13, GTIN-14). Produtos sem código (ex.: ração a granel, serviços) usam `ean = null`. Validações de formato mais ricas ficam no frontend.

### D8. Permissões explícitas, sem exposição automática
O projeto é criado com "Enable Data API" ligado, "Automatically expose new tables" **desligado** (recomendação do Supabase) e "Enable automatic RLS" desligado (o schema já liga o RLS em cada tabela). Por isso o `schema.sql` faz `revoke all` e concede só o que o app usa: `authenticated` recebe `select, update` em `petshops`, `select` em `profiles` e CRUD em `products`; `anon` não recebe nada. São duas camadas: permissão (o que o papel pode tentar) + RLS (em quais linhas). O roteiro de teste passa com a exposição automática ligada ou desligada.

## Risks / Trade-offs

- [Petshop que usa código interno com letras no campo de código] → a constraint recusa; se aparecer no teste de campo, afrouxar a regex (é uma linha no schema).
- [Usuário criado no Auth mas `signup_petshop` falha (rede caiu entre as duas chamadas)] → fica um usuário sem petshop, que não vê nada. T-05 deve detectar "logado sem profile" e oferecer concluir o cadastro chamando `signup_petshop` de novo.
- [Reexecução do schema não altera colunas existentes] → D1.
- [Tabela nova criada no futuro sem `grant`] → a API responde "permission denied"; basta adicionar o `grant` correspondente no `schema.sql` (D8).

## Migration Plan

Banco novo — nada a migrar. Aplicar `supabase/schema.sql` no SQL Editor; depois rodar `supabase/tests/rls_test.sql` e confirmar "RLS OK". Rollback: apagar o projeto Supabase ou `drop table products, profiles, petshops cascade` + `drop function` das três funções.

## Open Questions

- Nenhuma bloqueante. A reativação da confirmação de e-mail fica registrada em T-03.
