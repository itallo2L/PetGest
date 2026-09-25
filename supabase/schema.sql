-- =====================================================================
-- PetGest — schema do V0 (Supabase / Postgres)
--
-- Tabelas, Row Level Security e a função de cadastro `signup_petshop`.
-- Referência: PLANOMVP.md §3.2 — com as correções registradas em
-- openspec/changes/T-02-supabase-schema-rls/design.md (D2–D8).
--
-- Como aplicar: Supabase > SQL Editor > colar este arquivo inteiro > Run.
-- O script é idempotente: pode ser rodado de novo sem apagar dados
-- (tabelas/índices só são criados se não existirem; funções, triggers e
-- políticas são recriados).
-- =====================================================================

-- ---------------------------------------------------------------------
-- Tabelas
-- ---------------------------------------------------------------------

-- petshops: um por conta (dono/funcionário único no V0).
create table if not exists public.petshops (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (length(btrim(name)) > 0),
  email      text not null check (length(btrim(email)) > 0),
  phone      text,
  created_at timestamptz not null default now()
);

-- profiles: liga um usuário do Supabase Auth a um petshop.
-- 1 profile = 1 usuário; petshop_id pode, no futuro, ser compartilhado
-- por mais de um profile (vários funcionários) sem mudar o schema.
create table if not exists public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  petshop_id uuid not null references public.petshops (id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists profiles_petshop_id_idx
  on public.profiles (petshop_id);

-- ---------------------------------------------------------------------
-- Helper: petshop do usuário logado (D2)
--
-- security definer para ler `profiles` sem passar pelo RLS dela mesma
-- (evita recursão e deixa as políticas simples). `stable` + o padrão
-- `(select public.current_petshop_id())` nas políticas fazem o Postgres
-- avaliar uma vez por consulta, não uma vez por linha.
-- ---------------------------------------------------------------------
create or replace function public.current_petshop_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select p.petshop_id
  from public.profiles p
  where p.id = auth.uid()
$$;

revoke execute on function public.current_petshop_id() from public, anon;
grant execute on function public.current_petshop_id() to authenticated;

-- products: o cadastro por código de barras cai aqui.
-- `source` prepara o terreno para foto+IA e voz+IA.
-- `petshop_id` tem default = petshop do usuário logado (D4): o frontend
-- nunca precisa enviar nem filtrar por petshop_id.
create table if not exists public.products (
  id         uuid primary key default gen_random_uuid(),
  petshop_id uuid not null default public.current_petshop_id()
             references public.petshops (id) on delete cascade,
  name       text not null check (length(btrim(name)) > 0),
  category   text not null check (length(btrim(category)) > 0),
  price      numeric(10,2) not null check (price >= 0),
  ean        text check (ean is null or ean ~ '^[0-9]{8,14}$'),
  source     text not null default 'manual' check (source in ('barcode', 'manual')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Mesmo EAN pode existir em petshops diferentes, mas não duas vezes no
-- mesmo petshop. Também serve de índice para a busca do scanner.
create unique index if not exists products_petshop_ean_key
  on public.products (petshop_id, ean) where ean is not null;

-- ---------------------------------------------------------------------
-- updated_at automático em products (D5)
-- ---------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists products_set_updated_at on public.products;
create trigger products_set_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- Permissões da Data API (D8)
--
-- O projeto é criado com "Automatically expose new tables" DESLIGADO,
-- então nada é exposto por padrão: cada tabela recebe aqui só o que o app
-- usa. `anon` (sem login) não acessa nenhuma tabela. O RLS abaixo ainda
-- restringe cada operação ao petshop do usuário.
-- ---------------------------------------------------------------------
revoke all on public.petshops, public.profiles, public.products from anon;
revoke all on public.petshops, public.profiles, public.products from authenticated;

grant select, update                 on public.petshops to authenticated;
grant select                         on public.profiles to authenticated;
grant select, insert, update, delete on public.products to authenticated;

-- ---------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------
alter table public.petshops enable row level security;
alter table public.profiles enable row level security;
alter table public.products enable row level security;

-- profiles: só leitura do próprio vínculo (D3).
-- Não existe política de insert/update/delete: o vínculo é criado só pela
-- função signup_petshop. Uma política de UPDATE aqui permitiria ao usuário
-- trocar o próprio petshop_id e ler os dados de outro petshop.
drop policy if exists "profiles: dono vê e edita o próprio" on public.profiles;
drop policy if exists "profiles: dono atualiza o próprio" on public.profiles;
drop policy if exists "profiles: usuário lê o próprio vínculo" on public.profiles;
create policy "profiles: usuário lê o próprio vínculo" on public.profiles
  for select to authenticated
  using (id = (select auth.uid()));

-- petshops: só quem tem profile apontando para ele; sem insert/delete
-- pelo cliente (insert só via signup_petshop).
drop policy if exists "petshops: acesso do próprio dono" on public.petshops;
drop policy if exists "petshops: dono atualiza dados da loja" on public.petshops;
create policy "petshops: acesso do próprio dono" on public.petshops
  for select to authenticated
  using (id = (select public.current_petshop_id()));
create policy "petshops: dono atualiza dados da loja" on public.petshops
  for update to authenticated
  using (id = (select public.current_petshop_id()))
  with check (id = (select public.current_petshop_id()));

-- products: isolamento total por petshop (o coração do multi-tenant).
drop policy if exists "products: acesso restrito ao próprio petshop" on public.products;
create policy "products: acesso restrito ao próprio petshop" on public.products
  for all to authenticated
  using (petshop_id = (select public.current_petshop_id()))
  with check (petshop_id = (select public.current_petshop_id()));

-- ---------------------------------------------------------------------
-- Cadastro atômico: petshop + vínculo do usuário (D6)
--
-- Chamado logo após supabase.auth.signUp(), com o usuário já autenticado:
--   supabase.rpc('signup_petshop', { petshop_name, petshop_email, petshop_phone })
-- ---------------------------------------------------------------------
create or replace function public.signup_petshop(
  petshop_name  text,
  petshop_email text,
  petshop_phone text default null
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid            uuid := auth.uid();
  new_petshop_id uuid;
begin
  if uid is null then
    raise exception 'signup_petshop: usuário não autenticado'
      using errcode = '28000';
  end if;

  if exists (select 1 from public.profiles where id = uid) then
    raise exception 'signup_petshop: usuário já vinculado a um petshop'
      using errcode = '23505';
  end if;

  insert into public.petshops (name, email, phone)
  values (btrim(petshop_name), btrim(petshop_email), nullif(btrim(petshop_phone), ''))
  returning id into new_petshop_id;

  insert into public.profiles (id, petshop_id)
  values (uid, new_petshop_id);

  return new_petshop_id;
end;
$$;

revoke execute on function public.signup_petshop(text, text, text) from public, anon;
grant execute on function public.signup_petshop(text, text, text) to authenticated;
