# Plano — Backend real com Supabase + Vercel (login + scanner de código de barras)

> Continuação de `decisao-stack-v0.md`. Duas decisões mudam em relação à
> recomendação original (ASP.NET Core + host à parte): banco de dados e
> autenticação passam a ser o **Supabase**, e o **site inteiro** (frontend +
> a pouquíssima lógica de servidor que sobrar) é hospedado na **Vercel**.
> Isso foi decidido junto com você: Supabase como BaaS (sem API própria
> rodando o tempo todo) e o frontend migrando de HTML/CSS/JS puro para
> **React + TypeScript + Vite**, como já estava no plano original.

## 1. Arquitetura resultante

```text
React + TS + Vite (SPA)  ──HTTPS──>  Supabase
   hospedado na Vercel                 ├─ Auth (e-mail/senha, sessão via JWT)
                                        ├─ Postgres (petshops, profiles, products)
                                        └─ Row Level Security (isola os dados por petshop)
```

Não existe uma API própria de longa duração (nada de ASP.NET Core, nada de
Node/Express rodando 24h). O que hoje seria "o backend" vira, no V0:

1. **Supabase Auth** cuidando de login/sessão/hash de senha — a mesma
   responsabilidade que o ASP.NET Core Identity teria, só que gerenciada.
2. **Row Level Security (RLS)** no Postgres do Supabase fazendo o papel de
   autorização multi-tenant que os endpoints da API fariam.
3. Uma **função SQL (`RPC`, `security definer`)** para o único caso que o
   Supabase não resolve sozinho de graça: criar o petshop e vincular o
   usuário recém-criado a ele, em uma única operação atômica, no momento do
   cadastro. Isso substitui a "Vercel Function" que eu tinha cogitado — dá
   no mesmo resultado (uma peça de lógica que roda com mais privilégio que
   o usuário comum) só que vive dentro do banco, sem precisar manter um
   projeto de servidor à parte. Se no futuro você preferir essa lógica fora
   do SQL (ex.: para logar num serviço externo, mandar e-mail, etc.), dá pra
   mover para uma Vercel Function sem quebrar nada — é um detalhe de
   implementação, não uma mudança de arquitetura.

Ou seja: "criar o backend" no V0 vira, na prática, **modelar o banco +
políticas de segurança do Supabase + uma função SQL**, não escrever e
hospedar um servidor.

## 2. Modelagem de dados (Supabase / Postgres)

```sql
-- petshops: um por conta (dono/funcionário único, como já decidido)
create table petshops (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  email      text not null,
  phone      text,
  created_at timestamptz not null default now()
);

-- profiles: liga um usuário do Supabase Auth a um petshop.
-- 1 profile = 1 usuário (auth.users), mas petshop_id pode um dia ser
-- compartilhado por mais de um profile (múltiplos funcionários) sem
-- mudar o schema.
create table profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  petshop_id uuid not null references petshops (id) on delete cascade,
  created_at timestamptz not null default now()
);

-- products: o cadastro por código de barras cai aqui.
-- "source" prepara o terreno para foto+IA e voz+IA, como já estava
-- planejado (ProductDraft / CaptureMethod no doc original).
create table products (
  id         uuid primary key default gen_random_uuid(),
  petshop_id uuid not null references petshops (id) on delete cascade,
  name       text not null,
  category   text not null,
  price      numeric(10,2) not null check (price >= 0),
  ean        text,
  source     text not null default 'manual' check (source in ('barcode', 'manual')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- mesmo EAN pode existir em petshops diferentes, mas não duas vezes no
-- mesmo petshop (regra que já valia no protótipo em memória).
create unique index products_petshop_ean_key
  on products (petshop_id, ean) where ean is not null;
```

### Row Level Security

```sql
alter table petshops enable row level security;
alter table profiles enable row level security;
alter table products enable row level security;

-- profiles: cada usuário só enxerga/edita o próprio vínculo
create policy "profiles: dono vê e edita o próprio" on profiles
  for select using (id = auth.uid());
create policy "profiles: dono atualiza o próprio" on profiles
  for update using (id = auth.uid());

-- petshops: só quem tem profile apontando pra ele
create policy "petshops: acesso do próprio dono" on petshops
  for select using (id = (select petshop_id from profiles where id = auth.uid()));
create policy "petshops: dono atualiza dados da loja" on petshops
  for update using (id = (select petshop_id from profiles where id = auth.uid()));

-- products: isolamento total por petshop (o coração do multi-tenant)
create policy "products: acesso restrito ao próprio petshop" on products
  for all using (petshop_id = (select petshop_id from profiles where id = auth.uid()))
  with check (petshop_id = (select petshop_id from profiles where id = auth.uid()));
```

