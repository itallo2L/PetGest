-- T-18, passo 2 — baseline: registrar a migration V0Schema como já aplicada.
-- O banco de produção JÁ TEM as tabelas do V0 (criadas pelo supabase/schema.sql); a
-- migration V0Schema descreve as mesmas tabelas (conferido pelo SchemaCompatibilityTests),
-- então ela não pode rodar de novo — só entrar no histórico. Idempotente.

create table if not exists "__EFMigrationsHistory" (
    migration_id character varying(150) not null,
    product_version character varying(32) not null,
    constraint pk___ef_migrations_history primary key (migration_id)
);

insert into "__EFMigrationsHistory" (migration_id, product_version)
values ('20261003210743_V0Schema', '10.0.12')
on conflict (migration_id) do nothing;

select migration_id from "__EFMigrationsHistory" order by migration_id;
