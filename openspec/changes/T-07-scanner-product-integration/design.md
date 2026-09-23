## Context

Motivação em `proposal.md`. Requisitos em `specs/product-scanning/spec.md`.

- **T-01 (ainda aberta):** `features/scanner/createDetector.ts` escolhe o `BarcodeDetector` nativo quando ele declara `ean_13`, senão o ponyfill ZXing-WASM (`.wasm` baixado do jsDelivr — T-01 D6); `?engine=wasm` força o ponyfill. `useBarcodeScanner.ts` abre a câmera traseira (`getUserMedia`, 1280×720 ideal), roda `detect()` em loop de `requestAnimationFrame` com guarda de chamada em andamento, publica `code` quando o valor muda, mapeia erros de permissão para português e expõe lanterna (`torch`) quando `getCapabilities()` a declara; `stop()` libera tudo e roda na desmontagem. `ScannerSpike.tsx` usa o hook com painel de diagnóstico.
- **Teste de campo (Android, T-01):** nativo lê bem, mas **errou leituras** com pouca luz/reflexo; WASM foi fraco; `torch` não exposto naquele aparelho. iPhone ainda não testado.
- **T-06:** `ProductsPage` com lista em memória, `ProductFormModal` (cadastro/edição) com campo de código sozinho, `Modal` com pilha (Esc fecha só o do topo), `productsApi.ts` (insert sempre `source: 'manual'`).
- **Protótipo:** modal do leitor em `index.html` 370–425 (palco com vídeo e mira, aviso, resultado, "Ou digite o código", rodapé Cancelar/Tentar de novo/Editar produto); fluxo `aplicarCodigo` em `script.js` §7 (vibra 60 ms ao ler pela câmera; desfecho "já cadastrado" oferece editar; "novo" preenche o código, fecha o leitor e mostra aviso); CSS LEITOR DE CÓDIGO DE BARRAS em `style.css` 1515–1698 (inclui `.scanner__torch`).

## Goals / Non-Goals

**Goals:**
- Reaproveitar o hook e o detector da T-01 sem quebrar o `/spike`, que continua em uso até o teste do iPhone.
- Nunca aceitar uma leitura errada em silêncio.

**Non-Goals:**
- Base de produtos externa, preenchimento automático de nome/categoria (fora do V0 — `PLANOMVP.md` §3.4).
- Servir o `.wasm` localmente ou pré-carregá-lo (Open Question herdada da T-01).
- Leitura contínua de vários produtos em sequência (um código por abertura do leitor).

## Decisions

### D1. Hook da T-01 estendido por opções, com o padrão atual preservado
`useBarcodeScanner(options?)` ganha `formats`, `accept(code) => boolean` e `requiredMatches`. Sem opções, comporta-se como hoje (o spike não muda). O leitor do app usa `formats: ['ean_13', 'ean_8']`, `accept: isValidGtin` e `requiredMatches: 2`. `createDetector(formats)` repassa os formatos; no nativo, usa só os que `getSupportedFormats()` declara (continua exigindo `ean_13` para escolher o nativo).
Alternativa descartada: um hook novo para o app — duplicaria câmera, loop, erros e lanterna, que já foram testados em campo.

### D2. Leitura aceita = dígito verificador válido + 2 leituras idênticas seguidas
`isValidGtin` calcula o dígito verificador GS1 (módulo 10, pesos 3/1) para 8 e 13 dígitos. O hook só publica `code` quando o mesmo valor válido aparece em `requiredMatches` detecções consecutivas; um valor diferente zera a contagem. Ao aceitar, o hook para o loop (não a câmera) para não ler de novo, e o leitor vibra 60 ms (`navigator.vibrate`, ignorado onde não existe — iPhone).
Motivo: o teste de campo mostrou leituras erradas; o dígito verificador elimina a maioria, e a confirmação dupla elimina o resto sem atraso perceptível (duas detecções levam uma fração de segundo com o nativo).

### D3. Consulta no banco a cada leitura
`findProductByEan(ean)` em `productsApi.ts`: `select … eq('ean', ean).maybeSingle()` — o RLS limita à loja; o índice único `(petshop_id, ean)` garante no máximo um. Se o produto vier do banco e não estiver na lista local (cadastrado por outro aparelho), entra na lista. Falha de rede → estado de erro do leitor com "Tentar de novo" (repete a consulta, não a leitura).
Alternativa descartada: procurar só na lista em memória — não vê produtos cadastrados em outro aparelho depois do carregamento.

