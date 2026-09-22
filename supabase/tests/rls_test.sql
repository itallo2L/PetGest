-- =====================================================================
-- PetGest — teste de isolamento (RLS) e da função signup_petshop
--
-- Como rodar: Supabase > SQL Editor > colar este arquivo inteiro > Run,
-- DEPOIS de aplicar supabase/schema.sql.
-- Tudo roda dentro de uma transação que termina em ROLLBACK: nenhum
-- usuário, petshop ou produto de teste fica no banco.
--
-- Resultado esperado: a mensagem final "RLS OK: todos os testes passaram".
-- Qualquer falha interrompe o script com "FALHOU: <o que quebrou>".
-- =====================================================================
begin;

-- Dois usuários fictícios no Auth (A e B) + um terceiro sem petshop (C).
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'teste-a@petgest.invalid'),
  ('00000000-0000-0000-0000-00000000000b', 'teste-b@petgest.invalid'),
  ('00000000-0000-0000-0000-00000000000c', 'teste-c@petgest.invalid');

-- Helper local: "logar" como um usuário (mesmo mecanismo que o PostgREST
-- usa com o JWT do supabase-js).
create function pg_temp.login_as(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims',
    json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  select set_config('request.jwt.claim.sub', uid::text, true);
$$;

create function pg_temp.check(ok boolean, what text) returns void
language plpgsql as $$
begin
  if not coalesce(ok, false) then
    raise exception 'FALHOU: %', what;
  end if;
end;
$$;

set local role authenticated;

-- ---------------------------------------------------------------------
-- 1. Cadastro: A e B criam seus petshops via signup_petshop
-- ---------------------------------------------------------------------
select pg_temp.login_as('00000000-0000-0000-0000-00000000000a');
select public.signup_petshop('  Pet A  ', 'a@loja.invalid', '');
select pg_temp.check(
  (select name from public.petshops) = 'Pet A',
  'A deveria ver só o próprio petshop, com nome sem espaços');
select pg_temp.check(
  (select phone from public.petshops) is null,
  'telefone vazio deveria virar null');
-- guarda o id do petshop de A para os testes de invasão de B
select set_config('test.petshop_a', (select id::text from public.petshops), true);

-- Segundo cadastro do mesmo usuário deve falhar.
do $$
begin
  perform public.signup_petshop('Pet A2', 'a2@loja.invalid', null);
  raise exception 'FALHOU: signup_petshop repetido deveria dar erro';
exception when unique_violation then null;
end $$;

select pg_temp.login_as('00000000-0000-0000-0000-00000000000b');
select public.signup_petshop('Pet B', 'b@loja.invalid', '11 99999-0000');

-- ---------------------------------------------------------------------
-- 2. Produtos: insert sem petshop_id cai no petshop do usuário
-- ---------------------------------------------------------------------
select pg_temp.login_as('00000000-0000-0000-0000-00000000000a');
insert into public.products (name, category, price, ean, source)
values ('Ração X 1kg', 'Ração', 39.90, '7891000100103', 'barcode');

select pg_temp.login_as('00000000-0000-0000-0000-00000000000b');
-- Mesmo EAN em outro petshop é permitido.
insert into public.products (name, category, price, ean, source)
values ('Ração X 1kg (B)', 'Ração', 41.00, '7891000100103', 'barcode');

-- Mesmo EAN duas vezes no mesmo petshop é recusado.
do $$
begin
  insert into public.products (name, category, price, ean)
  values ('Duplicado', 'Ração', 1, '7891000100103');
  raise exception 'FALHOU: EAN duplicado no mesmo petshop deveria dar erro';
exception when unique_violation then null;
end $$;

-- Produto sem EAN (cadastro manual) é permitido, quantos quiser.
insert into public.products (name, category, price) values ('Banho P', 'Serviço', 50);
insert into public.products (name, category, price) values ('Banho M', 'Serviço', 60);

-- ---------------------------------------------------------------------
-- 3. Isolamento: B não enxerga nem mexe nos dados de A
-- ---------------------------------------------------------------------
select pg_temp.check((select count(*) from public.products) = 3,
  'B deveria ver exatamente os 3 produtos dele');
select pg_temp.check((select count(*) from public.petshops) = 1,
  'B deveria ver só o próprio petshop');
select pg_temp.check((select count(*) from public.profiles) = 1,
  'B deveria ver só o próprio profile');

-- Busca do scanner por EAN devolve só o produto de B.
select pg_temp.check(
  (select name from public.products where ean = '7891000100103') = 'Ração X 1kg (B)',
  'busca por EAN deveria devolver só o produto do próprio petshop');

-- Tentar inserir produto no petshop de A (id conhecido) é recusado pelo RLS.
do $$
begin
  insert into public.products (petshop_id, name, category, price)
  values (current_setting('test.petshop_a')::uuid, 'Invasor', 'X', 1);
  raise exception 'FALHOU: insert com petshop_id alheio deveria falhar';
exception when insufficient_privilege then null;
end $$;

-- Mover um produto próprio para o petshop de A também é recusado.
do $$
begin
  update public.products set petshop_id = current_setting('test.petshop_a')::uuid
  where name = 'Banho P';
  raise exception 'FALHOU: mover produto para petshop alheio deveria falhar';
exception when insufficient_privilege then null;
end $$;

-- Update/delete em produto de A não afetam nada.
update public.products set price = 0 where name = 'Ração X 1kg';
delete from public.products where name = 'Ração X 1kg';

-- B não consegue trocar o próprio profile para o petshop de A (sem isso,
-- B passaria a ler e editar todos os dados de A).
-- (sem permissão de UPDATE em profiles dá erro de permissão; se a
-- permissão existir, o RLS sem política de UPDATE não altera nada).
do $$
begin
  update public.profiles set petshop_id = current_setting('test.petshop_a')::uuid
  where id = '00000000-0000-0000-0000-00000000000b';
exception when insufficient_privilege then null;
end $$;
select pg_temp.check(
  (select petshop_id from public.profiles) <> current_setting('test.petshop_a')::uuid,
  'B não deveria conseguir se vincular ao petshop de A');

-- B não consegue criar petshop direto nem apagar o próprio.
do $$
begin
  insert into public.petshops (name, email) values ('Fake', 'f@x.invalid');
  raise exception 'FALHOU: insert direto em petshops deveria falhar';
exception when insufficient_privilege then null;
end $$;
do $$
begin
  delete from public.petshops;
exception when insufficient_privilege then null;
end $$;
select pg_temp.check((select count(*) from public.petshops) = 1,
  'B não deveria conseguir apagar o petshop');

-- B atualiza os dados da própria loja.
update public.petshops set phone = '11 3333-4444';
select pg_temp.check((select phone from public.petshops) = '11 3333-4444',
  'B deveria conseguir atualizar os dados da própria loja');

-- ---------------------------------------------------------------------
-- 4. A continua com o produto intacto; updated_at é atualizado
-- ---------------------------------------------------------------------
select pg_temp.login_as('00000000-0000-0000-0000-00000000000a');
select pg_temp.check(
  (select price from public.products where name = 'Ração X 1kg') = 39.90,
  'produto de A não deveria ter sido alterado nem apagado por B');

update public.products set price = 42.00, updated_at = '2000-01-01'
where name = 'Ração X 1kg';
select pg_temp.check(
  (select updated_at > '2001-01-01' from public.products where name = 'Ração X 1kg'),
  'updated_at deveria ser preenchido automaticamente no update');

-- ---------------------------------------------------------------------
-- 5. Usuário sem petshop (C) e anônimo não veem nada
-- ---------------------------------------------------------------------
select pg_temp.login_as('00000000-0000-0000-0000-00000000000c');
select pg_temp.check((select count(*) from public.products) = 0,
  'usuário sem petshop não deveria ver produtos');
do $$
begin
  insert into public.products (name, category, price) values ('X', 'X', 1);
  raise exception 'FALHOU: usuário sem petshop não deveria inserir produto';
exception when insufficient_privilege or not_null_violation then null;
end $$;

reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select set_config('request.jwt.claim.sub', '', true);
-- Anônimo não tem permissão nenhuma nas tabelas: a leitura dá erro de
-- permissão (ou, se as permissões estiverem abertas, o RLS devolve 0 linhas).
do $$
declare n int;
begin
  select count(*) into n from public.products;
  if n <> 0 then raise exception 'FALHOU: anônimo não deveria ver produtos'; end if;
exception when insufficient_privilege then null;
end $$;
do $$
declare n int;
begin
  select count(*) into n from public.petshops;
  if n <> 0 then raise exception 'FALHOU: anônimo não deveria ver petshops'; end if;
exception when insufficient_privilege then null;
end $$;
do $$
begin
  perform public.signup_petshop('Anon', 'x@x.invalid', null);
  raise exception 'FALHOU: anônimo não deveria executar signup_petshop';
exception when insufficient_privilege then null;
end $$;

reset role;
rollback;

-- Só chega aqui se nenhum teste acima falhou (qualquer falha interrompe o
-- script). Fica depois do ROLLBACK porque o SQL Editor mostra apenas o
-- resultado do último comando.
select 'RLS OK: todos os testes passaram' as resultado;
