## Why

T-05, T-06 e T-08 vão portar as telas do protótipo (login, produtos, configurações) para React. Se cada uma trouxer o visual por conta própria, as cores, espaçamentos e ícones se espalham e divergem. Esta etapa leva a base visual do protótipo para o `frontend/` e cria as pastas de cada feature, para que as telas seguintes só consumam o que já existe.

## What Changes

- **Tokens visuais:** o bloco `:root` do `style.css` do protótipo (cores, tipografia, espaçamentos, raios, sombras, dimensões, transições) vira `frontend/src/shared/ui/tokens.css`, sem alterar valores.
- **Base global:** `frontend/src/index.css` passa a importar os tokens e ter o reset/base do protótipo (fonte, fundo, cor de texto, foco visível, `prefers-reduced-motion`) no lugar da base provisória do spike. O app fica só em tema claro, como o protótipo (sai o `color-scheme: light dark`).
- **Fonte Inter** empacotada com o app (pesos 400/500/600/700), em vez do link para o Google Fonts do protótipo.
- **Ícones:** o sprite SVG do protótipo vira um arquivo em `shared/ui/`, reduzido aos ícones que as telas do V0 usam, com um componente `<Icon name="..." />` (nomes tipados).
- **Estrutura de pastas:** `features/auth/`, `features/products/`, `features/petshop/` e `shared/ui/` criadas (`features/scanner/` e `shared/supabaseClient.ts` já existem).
- **Uso mínimo como prova:** o título do spike ganha o ícone da marca (pata), para exercitar tokens, fonte e sprite no build publicado.

Fora desta etapa: CSS de componentes (botões, campos, cards, tabela que vira card, modal) e as telas em si — cada um vem para `shared/ui/` junto da tela que o usa (T-05, T-06, T-08). Também fora: favicon/identidade no `index.html`, tema escuro, estilos de telas cortadas do V0 (dashboard, estoque, fornecedores, relatórios).

## Capabilities

### New Capabilities
<!-- nenhuma — base visual e organização de pastas, sem comportamento novo para o usuário -->

### Modified Capabilities
<!-- nenhuma -->

Esta change declara `skip_specs: true`: não há requisito de comportamento novo nem alterado; o resultado é verificado visualmente e por build (ver `tasks.md`).

## Impact

- **Dependência nova:** `@fontsource/inter` em `frontend/`.
- **Arquivos novos:** `frontend/src/shared/ui/tokens.css`, `frontend/src/shared/ui/icons.svg`, `frontend/src/shared/ui/Icon.tsx`, marcadores de pasta em `features/{auth,products,petshop}/`.
- **Arquivos alterados:** `frontend/src/index.css`, `frontend/src/main.tsx` (import da fonte), `frontend/src/App.tsx` (ícone no título).
- **Spike do scanner (T-01, ainda em teste):** muda fonte, fundo e cor de texto da página; os botões e o vídeo têm estilo inline e a lógica de câmera não é tocada.
- **Documentos:** `ROADMAPV0.md` (status de T-04).
