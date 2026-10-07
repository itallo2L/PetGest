-- T-18, passo 4 — importar as contas do Supabase Auth para o Identity (T-11, D4).
-- Cada conta vira um usuário do Identity com o MESMO id (profiles.id continua valendo),
-- o mesmo e-mail, o estado de confirmação e o hash bcrypt copiado. A API confere o bcrypt
-- e regrava a senha no formato do Identity no primeiro login (CompatPasswordHasher).
-- Roda DEPOIS do passo 3 (tabelas do Identity) e ANTES do passo 5 (FK de profiles.id).
-- Idempotente: conta já importada é pulada.

insert into identity.users
  (id, user_name, normalized_user_name, email, normalized_email, email_confirmed,
   password_hash, security_stamp, concurrency_stamp, phone_number, phone_number_confirmed,
   two_factor_enabled, lockout_end, lockout_enabled, access_failed_count)
select u.id,
       lower(u.email),
       upper(lower(u.email)),
       lower(u.email),
       upper(lower(u.email)),
       u.email_confirmed_at is not null,
       nullif(u.encrypted_password, ''),
       replace(gen_random_uuid()::text, '-', ''),
       gen_random_uuid()::text,
       null,
       false,
       false,
       null,
       false,
       0
from auth.users u
where u.deleted_at is null
  and not coalesce(u.is_anonymous, false)
  and u.email is not null
on conflict (id) do nothing;

-- Conferência rápida: as duas contagens devem ser iguais (o passo 6 confere tudo).
select (select count(*) from auth.users u
        where u.deleted_at is null and not coalesce(u.is_anonymous, false) and u.email is not null) as contas_no_supabase,
       (select count(*) from identity.users) as contas_no_identity;