Com essas políticas, o app React nunca precisa filtrar "WHERE petshop_id =
...” manualmente — qualquer `select`/`insert`/`update` feito pelo usuário
logado já vem automaticamente restrito ao petshop dele. É o Supabase
fazendo o trabalho que, na stack original, seria uma checagem em todo
endpoint da API.

### A função de cadastro (petshop + usuário juntos)

```sql
create or replace function signup_petshop(
  petshop_name text,
  petshop_email text,
  petshop_phone text
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_petshop_id uuid;
begin
  insert into petshops (name, email, phone)
  values (petshop_name, petshop_email, petshop_phone)
  returning id into new_petshop_id;

  insert into profiles (id, petshop_id)
  values (auth.uid(), new_petshop_id);

  return new_petshop_id;
end;
$$;
```

Fluxo de cadastro no frontend: `supabase.auth.signUp({ email, password })`
→ (usuário já autenticado, `auth.uid()` disponível) →
`supabase.rpc('signup_petshop', { petshop_name, petshop_email, petshop_phone })`.
As duas chamadas ficam encadeadas no mesmo formulário de "criar conta".

## 3. Autenticação

- **Login:** `supabase.auth.signInWithPassword({ email, password })` — troca
  a validação manual de e-mail/senha da tela de login atual (a que só
  simula) por essa chamada de verdade. A sessão fica persistida sozinha
  (localStorage) pelo `supabase-js`; usamos `supabase.auth.onAuthStateChange`
  para saber quando logar/deslogar e mostrar a tela certa.
- **Logout:** `supabase.auth.signOut()` no lugar do "Sair" que hoje só
  volta pra tela de login sem sair de verdade.
- **Proteção de rota:** sem sessão ativa → mostra a tela de login (mesma
  ideia visual que já existe, só trocando a validação simulada pela
  chamada real e tratando o erro de credenciais inválidas).
- **Confirmação de e-mail:** por padrão o Supabase exige confirmar o
  e-mail antes do primeiro login. Para agilizar os testes do V0, recomendo
  **desativar essa exigência** nas configurações de Auth do projeto agora
  e reativar antes de qualquer uso com clientes reais — é uma configuração
  de um clique no painel do Supabase, não uma decisão de código.

## 4. Scanner de código de barras (de verdade, agora)

Substitui a simulação visual atual pela implementação real prevista desde
o começo:

- Pacote `barcode-detector` (API `BarcodeDetector` nativa quando o
  navegador suporta; fallback em WASM/zxing quando não — cobre o Safari
  do iPhone, que nunca implementou a API nativa).
- `getUserMedia({ video: { facingMode: "environment" } })` para abrir a
  câmera traseira; obrigatório HTTPS (a Vercel já entrega isso de graça em
  qualquer deploy, inclusive nas prévias de PR).
- Mesma máquina de estados visual que o protótipo já tem
  (`asking → scanning → found/erro`), só trocando o "código de
  demonstração sorteado" por uma leitura de verdade do quadro de vídeo.
- **Diferença importante em relação ao protótipo visual:** a "base de
  referência" que preenchia nome/categoria sozinha era só uma
  demonstração fictícia. No V0 real **não há uma base de produtos externa
  integrada** — o scanner só reconhece um código que já esteja cadastrado
  *naquele mesmo petshop*. Os desfechos reais ficam em dois, não três:
  1. código já cadastrado no petshop → abre para edição;
  2. código não encontrado → preenche só o campo de código de barras,
     completando o resto manualmente (exatamente como já é hoje para
     código desconhecido).
  Uma base de referência de produtos de verdade (um catálogo do setor) é
  uma peça de infraestrutura própria, fora do escopo deste V0.
- Consulta ao Postgres via `supabase-js`
  (`select * from products where ean = codigo` — o RLS já restringe ao
  petshop do usuário logado sozinho, sem precisar passar `petshop_id` à
  mão).

## 5. Migração do frontend para React + TypeScript + Vite

Estrutura de pastas (retomando o que já estava no plano original):

