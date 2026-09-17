## Why

O único risco técnico real do V0 é a câmera do celular ler um EAN-13 de forma confiável pelo navegador — o resto (auth, CRUD, RLS) é trabalho previsível. Os documentos de decisão mandam validar isso em aparelho real, com HTTPS e iluminação de loja, **antes** de portar as três telas do protótipo e ligar o Supabase; se o `barcode-detector` decepcionar no iPhone/Safari, é muito mais barato descobrir agora.

## What Changes

- Criação da pasta `frontend/` com o scaffold React + TypeScript + Vite (SPA) que será a base definitiva do app — não um projeto descartável.
- Instalação do pacote `barcode-detector` (ponyfill/polyfill da API `BarcodeDetector`, com fallback ZXing-WASM para Safari/iOS).
- Uma única tela de spike: pede permissão, abre a câmera traseira via `getUserMedia`, roda o detector sobre o vídeo e mostra o EAN-13 lido, além de informar qual motor está em uso (nativo ou WASM) para que o teste em campo seja informativo.
- Configuração para deploy na Vercel (root `frontend/`, build Vite) de modo a obter HTTPS para o teste em celular.
- `.gitignore` na raiz cobrindo `node_modules/`, `dist/` e `.env*`.

Fora desta etapa, de propósito: Supabase, autenticação, porte das telas (login/produtos/configurações), porte do design system (`style.css`), entrada manual de código, PWA. O protótipo vanilla na raiz (`index.html`/`script.js`/`style.css`) continua intocado.

## Capabilities

### New Capabilities
- `barcode-scanner`: leitura de código de barras EAN-13 pela câmera do navegador — permissão, câmera traseira, detecção contínua sobre o vídeo, exibição do código lido e tratamento de câmera negada/indisponível.

### Modified Capabilities
<!-- nenhuma: não há specs existentes no projeto -->

## Impact

- **Novos arquivos**: `frontend/` (package.json, vite.config.ts, tsconfig, `src/`), `vercel.json` ou configuração equivalente na raiz, `.gitignore`.
- **Dependências novas**: `react`, `react-dom`, `vite`, `@vitejs/plugin-react`, `typescript`, `barcode-detector` (que traz `zxing-wasm`; o `.wasm` é baixado do jsDelivr em tempo de execução por padrão).
- **Sistemas externos**: projeto Vercel conectado ao repositório (criado pelo usuário no painel). Sem Supabase nesta etapa.
- **Código existente**: nenhum arquivo do protótipo é alterado. A estrutura `frontend/src/features/scanner/` já nasce no lugar previsto em `CLAUDE.md`, então o spike vira a base da feature real na etapa de integração — o que muda depois é a orquestração (o que fazer com o código lido), não a captura.
- **Validação**: o critério de aceite é manual e em campo — leitura de EAN-13 em Android (Chrome) e iPhone (Safari) via URL HTTPS da Vercel. Não é validável em desktop/localhost.
