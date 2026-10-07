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

-- Só as colunas que o schema.sql e os scripts da T-18 (backend/deploy/t18) usam, com os
-- mesmos nomes e tipos do auth.users do Supabase.
create table if not exists auth.users (
  id                 uuid primary key,
  email              text,
  encrypted_password text,
  email_confirmed_at timestamptz,
  deleted_at         timestamptz,
  is_anonymous       boolean not null default false
);

-- Sem JWT nos testes: ninguém está logado.
create or replace function auth.uid() returns uuid
language sql stable
as $$ select null::uuid $$;
