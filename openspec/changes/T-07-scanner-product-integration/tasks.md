## 1. Leitura confiável (base da T-01)

- [x] 1.1 Criar `isValidGtin` (dígito verificador GS1 para 8 e 13 dígitos) em `features/scanner/`; verificar com casos conhecidos no Node (`7891000315507` e `96385074` válidos; último dígito trocado inválido)
- [x] 1.2 `createDetector(formats)` com EAN-8 e `useBarcodeScanner(options)` com `formats`, `accept` e `requiredMatches`, preservando o padrão sem opções (design D1, D2); verificar com `npx tsc -b`/`npm run lint` e que o `/spike` continua funcionando igual no dev server (sem arquivos do spike alterados)
- [x] 1.3 Parar o loop ao aceitar uma leitura e desligar a câmera com a aba oculta (design D2, D7); verificar no dev server com webcam que um código aceito aparece uma vez só e que trocar de aba apaga o indicador de câmera

## 2. Leitor no app

- [x] 2.1 Portar o CSS do leitor para `features/scanner/scanner.css` (design D8); verificar com o script de diff da T-06 que os blocos são idênticos ao `style.css`
- [x] 2.2 Criar `ScannerModal` com os estados do design D4, vídeo com mira, lanterna condicional, "Ou digite o código" com validação de 8–14 dígitos e vibração ao aceitar; verificar no dev server: "Liberando a câmera…", vídeo com mira, câmera negada mostra a explicação e mantém o campo manual, "12345" digitado é recusado, fechar por Cancelar/Esc/fundo apaga o indicador de câmera
- [x] 2.3 `findProductByEan` em `productsApi.ts` e `createProduct` com `source` (design D3, D6); verificar no console do dev server que a consulta não envia `petshop_id` e devolve `null` para código de outra loja

## 3. Integração com Produtos

- [x] 3.1 Botão "Escanear" na barra de Produtos com os dois desfechos (design D5); verificar digitando no leitor: código da loja → "Produto já cadastrado" com nome e preço → "Editar produto" abre a edição; código novo → cadastro abre com o código preenchido; código só da loja B → "não encontrado"; produto inserido por script depois de carregar a lista → "já cadastrado" e entra na lista
- [x] 3.2 Botão "Escanear" no campo de código do formulário (design D5); verificar: código novo preenche o campo sem apagar nome/preço; código de outro produto mostra o aviso e "Abrir produto" troca para ele; código do próprio produto em edição só preenche
- [x] 3.3 `source` pela origem do código (design D6); verificar no banco: cadastro a partir de leitura grava `barcode`; leitura seguida de código alterado grava `manual`; digitado grava `manual`
- [x] 3.4 Falha na consulta; verificar com o fetch derrubado que o leitor mostra o erro com "Tentar de novo" e que, restaurada a rede, "Tentar de novo" conclui o desfecho sem ler de novo
- [x] 3.5 Barra de Produtos em 375 px com três botões; verificar que nada quebra linha de forma estranha nem gera rolagem lateral

## 4. Campo e fechamento

- [x] 4.1 Atualizar `ROADMAPV0.md` com o status de T-07; verificar que aponta para esta change
- [ ] 4.2 (Usuário) Commitar em `dev`, fazer push e testar no deploy em **Android (Chrome)** com embalagens reais: ler pela barra (produto existente e novo), ler pelo formulário, EAN-8 se houver, pouca luz, negar e liberar a câmera, confirmar que a câmera apaga ao fechar
- [ ] 4.3 (Usuário) Mesmo teste no **iPhone (Safari)**, junto com a tarefa 5.4 da T-01 (motor WASM); registrar na T-01 o resultado
- [ ] 4.4 Depois do registro da T-01: remover `/spike`, `ScannerSpike.tsx` e o requisito "Spike do scanner público" de `app-shell` (design D9); verificar que `/spike` cai em `/produtos` e que o build passa
- [ ] 4.5 (Usuário) Apagar as contas/lojas de teste criadas nas verificações
