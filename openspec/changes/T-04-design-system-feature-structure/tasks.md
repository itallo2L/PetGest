## 1. Tokens e base global

- [x] 1.1 Criar `frontend/src/shared/ui/tokens.css` com o bloco `:root` do `style.css` do protótipo copiado literalmente (design D1); verificar com um diff que nomes e valores das variáveis são idênticos aos do protótipo
- [x] 1.2 Reescrever `frontend/src/index.css`: `@import` dos tokens, reset/base do protótipo, `.icon`/`.icon--sm`, `:focus-visible` e `prefers-reduced-motion`; sem `color-scheme: light dark` (design D1, D5); verificar com `npm run build` e, no dev server, que `body` tem `background-color` `rgb(244, 247, 247)` e `color` `rgb(22, 39, 43)`
- [x] 1.3 Instalar `@fontsource/inter` e importar os pesos 400/500/600/700 em `main.tsx` (design D3); verificar no dev server que `document.fonts.check('600 16px Inter')` é `true` e que nenhuma requisição vai para `fonts.googleapis.com`/`fonts.gstatic.com`

## 2. Ícones

- [x] 2.1 Criar `frontend/src/shared/ui/icons.svg` com os 22 `<symbol>` do design D4 copiados do `index.html` do protótipo; verificar que o arquivo tem exatamente esses 22 `id`s
- [x] 2.2 Criar `frontend/src/shared/ui/Icon.tsx` (`IconName` com os 22 nomes, prop `size="sm"`, sprite via `?no-inline`) (design D4); verificar com `npx tsc -b` e `npm run lint` sem erros, que `IconName` e os `id`s do SVG batem, e que no `dist/` o sprite sai como arquivo `.svg` com hash (não como `data:`)
- [x] 2.3 Colocar `<Icon name="paw" />` no `<h1>` do `App.tsx` (design D7); verificar no dev server (screenshot) que o ícone aparece na cor do texto, com 20×20 px

## 3. Estrutura de pastas

- [x] 3.1 Criar `features/auth/`, `features/products/` e `features/petshop/` com `.gitkeep` (design D6); verificar que `git status` lista os três marcadores e que `frontend/src/` bate com a árvore de `PLANOMVP.md` §3.5

## 4. Verificação e fechamento

- [x] 4.1 Conferir o spike sem regressão: build ok, página abre no dev server sem erros no console, botão "Iniciar câmera" visível e estilizado como antes (estilo inline), nenhum arquivo em `features/scanner/` alterado (`git diff --stat`)
- [ ] 4.2 (Usuário) Após o deploy na Vercel, abrir a URL do spike no iPhone (Safari) e no Android (Chrome) e confirmar que o ícone da pata aparece no título e o texto está em Inter
- [x] 4.3 Atualizar `ROADMAPV0.md` com o status de T-04 apontando para esta change; verificar que o texto cita a regra do design D2 (CSS de componente vem com a tela)
- [x] 4.4 (Usuário) Commitar em `dev` e fazer push
