## 1. Scaffold do frontend

- [x] 1.1 Confirmar que a branch atual é `dev` (`git branch --show-current`) e criar `.gitignore` na raiz com `node_modules/`, `dist/`, `.env*`, `.vercel/`; verificar com `git status` que nada desses padrões aparece como untracked
- [x] 1.2 Criar `frontend/` com `npm create vite@latest frontend -- --template react-ts` e rodar `npm install` dentro dela; verificar que `npm run build` conclui sem erro e gera `frontend/dist/`
- [x] 1.3 Remover os arquivos de exemplo do template (`App.css`, `assets/react.svg`, `public/vite.svg`, conteúdo do contador em `App.tsx`) e reduzir `index.css` a um reset mínimo; ajustar `<title>` e `lang="pt-BR"` em `index.html`; verificar que `npm run build` e `npm run lint` continuam passando
- [x] 1.4 Instalar `barcode-detector` (`npm i barcode-detector`) e verificar que `import { BarcodeDetector } from "barcode-detector/ponyfill"` compila com `npx tsc --noEmit -p tsconfig.app.json`

## 2. Módulo de detecção (design D2)

- [x] 2.1 Criar `src/features/scanner/createDetector.ts` exportando `createDetector(): Promise<{ detector, engine: "native" | "wasm" }>` que usa o `BarcodeDetector` nativo somente se `getSupportedFormats()` incluir `ean_13`, senão o ponyfill; ambos criados com `formats: ["ean_13"]`; verificar que compila sem `any` e sem erro de tipo para o global nativo
- [ ] 2.2 Suportar o override `?engine=wasm` na URL (força o ponyfill) e verificar em desktop, no console, que `engine` muda conforme o parâmetro

## 3. Hook de câmera + loop (design D3–D5)

- [ ] 3.1 Criar `src/features/scanner/useBarcodeScanner.ts` com o estado `{ status, engine, code, error, firstReadMs, start, stop }` e `start()` chamando `getUserMedia({ video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false })`, anexando o stream a um `<video>` via ref e chamando `play()`; verificar em desktop (`localhost`, webcam) que `status` passa por `asking → scanning` e o vídeo aparece
- [ ] 3.2 Implementar o loop `requestAnimationFrame` com guarda `inFlight` e checagem de `readyState`, atualizando `code` só quando o valor lido for diferente do atual e registrando `firstReadMs` na primeira leitura; verificar em desktop apontando um EAN-13 impresso (ou na tela de outro aparelho) para a webcam que o código aparece uma vez e não pisca
- [ ] 3.3 Implementar `stop()` (parar tracks, `srcObject = null`, cancelar o rAF, voltar a `idle`) e o cleanup na desmontagem do hook; verificar que o indicador de câmera do navegador apaga ao clicar em "Parar" e ao navegar para fora da página
- [ ] 3.4 Mapear erros de `getUserMedia` por `name` (`NotAllowedError`, `NotFoundError`/`OverconstrainedError`, ausência de `navigator.mediaDevices`, genérico com o `name` visível) para mensagens em português em `status: "error"`; verificar negando a permissão no navegador e abrindo a página por `http://<ip-local>` (sem HTTPS) que cada caso mostra a mensagem correta

## 4. Tela do spike (design D7)

- [x] 4.1 Criar `src/features/scanner/ScannerSpike.tsx` com botão "Iniciar câmera"/"Parar", o `<video playsInline muted autoplay>` ocupando a largura da tela, e um painel de diagnóstico mostrando motor (`nativo`/`wasm`), status, código lido, `firstReadMs` e a mensagem de erro; renderizar em `App.tsx`; verificar que a página funciona em largura de celular (DevTools, 390px) sem rolagem horizontal
- [x] 4.2 Adicionar `frontend/vercel.json` com o rewrite SPA `/(.*)` → `/index.html`; verificar que `npm run build` ignora o arquivo sem erro e que ele é JSON válido

## 5. Deploy e validação em campo

- [ ] 5.1 Commitar em `dev` (`.gitignore`, `frontend/`) e fazer push; verificar com `git status` que `node_modules/` e `dist/` não entraram
- [ ] 5.2 (Usuário) Criar o projeto na Vercel apontando para o repositório com Root Directory `frontend` e preset Vite; verificar que o deploy da branch `dev` gera uma URL HTTPS que abre a tela do spike
- [ ] 5.3 (Usuário) Testar em Android (Chrome): permissão, câmera traseira, leitura de EAN-13 de embalagem real, motor exibido como `nativo`, e repetir com `?engine=wasm`; anotar `firstReadMs` e a facilidade de leitura em cada motor
- [ ] 5.4 (Usuário) Testar em iPhone (Safari, não navegador embutido): permissão, câmera traseira, leitura de EAN-13, motor exibido como `wasm`; anotar `firstReadMs` e se a primeira leitura demorou perceptivelmente
- [ ] 5.5 Testar os cenários de erro no celular (negar permissão e depois liberar nas configurações do site; fechar a aba com a câmera ligada) e verificar as mensagens e que o indicador de câmera apaga
- [ ] 5.6 Registrar o resultado do teste de campo (motor preferido no Android, latência no iPhone, problemas de leitura) numa nota curta em `design.md` desta change, sob "Open Questions", para orientar a decisão D6 e a etapa de integração
