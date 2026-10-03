-- O mínimo do Supabase para o supabase/schema.sql do V0 rodar num Postgres comum
-- (SchemaCompatibilityTests, design D7 da T-13). Não é usado fora dos testes.

do $$
begin
  if not exists (select from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
end $$;

create schema if not exists auth;

create table if not exists auth.users (
  id    uuid primary key,
  email text
);

-- Sem JWT nos testes: ninguém está logado.
create or replace function auth.uid() returns uuid
language sql stable
as $$ select null::uuid $$;
