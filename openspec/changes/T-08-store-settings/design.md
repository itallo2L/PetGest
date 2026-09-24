## Context

Motivação em `proposal.md`. Requisitos em `specs/store-settings/spec.md` e `specs/app-shell/spec.md`.

- **Banco:** `petshops(id, name not null e não vazio, email not null e não vazio, phone null, created_at)`; RLS "acesso do próprio dono" (select) e "dono atualiza dados da loja" (update com `using`/`with check` = `current_petshop_id()`); `grant select, update` para `authenticated`.
- **Protótipo:** `index.html` 254–294 (card "Dados da loja" dentro de `settings-grid`, `field-row` com e-mail e telefone, `form__actions` com "Salvar dados da loja"); `script.js` §11 (`saveStoreSettings`: exige os três campos, atualiza a barra lateral, toast "Dados da loja salvos").
- **CSS:** CARDS — `.card__body` (779); CONFIGURAÇÕES — `.settings-grid`, `.form__actions` (943–955); RESPONSIVO — `.settings-grid` em uma coluna ≤ 1024 px (1988).
- **App hoje:** `SettingsPage.tsx` é um estado vazio; `SessionProvider` guarda `petshop { id, name }` e expõe `refreshPetshop()`; o shell mostra nome e iniciais a partir dele. O cadastro (T-05) grava o e-mail de login como e-mail da loja e o telefone opcional (`signup_petshop` converte vazio em `null`).

## Goals / Non-Goals

**Goals:**
- Mesma tela do protótipo, persistida, com o shell refletindo o nome novo na hora.

**Non-Goals:**
- Trocar o e-mail ou a senha de acesso (Supabase Auth) — fora do V0.
- Seletor de cor, estoque mínimo, alertas (cortados do V0).

## Decisions

### D1. `features/petshop/petshopApi.ts` com `getStore()` e `updateStore(id, input)`
`getStore()`: `select id, name, email, phone` com `.single()` — sem filtro, o RLS devolve só a loja logada. `updateStore()`: `update({ name, email, phone }).eq('id', id).select().single()`. O `id` vem da própria leitura (não de parâmetro do usuário) e serve só para apontar a linha; quem garante que é a loja do usuário é o RLS (`with check`). Isso não contraria a regra do `CLAUDE.md`, que é não filtrar `petshop_id` de **produtos** à mão.

### D2. Telefone opcional, vazio vira `null`
O protótipo exigia telefone, mas o cadastro da T-05 já o trata como opcional e o banco aceita `null`. Manter o formulário coerente com o cadastro: nome e e-mail obrigatórios; telefone opcional (`trim()`; vazio → `null`), com o rótulo "(opcional)".

### D3. Shell atualizado por `refreshPetshop()` depois de salvar
Depois do UPDATE, chamar o `refreshPetshop()` que já existe (T-05 D2): relê o petshop e o shell troca nome e iniciais. Uma requisição a mais, mas sem nova API no provider nem risco de o shell divergir do banco.

### D4. Carga com estado de erro e "Tentar de novo"
Mesmo padrão da T-06 (efeito com contador de tentativas; setState só depois da resposta): "Carregando…", erro com "Tentar de novo" (lembrando que leituras têm novas tentativas automáticas do `supabase-js`, ~7 s), e o formulário só aparece com os dados carregados.

### D5. Validação e mensagens reaproveitadas
`EMAIL_RE` e `toFormMessage` de `features/auth/authErrors.ts`, `FormError` para a mensagem, `useToast` para "Dados da loja salvos". Dica sob o e-mail: "E-mail de contato da loja. Não muda o e-mail que você usa para entrar."

### D6. CSS portado para `features/petshop/settings.css`
`.settings-grid`, `.settings-grid__wide`, `.form__actions` e a regra responsiva, literais; `.card__body` vai para `shared/ui/card.css` (é do bloco CARDS). O card ocupa uma das duas colunas do grid no desktop, como no protótipo.

## Risks / Trade-offs

- [Dois aparelhos editando os dados da loja] → vence a última gravação (igual a produtos na T-06).
- [Usuário espera que o e-mail da loja mude o login] → dica explícita no campo (D5).

## Migration Plan

Sem migração de dados. Deploy em `dev`; rollback revertendo o commit (Configurações volta ao "em construção").