```text
frontend/
  src/
    features/
      auth/       (tela de login/cadastro, sessão, proteção de rota)
      scanner/     (câmera + barcode-detector)
      products/    (listagem, cadastro/edição)
      petshop/     (dados da loja — tela de Configurações)
    shared/
      supabaseClient.ts   (cria o client com VITE_SUPABASE_URL / ANON_KEY)
      ui/                 (componentes portados do design system atual)
  index.css / tokens      (portar as variáveis de style.css: cores,
                            espaçamento, tipografia, sprite de ícones)
supabase/
  schema.sql              (tabelas + RLS + função signup_petshop, versionado)
```

O trabalho aqui é majoritariamente **portar** o que já existe — o design
(`style.css`), as três telas (login, produtos, configurações) e a
estrutura de estados do scanner —, trocando por baixo o que hoje é
simulado (arrays em memória, `setTimeout`) pelas chamadas reais ao
Supabase descritas acima.

## 6. Deploy

```text
Repositório:  1 repo no GitHub (frontend/ + supabase/schema.sql)
Vercel:       conecta no repo, build "Vite", root em frontend/,
              variáveis de ambiente:
                VITE_SUPABASE_URL       (pública — endereço do projeto)
                VITE_SUPABASE_ANON_KEY  (pública por design — protegida pelo RLS,
                                          não pela obscuridade)
Supabase:     projeto no tier gratuito; schema aplicado via SQL editor
              (ou supabase CLI, se quiser versionar migrations formalmente)
```

Nenhuma *service role key* do Supabase (a chave "admin", que ignora RLS)
precisa existir no frontend nem em variável de ambiente da Vercel — a
função `signup_petshop` roda com privilégio elevado *dentro do banco*,
então o cliente nunca vê uma chave perigosa. Isso é o principal ganho de
segurança de resolver o cadastro em SQL em vez de numa Vercel Function.

## 7. Roadmap — ordem sugerida

1. Criar o projeto no Supabase (tier gratuito); guardar Project URL e
   `anon key`.
2. Rodar o schema (tabelas, RLS, função `signup_petshop`) no SQL editor do
   Supabase — versionado em `supabase/schema.sql` no repo.
3. Configurar o provedor de e-mail/senha no Auth do Supabase; desativar
   confirmação de e-mail por enquanto (reavaliar antes de ir para
   produção com clientes reais).
4. Criar `frontend/` com Vite + React + TS; instalar `@supabase/supabase-js`
   e `barcode-detector`.
5. Portar o design system (`style.css`) e as três telas atuais (login,
   produtos, configurações) para componentes React, organizados por
   feature.
6. Ligar o login/logout de verdade (`signInWithPassword`, `signOut`,
   `onAuthStateChange`) e a proteção de rota.
7. Implementar a tela/fluxo de "criar conta" (cadastro do petshop):
   `signUp()` seguido do `rpc('signup_petshop', ...)`.
8. Trocar o array de produtos em memória por operações reais no Supabase
   (listar, criar, editar) — o RLS cuida do isolamento por petshop.
9. Implementar o scanner de verdade (`getUserMedia` + `barcode-detector`),
   com os dois desfechos reais (já cadastrado / não encontrado).
10. Subir o repositório, conectar na Vercel, configurar as variáveis de
    ambiente, primeiro deploy.
11. Testar ponta a ponta em celular real (Android e iPhone) — login,
    câmera, HTTPS — o mesmo tipo de validação de campo que já estava
    prevista no "menor protótipo possível" do plano original.

## 8. Decisões em aberto / riscos a confirmar

- **Confirmação de e-mail:** deixo desativada por padrão neste plano para
  agilizar os testes do V0; é só um toggle no painel do Supabase, reative
  quando fizer sentido.
- **Um petshop por usuário:** o schema já permite mais de um `profile`
  apontando pro mesmo `petshop_id` no futuro (múltiplos funcionários) sem
  precisar de migration — mas o V0 continua com a regra de papel único que
  você já tinha definido.
- **Sem base de referência de produtos externa:** o scanner do V0 real só
  reconhece o que já está cadastrado naquele petshop (ver seção 4) — a
  "mágica" de preencher nome/categoria sozinho a partir de uma base do
  setor, que aparecia no protótipo visual, fica de fora por enquanto.
- **`barcode-detector` no Safari/iOS:** primeira leitura pode ser um pouco
  mais lenta por causa do download do fallback em WASM; vale confirmar em
  aparelho real depois do deploy, como já estava no plano original.