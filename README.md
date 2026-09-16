# PetGest V0 — Protótipo

Protótipo navegável (HTML/CSS/JS vanilla, sem backend) só com as telas que
fazem parte do V0 do PetGest: login, cadastro de produto via código de
barras e dados da loja — ver a seção "Protótipo PetGest — quais telas usar
no V0" no documento de decisão de stack do projeto.

## Como abrir

Abra `index.html` no navegador. Sem instalação, build ou servidor.

## Telas

1. **Login** — e-mail e senha, exibida antes do app.
2. **Produtos** — busca, filtro por categoria/ordenação, cadastro, lista
   (Produto, Categoria, Código de barras, Preço, Ações).
3. **Configurações** — só "Dados da loja" (nome, e-mail, telefone).

## Login — visual, não funcional

Assim como o leitor de código de barras, esta é só a experiência de tela:
não há verificação de credenciais nem sessão de verdade. Qualquer e-mail em
formato válido e qualquer senha preenchida entram — o botão "Entrar" só
simula uma pequena espera (como uma chamada de rede de verdade) antes de
liberar o app.

- O campo de senha tem o botão de mostrar/ocultar.
- "Esqueci minha senha" mostra um aviso de que o recurso está fora do
  escopo deste protótipo.
- O botão "Sair", no rodapé da barra lateral, volta para a tela de login
  (sem apagar nenhum dado — é só a experiência de logout).

A implementação real (autenticação contra o backend, emissão e validação de
JWT, conforme decidido no documento de stack) troca o corpo de
`submitLogin()` em `script.js`; o restante do fluxo (tela, validação de
campos, loading, logout) já está pronto para receber isso.

## Leitor de código de barras — visual, não funcional

Este protótipo **não liga a câmera de verdade**. O modal do leitor mostra a
experiência visual de apontar a câmera para um código de barras — a mesma
moldura de mira e linha de varredura do protótipo original, agora sobre uma
etiqueta de produto com um código de barras desenhado em CSS — e, depois de
um instante, "detecta" um código de demonstração sozinho. Cada abertura do
leitor alterna entre os três desfechos possíveis, só para passear pela
demonstração:

1. um código já cadastrado no catálogo (mostra "produto já cadastrado");
2. um código da base de referência (preenche nome e categoria sozinho);
3. um código desconhecido (só preenche o código, para completar manualmente).

A entrada manual do código (campo "Ou digite o código") continua funcionando
de verdade — é só texto, não depende de câmera.

Isso é intencional: é um protótipo de tela, não o app final. A implementação
real (câmera do navegador via `getUserMedia` + `BarcodeDetector`, com
fallback para digitação manual) é o "menor protótipo possível" descrito no
roadmap técnico, e deve ser testada isoladamente — só o corpo da função
`iniciarCamera()` em `script.js` precisa trocar quando chegar a hora; o
resto do fluxo já está pronto para receber um código de verdade.

## O que não está aqui (de propósito)

Estoque, mínimo, fornecedor, situação, relatórios, autenticação real contra
um backend e persistência entre sessões — tudo isso fica fora do V0, pelos
mesmos motivos documentados na decisão de stack.
