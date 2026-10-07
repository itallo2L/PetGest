-- T-18, passo 1 — conferência ANTES da virada (só leitura; não muda nada).
-- Rodar no SQL Editor do Supabase de produção e GUARDAR o resultado: o passo 6 compara.
-- Roteiro: openspec/changes/T-18-production-cutover/runbook.md

-- 1. Contas do Supabase Auth: total, confirmadas e formato do hash (design D3).
--    Esperado: todos os hashes com prefixo $2a$ ou $2b$ e custo 10. Outro prefixo = parar
--    e seguir o plano B do runbook (redefinição de senha no primeiro acesso).
select count(*)                                                      as contas,
       count(*) filter (where email_confirmed_at is not null)        as confirmadas,
       count(*) filter (where encrypted_password is null
                          or encrypted_password = '')                as sem_senha,
       string_agg(distinct left(encrypted_password, 7), ', ')        as prefixos_e_custo
from auth.users
where deleted_at is null;

-- 2. Contas que não serão importadas (apagadas, anônimas ou sem e-mail).
select id, email, deleted_at is not null as apagada, coalesce(is_anonymous, false) as anonima
from auth.users
where deleted_at is not null or coalesce(is_anonymous, false) or email is null;

-- 2b. Vínculos de contas que NÃO serão importadas. Esperado: zero linhas. Se houver, o
--     passo 5 (FK de profiles.id para identity.users) falha: decidir antes da virada o que
--     fazer com essas lojas (ex.: reativar a conta no Supabase) — não apagar sem decidir.
select pr.id as usuario, pr.petshop_id, u.email
from public.profiles pr
join auth.users u on u.id = pr.id
where u.deleted_at is not null or coalesce(u.is_anonymous, false) or u.email is null;

-- 3. Produtos por loja (guardar: o passo 6 precisa dar os mesmos números).
select p.id as petshop_id, p.name as loja,
       (select count(*) from public.profiles pr where pr.petshop_id = p.id) as usuarios,
       (select count(*) from public.products x where x.petshop_id = p.id) as produtos
from public.petshops p
order by p.name;

-- 4. Lojas sem nenhum usuário (ex.: conta de teste apagada no painel). Não atrapalham a
--    virada; ficam invisíveis para a API. Este roteiro não apaga nada.
select p.id, p.name, p.created_at
from public.petshops p
where not exists (select 1 from public.profiles pr where pr.petshop_id = p.id);

-- 5. Migrations do EF já registradas (esperado antes da virada: a tabela não existe).
select to_regclass('public."__EFMigrationsHistory"') is not null as historico_existe;
