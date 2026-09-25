## Why

O V0 existe para cadastrar produto pelo leitor de código de barras, e até aqui o código é digitado (T-06). A T-01 provou que a câmera + `barcode-detector` leem EAN-13 no Android; esta etapa leva essa leitura para dentro da tela de Produtos, com os dois desfechos do V0: produto já cadastrado na loja abre para edição, código novo abre o cadastro com o código preenchido.

## What Changes

- **Botão "Escanear" na barra de Produtos:** abre o leitor; ao ler, procura o código nos produtos da loja:
  - **já cadastrado** → mostra "Produto já cadastrado" com nome e preço e oferece "Editar produto";
  - **não encontrado** → abre "Cadastrar produto" com o código preenchido; o resto é digitado.
- **Botão "Escanear" ao lado do campo de código no formulário** (volta o `field-with-action` do protótipo): ao ler, preenche o campo; se o código já for de outro produto da loja, avisa qual e oferece abrir esse produto.
- **Leitor em modal** com os estados do protótipo: pedindo permissão, lendo (vídeo com mira), negado, sem suporte/erro, lido. Entrada manual ("Ou digite o código") sempre disponível no leitor.
- **Proteção contra leitura errada** (o teste de campo da T-01 mostrou leituras incorretas com pouca luz): só aceita código com dígito verificador válido e lido igual em quadros seguidos; vibra ao aceitar.
- **Formatos:** EAN-13 e EAN-8 (o banco aceita 8–14 dígitos; hoje o detector só procura EAN-13).
- **Lanterna** no leitor quando o aparelho expõe `torch` (mesma regra da T-01: some onde não há suporte, como no iPhone).
- Produto cadastrado a partir de uma leitura grava `source: 'barcode'`; digitado continua `manual`.
- O hook `useBarcodeScanner` e o `createDetector` da T-01 passam a servir o app (sem o painel de diagnóstico). **O `/spike` continua** até a T-01 registrar o teste do iPhone; sai numa tarefa final desta change.
- CSS do leitor portado do protótipo (LEITOR DE CÓDIGO DE BARRAS).

## Capabilities

### New Capabilities
- `product-scanning`: leitura de código de barras pela câmera para localizar ou cadastrar produto da loja — desfechos, entrada manual, proteção contra leitura errada, estados de permissão/erro e liberação da câmera.

### Modified Capabilities
<!-- nenhuma nesta change: `products` (T-06) e `barcode-scanner` (T-01) ainda não estão nas specs principais; a remoção do /spike (requisito de app-shell da T-05) fica condicionada ao fechamento da T-01 e será um delta separado quando acontecer -->

## Impact

- **Código:** `features/scanner/` (hook ganha formatos, validação e confirmação; `createDetector` com EAN-8; novo `ScannerModal`), `features/products/` (botões, fluxo dos desfechos, `source`), `shared/ui/` (nada novo além do CSS do leitor em `features/scanner/scanner.css`).
- **Supabase:** nenhuma mudança de schema — a cada leitura, consulta `products` por `ean` no banco (RLS isola a loja; `PLANOMVP.md` §3.4), para enxergar produtos cadastrados por outro aparelho depois que a lista carregou.
- **Dependência de campo:** a T-01 ainda não testou o iPhone (motor WASM). Esta change segue com o fallback WASM como está; se o teste do iPhone mostrar leitura inviável, o desenho do leitor no iPhone precisa ser revisto (ver design, Open Questions).
- **Teste obrigatório em celular real** (Android e iPhone) antes de arquivar — é o ponto central do V0.
- **Ordem de arquivamento:** T-05 → T-06 → T-07 (esta change assume a tela de Produtos da T-06).
