-- Papel dedicado da API do V1 (ROADMAPV1.md, T-17; design D5 da T-17).
--
-- A API conecta com este papel, nunca com `postgres`: ele só lê e grava as tabelas do
-- app. O isolamento por petshop é feito pela própria API (T-13), por isso o papel ignora
-- o RLS do V0 (`bypassrls`).
--
-- Rodar no SQL Editor do Supabase, como `postgres`, DEPOIS de aplicar as migrations
-- (o script idempotente gerado pelo workflow `backend`), porque os `grant`s abaixo
-- valem para as tabelas que já existem. Rodar de novo é inofensivo.
--
-- Antes de rodar: troque TROQUE_POR_UMA_SENHA_FORTE por uma senha gerada (ex.: 32+
-- caracteres aleatórios) e guarde-a só nas configurações do App Service.

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'petgest_api') then
    create role petgest_api login password 'TROQUE_POR_UMA_SENHA_FORTE' bypassrls;
  end if;
end
$$;

-- Se o `bypassrls` for recusado ("permission denied to alter role"), a alternativa é
-- uma política por tabela liberando este papel, por exemplo:
--   create policy petgest_api_all on public.products for all to petgest_api using (true) with check (true);
-- (repetir para public.petshops e public.profiles).

grant usage on schema public to petgest_api;
grant select, insert, update, delete on public.petshops, public.profiles, public.products to petgest_api;

grant usage on schema identity to petgest_api;
grant select, insert, update, delete on all tables in schema identity to petgest_api;
grant usage, select on all sequences in schema identity to petgest_api;

-- Tabelas e sequências que migrations futuras criarem no schema identity, desde que
-- rodadas pelo mesmo papel que roda este script (`postgres` no Supabase).
alter default privileges in schema identity
  grant select, insert, update, delete on tables to petgest_api;
alter default privileges in schema identity
  grant usage, select on sequences to petgest_api;

-- Conferência: deve listar as 3 tabelas de public e as de identity.
select table_schema, table_name, string_agg(privilege_type, ', ' order by privilege_type) as privileges
from information_schema.role_table_grants
where grantee = 'petgest_api'
group by table_schema, table_name
order by table_schema, table_name;
