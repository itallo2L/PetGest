## Context

Motivação em `proposal.md` — Why. Requisitos de comportamento em `specs/barcode-scanner/spec.md`.

Estado atual relevante:

- A raiz do repositório tem só o protótipo vanilla (`index.html`, `script.js`, `style.css`) e os documentos de decisão. Não há `package.json`, `.gitignore` nem `frontend/`.
- O scanner do protótipo (`iniciarCamera()`/`pararCamera()`/`setScannerState()` em `script.js`) é simulado com `setTimeout`, mas já define a máquina de estados visual `asking → scanning → found/erro` que o app real vai manter.
- Ambiente local: Node 24, npm 11. Versões atuais no npm: `vite` 8.x, `@vitejs/plugin-react` 6.x, `react` 19.x, `barcode-detector` 3.2.x (depende de `zxing-wasm` 3.1.x).
- `barcode-detector` oferece três pontos de entrada: `barcode-detector/ponyfill` (sempre ZXing-WASM, sem efeito colateral), `barcode-detector/polyfill` (registra em `globalThis` só se não houver `BarcodeDetector`) e o índice (os dois juntos). Por padrão o `.wasm` é baixado do jsDelivr em tempo de execução; `prepareZXingModule` permite servir localmente.
- `getUserMedia` só funciona em contexto seguro (HTTPS ou `localhost`). Testar em celular exige uma URL HTTPS — a Vercel entrega isso em qualquer deploy, inclusive prévias.
- Restrições de `CLAUDE.md`: estrutura `frontend/src/features/<feature>/`, trabalho sempre na branch `dev`, validação em celular real.

## Goals / Non-Goals

**Goals:**
- O scaffold criado aqui é o projeto definitivo do frontend — a estrutura de pastas e o tooling não serão jogados fora na etapa seguinte.
- A captura (câmera + detecção) fica isolada num hook reutilizável; a tela do spike é só um consumidor descartável desse hook.
- A tela do spike expõe informação suficiente para o teste de campo ser conclusivo: motor em uso, estado da permissão, código lido, tempo até a primeira leitura e erros com mensagem legível.
- Permitir comparar motor nativo vs. WASM no mesmo aparelho sem rebuild.

**Non-Goals:**
- Reproduzir o visual do protótipo (moldura de mira, linha de varredura, tokens de `style.css`). O spike usa estilo mínimo inline/CSS simples; o design system entra na etapa de porte das telas.
- Entrada manual de código, integração com formulário de produto, lookup em banco.
- Servir o `.wasm` localmente, PWA/offline, testes automatizados de UI (a validação desta etapa é manual, em campo).
- Configurar HTTPS local para testar no celular via rede Wi-Fi — o loop de validação passa pela Vercel.

## Decisions

### D1. Vite + React + TypeScript via template oficial `react-ts`
`npm create vite@latest frontend -- --template react-ts`, mantendo o `tsconfig` estrito do template. Alternativa descartada: montar o projeto à mão — sem ganho, e o template já traz ESLint e a configuração de build correta para a Vercel (preset "Vite" detectado automaticamente). Os arquivos de exemplo do template (`App.css`, logos, contador) são removidos, ficando só `main.tsx`, `App.tsx` e um `index.css` mínimo.

### D2. Seleção do motor: nativo quando confiável, senão ponyfill — nunca só o polyfill
Em vez de `import "barcode-detector/polyfill"` (que confia cegamente em qualquer `BarcodeDetector` global), o app decide explicitamente:

1. Se existir `globalThis.BarcodeDetector` **e** `await BarcodeDetector.getSupportedFormats()` incluir `"ean_13"` → usa o nativo (Chrome/Edge no Android — mais leve e rápido, sem download de WASM).
2. Caso contrário → `import { BarcodeDetector } from "barcode-detector/ponyfill"` (Safari/iOS, Firefox, e Chrome em Android sem Google Play Services, que expõe a classe mas devolve zero formatos).

Motivo: o polyfill puro cai exatamente no caso 2b (classe presente mas inútil) e o spike ficaria "funcionando" sem ler nada. A escolha fica em um único módulo (`createDetector()`), que é o ponto de troca previsto na decisão de stack para um SDK comercial no futuro.

O motor escolhido é exposto ao hook e mostrado na tela (`nativo` / `wasm`). Um parâmetro de URL `?engine=wasm` força o ponyfill mesmo quando há nativo, para comparar os dois no mesmo Android em campo. Alternativa descartada: um toggle na UI — o query param não precisa de estado nem persistência e some naturalmente na integração.

