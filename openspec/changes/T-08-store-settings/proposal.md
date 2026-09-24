## Why

A área Configurações ainda mostra "em construção" (T-05). O petshop informa nome, e-mail e telefone uma única vez no cadastro (T-05) e hoje não tem como corrigir um erro de digitação nem atualizar o telefone. Esta etapa fecha as telas do V0 (`PLANOMVP.md` §3.8: Configurações = só "Dados da loja").

## What Changes

- **Formulário "Dados da loja"** na área Configurações, no card do protótipo: nome do petshop, e-mail da loja e telefone (opcional), carregados do petshop logado.
- **Salvar** grava em `petshops` (RLS: só a própria loja), mostra aviso de sucesso e atualiza na hora o nome e as iniciais da loja na barra lateral.
- Validações em português: nome obrigatório, e-mail em formato válido; mensagens de falha de rede como no resto do app.
- Dica no campo de e-mail: é o e-mail de contato da loja; **não** altera o e-mail usado para entrar.
- Fica de fora, como decidido no corte do protótipo: estoque mínimo, multiplicador de sugestão de compra, alertas e seletor de cor.
- CSS portado do protótipo: `settings-grid`, `card__body` e `form__actions` (regra da T-04).

## Capabilities

### New Capabilities
- `store-settings`: consulta e edição dos dados da loja logada (nome, e-mail de contato, telefone).

### Modified Capabilities
- `app-shell`: remove o requisito "Áreas ainda não implementadas" — com Produtos (T-06) e Configurações (esta change) prontas, não sobra área em construção.

## Impact

- **Código:** `features/petshop/` (página, acesso a dados), `SessionProvider` passa a expor um jeito de atualizar o nome da loja no shell sem recarregar.
- **Supabase:** nenhuma mudança — política "dono atualiza dados da loja" de T-02 já cobre o UPDATE.
- **Ordem de arquivamento:** T-05 → T-06 → T-08 (o delta de `app-shell` depende das duas).
- **Teste em celular real** (Android e iPhone) antes de arquivar.
