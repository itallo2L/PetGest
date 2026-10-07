-- T-18, passo 6 — conferência DEPOIS da virada (só leitura). Comparar com o passo 1.

-- 1. Todas as contas importadas, com o estado de confirmação preservado. Esperado: zero
--    linhas (nenhuma conta do Supabase ficou de fora nem mudou de estado).
select u.id, u.email
from auth.users u
left join identity.users i on i.id = u.id
where u.deleted_at is null and not coalesce(u.is_anonymous, false) and u.email is not null
  and (i.id is null or i.email_confirmed <> (u.email_confirmed_at is not null));

-- 2. Todo vínculo aponta para uma conta do Identity. Esperado: zero linhas.
select pr.id, pr.petshop_id
from public.profiles pr
left join identity.users i on i.id = pr.id
where i.id is null;

-- 3. A FK de profiles.id agora aponta para identity.users. Esperado: identity.users.
select confrelid::regclass::text as fk_de_profiles
from pg_constraint where conname = 'profiles_id_fkey';

-- 4. Produtos por loja: os mesmos números do passo 1, item 3.
select p.id as petshop_id, p.name as loja,
       (select count(*) from public.profiles pr where pr.petshop_id = p.id) as usuarios,
       (select count(*) from public.products x where x.petshop_id = p.id) as produtos
from public.petshops p
order by p.name;

-- 5. Migrations aplicadas: as mesmas de Api/Data/Migrations, nenhuma faltando.
select migration_id from "__EFMigrationsHistory" order by migration_id;