### D3. Captura: `getUserMedia` com `facingMode: { ideal: "environment" }` e `<video playsInline muted autoplay>`
- `ideal` (não `exact`): em desktop ou aparelho só com câmera frontal a chamada ainda funciona, o que permite pelo menos abrir a tela em `localhost` durante o desenvolvimento. Resolução `ideal` 1280×720 — suficiente para EAN-13 sem pesar o `detect()`.
- `playsInline` + `muted` são obrigatórios no iOS para o vídeo tocar dentro da página em vez de abrir em tela cheia; `video.play()` é chamado logo após anexar o stream, dentro do fluxo iniciado por um toque do usuário (botão "Iniciar câmera"). A câmera **não** abre sozinha ao carregar a página — o iOS exige gesto do usuário e o app real também abrirá o leitor por um botão.
- Parada: `stream.getTracks().forEach(t => t.stop())` e `video.srcObject = null`, executados tanto no botão "Parar" quanto no cleanup do hook (desmontagem do componente). Isso cobre os dois cenários de "Liberar a câmera ao encerrar" da spec.

### D4. Loop de detecção com `requestAnimationFrame` + guarda de chamada em andamento
A cada frame o hook chama `detector.detect(video)` apenas se não houver um `detect()` pendente (`inFlight` ref) e se `video.readyState >= HAVE_ENOUGH_DATA`. O `detect()` do WASM pode levar dezenas de ms; sem a guarda as chamadas se acumulariam. Alternativas: `setInterval` fixo (desperdiça quando a aba está em segundo plano) e `requestVideoFrameCallback` (ainda não universal no Safari). O `rAF` já pausa quando a aba não está visível.

O detector é criado com `formats: ["ean_13"]` — a spec exige ignorar outros formatos, e restringir formatos também acelera o motor.

### D5. Estado do hook espelha a máquina do protótipo
`useBarcodeScanner()` expõe `{ status: "idle" | "asking" | "scanning" | "error", engine, code, error, firstReadMs, start(), stop() }`. Os nomes `asking`/`scanning` vêm de `setScannerState()` do protótipo, para que o porte da tela do leitor (etapa futura) mapeie direto os estados visuais já desenhados. `code` só é atualizado quando o valor lido difere do atual (dedupe — cenário "Mesmo código mantido no enquadramento"). `firstReadMs` = tempo entre `start()` e a primeira leitura, para comparar nativo vs. WASM (o WASM paga o download do módulo na primeira vez).

Erros de `getUserMedia` são mapeados por `error.name`: `NotAllowedError` → "câmera negada" com instrução de liberar nas configurações do site; `NotFoundError`/`OverconstrainedError` → "sem câmera disponível"; ausência de `navigator.mediaDevices` → "câmera não disponível neste contexto (precisa de HTTPS)". Os demais caem numa mensagem genérica com o `name` original visível, para o teste de campo reportar.

### D6. `.wasm` do jsDelivr (padrão) nesta etapa
Sem `prepareZXingModule` agora. Servir localmente (copiar o binário para `public/` e apontar `locateFile`) é uma mudança de ~10 linhas que só vale a pena se o teste em campo mostrar latência ou bloqueio de CDN na rede da loja. Fica registrado como decisão a revisitar na integração, não como pendência aberta.

### D7. Estrutura de arquivos
```
frontend/
  src/
    features/scanner/
      createDetector.ts      (D2 — único lugar que conhece o pacote barcode-detector)
      useBarcodeScanner.ts   (D3/D4/D5 — câmera + loop + estado)
      ScannerSpike.tsx       (tela do spike: botão iniciar/parar, vídeo, painel de diagnóstico)
    App.tsx                  (renderiza ScannerSpike)
    main.tsx
    index.css                (reset mínimo; sem tokens do protótipo)
  vercel.json                (rewrite SPA `/(.*)` → `/index.html`)
  package.json, vite.config.ts, tsconfig*.json, index.html
.gitignore                   (raiz: node_modules/, dist/, .env*, .vercel/)
```
`ScannerSpike.tsx` é o único arquivo que será substituído na etapa de porte; `createDetector.ts` e `useBarcodeScanner.ts` seguem para a feature real.

### D8. Deploy pela Vercel com Root Directory = `frontend`
O projeto na Vercel é criado pelo usuário no painel apontando para o repositório, com Root Directory `frontend` e preset Vite (detectado). Essa configuração vive no projeto Vercel, não no repositório — `vercel.json` só carrega o rewrite de SPA. Cada push em `dev` gera uma prévia HTTPS; é ela que se abre no celular. Alternativa descartada: `@vitejs/plugin-basic-ssl` para testar via Wi-Fi local — economiza um push por iteração, mas adiciona dependência e certificado autoassinado que o iOS reclama; não compensa para uma tela.

### D9. Botão de lanterna (torch), condicional ao suporte do navegador