### D4. `ScannerModal` genérico em `features/scanner/`, desfechos decididos por quem abre
Props: `onCode(code) => Promise<ScanOutcome<T>>` onde `ScanOutcome<T> = { kind: 'existing', item: T, summary } | { kind: 'new' }` (o leitor não conhece `Product`; `summary` é o texto "nome · preço"), e callbacks `onNewCode(code)` e `onExistingAction(item)` com o rótulo do botão em `existingActionLabel`. O modal cuida de câmera, estados (`asking | scanning | denied | unavailable | error | lookup | found`), entrada manual e lanterna; Produtos decide o que cada desfecho faz. Estados mapeados do hook: `NotAllowedError` → `denied`; sem `mediaDevices`/`NotFoundError` → `unavailable`; demais → `error`.

### D5. Dois pontos de entrada
- **Barra de Produtos** ("Escanear", ícone `barcode`, ao lado de "Cadastrar produto"): `existing` → estado "Produto já cadastrado" (nome · preço) com "Editar produto"; `new` → fecha o leitor e abre o cadastro com o código preenchido (e marcado como lido pela câmera — D6).
- **Campo do formulário** (`field-with-action` com "Escanear"): `new` → fecha o leitor e preenche o campo; `existing` com o próprio produto em edição → só preenche; `existing` de outro produto → "Produto já cadastrado" com "Abrir produto", que fecha o formulário atual (descarta o que não foi salvo) e abre o outro. O leitor abre por cima do formulário (pilha de modais da T-06).
No celular, a barra passa a ter três botões. Na implementação, "Escanear" ficou com o tratamento padrão dos botões da barra (ocupa o restante da linha ao lado de "Filtro") e "Cadastrar produto" desce para a linha de baixo em largura total — três botões não cabem numa linha de 351 px, e um "Escanear" largo favorece a ação mais usada na loja. A loja sem produtos também mostra "Escanear" ao lado de "Cadastrar produto" no estado vazio, porque o primeiro cadastro costuma ser pela câmera.

### D6. `source` definido no cadastro pela origem do código
O formulário guarda `scannedEan` (o último código aceito pela câmera). No cadastro, `source = 'barcode'` quando o `ean` salvo é igual a `scannedEan`; senão `'manual'`. Na edição o `source` não muda (T-06 D1: update nunca envia `source`) — ele registra como o produto entrou no catálogo. `createProduct` passa a receber `source`.

### D7. Ciclo de vida da câmera
Câmera liga ao abrir o leitor e desliga (tracks paradas, lanterna apagada) ao fechar por qualquer caminho, via desmontagem do hook. Também desliga quando a aba fica oculta (`visibilitychange`) e oferece "Tentar de novo" ao voltar — evita câmera ligada em segundo plano no Android.

### D8. CSS do leitor portado para `features/scanner/scanner.css`
Bloco LEITOR DE CÓDIGO DE BARRAS literal (inclusive `.scanner__torch`), mais o estado `lookup` (reaproveita `.scanner__notice`) e `unavailable` (reaproveita `unsupported`). `data-state` no container, como no protótipo.

### D9. `/spike` só sai depois da T-01
O `/spike` e o `ScannerSpike.tsx` continuam intocados (o hook mantém o comportamento padrão — D1). A última tarefa desta change os remove, junto com o requisito "Spike do scanner público" de `app-shell`, **somente** depois que o teste do iPhone estiver registrado na T-01; se a T-07 for arquivada antes, a remoção vira uma change pequena própria.

## Risks / Trade-offs

- [iPhone depende só do WASM, que foi fraco no Android] → a entrada manual está em todos os estados; o teste de campo do iPhone decide se é preciso outra abordagem (Open Questions).
- [`.wasm` vem do jsDelivr] → primeira leitura no iPhone depende de CDN externo; herdado da T-01 D6, sem mudança aqui.
- [Confirmação dupla atrasa códigos difíceis] → se o teste de campo mostrar demora, `requiredMatches` pode cair para 1 mantendo o dígito verificador.
- [Abrir outro produto a partir do formulário descarta edição não salva] → só acontece por escolha explícita em "Abrir produto"; o texto do botão deixa claro.
- [Lanterna quase nunca disponível] → comportamento já validado como "esconder" na T-01 D9.

## Migration Plan

Sem migração de dados. Deploy em `dev`; rollback revertendo o commit (volta o cadastro só digitado da T-06).

## Open Questions

- Desempenho do WASM no iPhone (tarefa 5.4 da T-01): se inviável, avaliar servir o `.wasm` localmente, pré-carregar ao abrir Produtos, ou aceitar só digitação no iPhone. Não muda as specs desta change.
