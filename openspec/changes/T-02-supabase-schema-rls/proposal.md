## Why

Todas as telas reais do V0 (login, produtos, configurações, scanner integrado) dependem de um banco com isolamento por petshop. No V0 não existe API própria: o "backend" é o schema do Postgres + as políticas de Row Level Security + uma função SQL de cadastro. Se o RLS estiver errado, um petshop enxerga ou altera dados de outro — por isso essa base precisa existir, versionada e testada, antes de T-05 em diante.

Ao revisar o SQL de `PLANOMVP.md` §3.2 para versionar, apareceu uma falha de isolamento: a política de UPDATE em `profiles` deixa o usuário trocar o próprio `petshop_id` e passar a ler/editar os dados de outro petshop. Esta change corrige isso junto com a criação do schema.

## What Changes

- Novo `supabase/schema.sql` (idempotente) com `petshops`, `profiles`, `products`, índice único `(petshop_id, ean)` parcial, RLS nas três tabelas e a função `signup_petshop`.
- Correções em relação ao SQL de `PLANOMVP.md` §3.2 (detalhe em `design.md`):
  - **Removida** a política de UPDATE em `profiles` (falha de isolamento entre petshops).
  - Função auxiliar `current_petshop_id()` usada por todas as políticas.
  - `products.petshop_id` com default = petshop do usuário logado — o frontend nunca envia nem filtra `petshop_id`.
  - `updated_at` mantido por trigger.
  - `signup_petshop` recusa usuário anônimo e segundo cadastro do mesmo usuário; execução revogada de `anon`.
  - Validações leves no banco: nome/categoria não vazios, `ean` só com 8–14 dígitos.
- Novo `supabase/tests/rls_test.sql`: roteiro que roda no SQL Editor dentro de uma transação com `ROLLBACK`, simulando dois petshops e verificando isolamento, cadastro e restrições.
- `PLANOMVP.md` §3.2 passa a apontar para `supabase/schema.sql` como fonte da verdade.

Fora desta etapa: configuração do Auth (confirmação de e-mail, provedor) e `@supabase/supabase-js` no frontend — isso é T-03.

## Capabilities

### New Capabilities
- `tenant-data`: armazenamento de petshops, vínculo usuário→petshop e produtos, com isolamento total por petshop garantido pelo banco e cadastro atômico de petshop + usuário.

### Modified Capabilities
<!-- nenhuma -->

## Impact

- **Novos arquivos**: `supabase/schema.sql`, `supabase/tests/rls_test.sql`.
- **Documentos**: `PLANOMVP.md` §3.2 (nota apontando para o schema versionado e as correções), `ROADMAPV0.md` (status de T-02).
- **Sistemas externos**: projeto no Supabase (tier gratuito), criado pelo usuário no painel; o schema é aplicado pelo SQL Editor.
- **Frontend**: nenhuma mudança nesta etapa.