Adicionado depois do teste de campo em Android (ver "Resultado do teste de
campo" acima): iluminação foi o fator que mais afetou a leitura, mais que
o motor em si. `MediaStreamTrack.getCapabilities()` (Chrome/Android) pode
expor `torch: true` quando o hardware suporta; nesse caso,
`track.applyConstraints({ advanced: [{ torch: true }] })` liga a lanterna
da câmera traseira. **O Safari/iOS não implementa essa extensão** — a
propriedade não existe em `getCapabilities()` nesse navegador, então o
botão só aparece quando `torch` estiver presente nas capabilities da
track ativa; no iPhone ele fica ausente, sem quebrar nada.

Como `torch` não faz parte do `MediaTrackCapabilities`/`MediaTrackConstraintSet`
padrão do TypeScript, os tipos são estendidos localmente em
`useBarcodeScanner.ts` (mesmo padrão usado em `createDetector.ts` para o
`BarcodeDetector` nativo — ambiente tipado sem `any`).

A lanterna é desligada automaticamente em `stop()`, para não deixar o LED
aceso com a câmera liberada.

**Resultado do teste em campo (Android, mesmo aparelho do teste de
motor):** `capabilities.torch` veio `undefined` — a lista de capabilities
retornada é rica (`aspectRatio`, `exposureMode`, `focusMode`, `iso`,
`zoom`, etc.), mas não inclui `torch`. Ou seja, **não é bug**: o código
checou corretamente e escondeu o botão como o design previa para
navegador/aparelho sem suporte — é esse aparelho/Chrome específico que
não expõe a capability, apesar de suportar bastante coisa avançada de
câmera. Suporte a `torch` via web é conhecidamente inconsistente entre
fabricantes Android. Não há o que corrigir no código; o comportamento de
"esconder graciosamente" é o resultado esperado aqui. Ainda não testado
em outro Android — se aparecer em outro aparelho, a expectativa é que o
botão funcione sem mudança de código.

## Risks / Trade-offs

- [Nativo do Android lê pior que o WASM em código amassado/pouca luz, ou vice-versa] → `?engine=wasm` permite comparar no mesmo aparelho; o resultado decide qual motor a integração prefere.
- [Primeira leitura lenta no iPhone por causa do download do `.wasm` (centenas de KB) do jsDelivr] → `firstReadMs` na tela quantifica; se for ruim, D6 muda para servir localmente e pré-carregar ao abrir o app.
- [Rede da loja bloqueia CDN] → mesmo remédio de D6.
- [Navegador embutido (Instagram/WhatsApp no iOS) não expõe `getUserMedia`] → a mensagem de "câmera não disponível neste contexto" cobre; orientar o teste a abrir a URL no Safari/Chrome de verdade.
- [Chrome Android sem Play Services expõe `BarcodeDetector` sem formatos] → D2 verifica `getSupportedFormats()` antes de confiar no nativo.
- [Vite 8 / React 19 são versões recentes; alguma incompatibilidade com `@vitejs/plugin-react` ou ESLint do template] → o template oficial já fixa versões compatíveis entre si; se o `npm create` puxar algo quebrado, fixar a versão do `create-vite` no comando.
- [Spike "passa" no desktop com webcam mas falha no celular] → o critério de aceite é exclusivamente em celular real (Android + iPhone); desktop é só para não quebrar o build.

## Migration Plan

Greenfield — nada a migrar. O protótipo na raiz não é tocado. Rollback = remover `frontend/`, `.gitignore` e o projeto na Vercel. Trabalho na branch `dev` (nunca em `main`), conforme `CLAUDE.md`.

## Open Questions

- Servir o `.wasm` localmente (D6) e pré-carregar o módulo ao abrir o app: decidir com os números de `firstReadMs` do teste em campo. Não altera specs nem tarefas desta etapa.

### Resultado do teste de campo (Android, Chrome — 2026-09-17)

- **Motor nativo:** desempenho bom. Errou a leitura algumas vezes em
  determinados produtos (provavelmente por foco/ângulo/distância), mas
  sempre acertou depois de reposicionar. `firstReadMs` registrado: 55020ms
  num dos testes — alto porque `firstReadMs` mede o tempo até a *primeira*
  detecção bem-sucedida (mesmo que o valor esteja errado), não até o
  código correto; o app tentou várias vezes antes de conseguir focar.
- **Motor `?engine=wasm`:** desempenho ruim no mesmo aparelho — só um
  código foi lido corretamente entre várias tentativas, os demais não
  passaram. Reforça a expectativa de que o WASM é significativamente mais
  fraco que o nativo em condições reais (não só mais lento no download
  inicial, como a decisão D6 assumia).
- **Fator determinante observado pelo usuário:** iluminação e qualidade da
  câmera influenciam muito mais o resultado do que o motor em si — mesmo
  o nativo errou em produtos com menos luz ou reflexo na embalagem.
- **Implicação para a decisão D6:** como o motor nativo (Android) já
  entrega resultado bom, e o WASM (fallback Safari/iOS/Firefox) mostrou-se
  frágil mesmo em boas condições, servir o `.wasm` localmente não parece
  o problema prioritário — o gargalo é iluminação, não latência de
  download. Ainda falta testar o WASM real no iPhone (tarefa 5.4) antes de
  fechar essa decisão, já que lá ele não é fallback por escolha, é o único
  caminho possível.
- **Ideia levantada pelo usuário:** adicionar um botão de lanterna
  (torch) para compensar pouca luz. Ver avaliação técnica na conversa —
  registrado aqui como candidato a nova tarefa, não decidido ainda.
