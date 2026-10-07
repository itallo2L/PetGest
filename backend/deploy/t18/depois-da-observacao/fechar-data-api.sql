-- T-18 — DEPOIS do período de observação (ver runbook): fechar o acesso direto às tabelas
-- pela Data API do Supabase (PostgREST), que o V0 usava com a chave anon publicada no
-- frontend. A partir daqui o rollback para o V0 deixa de funcionar — por isso este passo
-- NÃO faz parte da janela de virada (design D4). Desfazer: reabrir-data-api.sql.

revoke all on public.petshops, public.profiles, public.products from anon, authenticated;
revoke execute on function public.signup_petshop(text, text, text) from authenticated;
revoke execute on function public.current_petshop_id() from authenticated;

-- Conferência: tudo false.
select has_table_privilege('authenticated', 'public.products', 'select') as authenticated_le_produtos,
       has_table_privilege('anon', 'public.products', 'select')          as anon_le_produtos,
       has_function_privilege('authenticated', 'public.signup_petshop(text, text, text)', 'execute') as authenticated_cria_loja;
