## Context

Motivação em `proposal.md`. Sem specs (`skip_specs: true`): não há comportamento novo.

- `style.css` do protótipo (2663 linhas) = bloco `:root` de tokens (linhas 1–95) + reset/base (97–137) + CSS de componentes e de telas, incluindo telas já cortadas do V0 (dashboard, estoque, fornecedores, relatórios).
- Ícones: sprite inline de 36 `<symbol id="i-*">` no `index.html` do protótipo, usados via `<svg class="icon"><use href="#i-..."/></svg>`. As telas do V0 (HTML + `script.js` após o corte) usam 20 deles.
- Fonte: Inter pelo Google Fonts (`<link>` no `index.html` do protótipo), com fallback para fontes do sistema em `--font-sans`.
- `frontend/` hoje: `index.css` provisório do spike (`system-ui`, `color-scheme: light dark`); `ScannerSpike.tsx` com estilos inline; Vite 8, React 19, `tsconfig` com `types: ["vite/client"]`.

## Goals / Non-Goals

**Goals:**
- Um único lugar para cada token visual, com os mesmos nomes do protótipo — o CSS de componentes portado depois (que referencia `var(--primary)`, `var(--space-4)` etc.) funciona sem renomear nada.
- Ícones utilizáveis em React com nome verificado pelo TypeScript.

**Non-Goals:**
- Portar CSS de componentes agora (ver D2).
- Biblioteca de UI, CSS-in-JS, Tailwind ou CSS Modules — o protótipo é CSS global com classes BEM-like e continua assim.

## Decisions

### D1. Tokens em `shared/ui/tokens.css`, importado por `index.css`
Copiar o bloco `:root` literalmente (valores e comentários de seção). `index.css` faz `@import './shared/ui/tokens.css'` no topo e contém o reset/base do protótipo (linhas 97–137 + `prefers-reduced-motion`), sem `.svg-sprite` (o sprite deixa de ser inline — D4).
Alternativa descartada: tokens em TypeScript (objeto JS) — o CSS portado depois usa `var(--...)`, então os tokens precisam existir como custom properties de qualquer forma.

### D2. CSS de componentes vem com a tela que o usa
Botões, campos, cards, tabela-que-vira-card, modal e toast entram em `shared/ui/` na change da tela que precisar deles (T-05 login, T-06 produtos, T-08 configurações). Portar as 2500 linhas agora traria junto estilos de telas cortadas do V0 e classes que ninguém sabe se serão usadas; cortar depois é mais difícil que trazer sob demanda.
Custo aceito: o spike continua com estilo inline até ser integrado em T-07.

### D3. Inter empacotada via `@fontsource/inter`
Importar `@fontsource/inter/{400,500,600,700}.css` em `main.tsx`. O Vite copia os `.woff2` com hash para o build e eles saem do mesmo domínio da Vercel.
Alternativa descartada: `<link>` do Google Fonts como no protótipo — mais uma conexão (DNS + TLS) para outro domínio no carregamento, ruim em 3G/4G dentro da loja (`PLANOMVP.md` §3.9), e dependência externa em runtime. O `--font-sans` mantém o fallback do sistema enquanto a fonte carrega (`font-display: swap` já vem no fontsource).

### D4. Sprite como arquivo externo + componente `<Icon>`
- `shared/ui/icons.svg`: só os `<symbol>` usados pelas telas do V0 (20) + `i-camera-off` e `i-flash` (scanner: permissão negada e lanterna) = 22. Os demais ficam no protótipo e são copiados quando uma tela precisar.
- `Icon.tsx`: `import spriteUrl from './icons.svg?no-inline'` e renderiza `<svg className="icon" aria-hidden="true"><use href={`${spriteUrl}#i-${name}`} /></svg>`, com `name: IconName` (união literal dos 22 nomes) e variante `size="sm"` → `icon--sm`. As classes `.icon`/`.icon--sm` do protótipo ficam em `index.css`.
- `?no-inline` é necessário: sem ele o Vite embute arquivos pequenos como `data:` URI, e navegadores atuais não aceitam `data:` em `<use href>`.
Alternativas descartadas: (a) sprite inline em um componente React montado no `App` — ~6 KB de SVG em JSX e `id`s globais no DOM; (b) um componente por ícone (SVGR) — nova dependência e 22 arquivos para o mesmo resultado; (c) arquivo em `public/` — sem hash no nome, cache de versão antiga após deploy.

### D5. Tema só claro
O protótipo não tem tema escuro e os tokens são de tema claro. Remover `color-scheme: light dark` evita que o navegador pinte controles nativos (inputs, scrollbar) no escuro sobre fundo claro. Tema escuro fica para depois do V0, se pedido.

### D6. Pastas vazias com `.gitkeep`
`features/auth/`, `features/products/`, `features/petshop/` e `shared/ui/` (esta já recebe arquivos). Git não versiona pasta vazia; `.gitkeep` é removido quando a primeira tela da feature chegar. O propósito de cada pasta já está em `CLAUDE.md` e `PLANOMVP.md` §3.5 — sem README por pasta para não duplicar.

### D7. Ícone no título do spike como prova de ponta a ponta
Único uso real nesta etapa: `<Icon name="paw" />` no `<h1>` do `App.tsx`. Prova no build publicado (e no Safari/iOS, que é onde `<use>` externo costuma falhar) que tokens, fonte e sprite chegam juntos, sem esperar T-05.

## Risks / Trade-offs

- [O spike (T-01) ainda está em teste de campo e muda de aparência] → só fonte, fundo e cor do texto mudam; botões/vídeo têm estilo inline e nenhum arquivo de `features/scanner/` é tocado. Se o `firstReadMs` for medido depois deste deploy, não há impacto (a fonte não participa da leitura).
- [`--fs-base` do protótipo é 13px, menor que os 16px atuais do body] → o texto solto do spike (lista de diagnóstico) fica menor; os botões definem `fontSize: 16` inline. Aceitável para a tela de spike; as telas reais seguem o protótipo.
- [`IconName` e `icons.svg` podem sair de sincronia] → tarefa de verificação compara a lista do tipo com os `id`s do arquivo.
- [Inter sem subset: pesos 400–700 com todos os alfabetos] → os CSS do fontsource usam `unicode-range`; o navegador só baixa o subset latino usado. Verificar no Network do build.

## Migration Plan

Sem dados. Rollback: reverter o commit (volta o `index.css` do spike e remove `@fontsource/inter`).
