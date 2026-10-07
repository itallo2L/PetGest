-- Desfaz fechar-data-api.sql: devolve os grants do V0 (supabase/schema.sql, linhas
-- "grant ... to authenticated"), para o frontend do V0 voltar a funcionar num rollback.

grant select, update                 on public.petshops to authenticated;
grant select                         on public.profiles to authenticated;
grant select, insert, update, delete on public.products to authenticated;
grant execute on function public.signup_petshop(text, text, text) to authenticated;
grant execute on function public.current_petshop_id() to authenticated;

select has_table_privilege('authenticated', 'public.products', 'select') as authenticated_le_produtos;
