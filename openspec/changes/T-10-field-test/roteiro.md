# Roteiro do teste de campo — V0

Produção: **https://pet-gest.vercel.app**. O mesmo roteiro serve para os dois
aparelhos. Resultados vão para o `relatorio.md` (✅ passou, ❌ falhou, — não
se aplica), usando o código de cada passo.

Coluna **Spec**: requisito verificado, no formato `capability › Requirement`
(specs em `openspec/specs/` ou nos deltas das changes T-01 e T-05 a T-09).

**Anotar quando falhar:** o que apareceu na tela (print, se der), o que era
esperado, e se repetiu ao tentar de novo.

---

## 0. Preparação

| # | Ação | Resultado esperado | Spec |
|---|------|--------------------|------|
| 0.1 | No painel do Supabase, abrir o projeto | Projeto ativo (não "Paused"); Authentication > Users sem contas de teste | — (design D3) |
| 0.2 | No celular: Wi-Fi **desligado**, dados móveis ligados. Anotar aparelho, sistema, navegador e operadora no cabeçalho do relatório | — | — |
| 0.3 | Separar 3 a 5 embalagens reais com código de barras (pelo menos uma com EAN-8, se houver — embalagens pequenas) | — | — |
| 0.4 | Android: Chrome. iPhone: **Safari** (não abrir pelo link dentro do WhatsApp/Instagram, que usa navegador embutido) | — | — |

## 1. Abertura e endereços

| # | Ação | Resultado esperado | Spec |
|---|------|--------------------|------|
| 1.1 | Com o navegador recém-aberto (aba anônima), abrir `https://pet-gest.vercel.app` e **cronometrar** até a tela Entrar aparecer | Tela **Entrar** com a pata no título e texto em Inter; cadeado de HTTPS na barra. Anotar o tempo (medição M1) | deployment › Produção publicada a partir da main |
| 1.2 | Abrir `https://pet-gest.vercel.app/produtos` direto | Tela Entrar (não página de erro 404) | deployment › Endereços diretos abrem o app; auth › Páginas protegidas por sessão |
| 1.3 | Abrir `https://pet-gest.vercel.app/qualquer-coisa` | Tela Entrar | deployment › Endereços diretos abrem o app |

## 2. Criar conta

| # | Ação | Resultado esperado | Spec |
|---|------|--------------------|------|
| 2.1 | Em Entrar, tocar **Criar conta**. Enviar sem o nome da loja | Mensagem pedindo o nome da loja; nada é criado | auth › Criar conta com a loja (Nome da loja vazio) |
| 2.2 | Preencher nome da loja, telefone, seu e-mail real e senha `123` | Mensagem com o tamanho mínimo da senha; nada é criado | auth › Criar conta com a loja (Senha fraca) |
| 2.3 | Corrigir a senha (8+ caracteres) e enviar. Observar o botão durante o envio | Botão mostra "Criando conta…" e não aceita segundo toque; entra no app em **Produtos**, com o nome da loja e as iniciais na barra lateral | auth › Criar conta com a loja (Cadastro completo); app-shell › Identificação da loja |
| 2.4 | Recarregar a página | Continua logado, em Produtos | auth › Sessão persistida no navegador |

## 3. Navegação

| # | Ação | Resultado esperado | Spec |
|---|------|--------------------|------|
| 3.1 | Tocar o botão de menu | A gaveta abre com Produtos e Configurações; o item da área atual está marcado | app-shell › Navegação no celular |
| 3.2 | Tocar na área escurecida ao lado da gaveta | A gaveta fecha | app-shell › Navegação no celular (Fechar tocando fora) |
| 3.3 | Abrir a gaveta e escolher **Configurações** | A gaveta fecha, Configurações abre e o título muda para "Configurações" | app-shell › Navegação entre as áreas do V0 |
| 3.4 | Recarregar em Configurações; depois usar o **voltar** do navegador | Após recarregar continua em Configurações; o voltar leva a Produtos | app-shell › Navegação entre as áreas do V0 |

## 4. Produtos (cadastro manual)

| # | Ação | Resultado esperado | Spec |
|---|------|--------------------|------|
| 4.1 | Abrir Produtos com a loja vazia | Estado vazio convidando a cadastrar o primeiro produto, com o botão de cadastro | products › Listagem (Loja sem produtos) |
| 4.2 | Novo produto: abrir o campo de categoria | Opções: Ração, Medicamento, Higiene, Acessórios, Petiscos, Jardinagem, Agropecuário | products › Cadastro manual (Categorias disponíveis) |
| 4.3 | Tocar no campo de preço | Abre o teclado numérico com vírgula/ponto; o formulário fica centralizado e legível com o teclado aberto | products › Validação do formulário |
| 4.4 | Salvar com nome vazio; depois com preço vazio | Mensagem indicando o campo; nada é gravado | products › Validação do formulário |
| 4.5 | Informar o código `12345` e salvar | Mensagem pedindo código de 8 a 14 dígitos | products › Validação (Código com tamanho inválido) |
| 4.6 | Cadastrar "Coleira Nylon M", Acessórios, preço `29,90`, sem código | Formulário fecha, aviso confirma; produto aparece na lista como card, com "R$ 29,90" e indicação de sem código | products › Cadastro manual (Cadastro válido); Listagem (Celular) |
| 4.7 | Cadastrar "Ração Premium Filhotes 1kg", Ração, preço `12,5`, digitando o código de uma embalagem real (produto **A**) | Aparece com "R$ 12,50" | products › Validação (Preço com vírgula) |
| 4.8 | Cadastrar outro produto usando o **mesmo código** do produto A | Nada é gravado; mensagem "O código de barras … já pertence a Ração Premium Filhotes 1kg." | products › Validação (Código já usado na loja) |
| 4.9 | Buscar `racao` (sem acento) | Só o produto de ração aparece, com o trecho destacado; contador "Mostrando 1 de 2 produtos cadastrados" | products › Busca, filtro e ordenação |
| 4.10 | Buscar pelos 4 primeiros dígitos do código do produto A | Só o produto A aparece | products › Busca (Buscar por código) |
| 4.11 | Limpar a busca; filtrar pela categoria **Higiene** | "Nenhum produto encontrado" com "Limpar busca e filtros"; o botão de filtro indica 1 filtro ativo. Tocar em limpar volta a lista completa | products › Busca (Filtrar por categoria; Nada encontrado) |
| 4.12 | Abrir a Coleira, mudar o preço para `34,90`, fechar **sem salvar** | Preço continua R$ 29,90 | products › Edição (Cancelar) |
| 4.13 | Abrir a Coleira, mudar o preço para `34,90` e salvar | Aviso confirma; lista mostra R$ 34,90 | products › Edição (Salvar alterações) |
| 4.14 | Abrir a Coleira, **Excluir produto**, e na confirmação desistir | Produto continua; formulário continua aberto | products › Exclusão (Desistir) |
| 4.15 | Repetir e confirmar a exclusão | Produto some da lista; aviso confirma | products › Exclusão (Excluir com confirmação) |

## 5. Scanner

Usar as embalagens reais. Primeira leitura com a câmera recém-aberta:
**cronometrar** do toque em "Escanear" até o resultado (medição M3).

| # | Ação | Resultado esperado | Spec |
|---|------|--------------------|------|
| 5.1 | Em Produtos, tocar **Escanear** pela primeira vez | "Liberando a câmera…" e o pedido de permissão do navegador | product-scanning › Estados e mensagens (Pedindo permissão) |
| 5.2 | **Negar** a permissão | O leitor explica como liberar a câmera e mostra o campo "Ou digite o código" | product-scanning › Digitar o código no leitor (Câmera negada); barcode-scanner › Solicitar acesso (nega) |
| 5.3 | No campo do leitor, digitar `12345` e confirmar | Aviso de que o código precisa ter 8 a 14 dígitos; nada é procurado | product-scanning › Digitar o código (Código digitado inválido) |
| 5.4 | Fechar o leitor, liberar a câmera nas configurações do site no navegador e tocar **Escanear** de novo | Vídeo da câmera **traseira** com a área de mira | barcode-scanner › Solicitar acesso (concede); product-scanning › Estados e mensagens |
| 5.5 | Apontar para o produto **A** (já cadastrado) | Vibra (Android); "Produto já cadastrado" com nome e preço; "Editar produto" abre o formulário dele | product-scanning › Escanear a partir da lista (Código já cadastrado); Leitura confiável |
| 5.6 | Tocar Escanear e apontar para uma embalagem **B** ainda não cadastrada | O leitor fecha; "Cadastrar produto" abre só com o código preenchido | product-scanning › Escanear a partir da lista (Código não encontrado) |
| 5.7 | Completar nome, categoria e preço de B **sem mexer no código** e salvar | Produto gravado. (Conferir origem = `barcode` no painel do Supabase, tabela `products`, ao final) | product-scanning › Origem do cadastro (Cadastro depois de escanear) |
| 5.8 | Escanear a embalagem **C**, no formulário **alterar um dígito** do código e salvar | Produto gravado com origem `manual` (conferir no Supabase ao final) | product-scanning › Origem do cadastro (Código trocado à mão) |
| 5.9 | Novo produto manual: no campo de código tocar **Escanear** e ler a embalagem **D** (não cadastrada) | Leitor fecha; código preenchido; nome/categoria/preço já digitados continuam lá | product-scanning › Escanear dentro do formulário (Preencher) |
| 5.10 | Ainda no formulário, tocar Escanear e ler o produto **A** | "Produto já cadastrado" com o nome de A e opção de abri-lo; o formulário atual não muda | product-scanning › Escanear dentro do formulário (Código já usado) |
| 5.11 | Se houver embalagem com **EAN-8**, escanear | Código de 8 dígitos aceito, mesmo desfecho (cadastrado / não encontrado) | product-scanning › Leitura confiável (EAN-8) |
| 5.12 | Ler em **pouca luz** (Android: usar o botão de lanterna) | Android: botão de lanterna aparece e liga o LED; iPhone: botão **não** aparece. Leitura acontece | product-scanning › Lanterna quando disponível |
| 5.13 | Fechar o leitor por cada caminho: botão fechar, toque fora e (Android) voltar | Em todos, o indicador de câmera em uso do celular apaga (e a lanterna desliga) | product-scanning › Liberar a câmera |
| 5.14 | Com o leitor aberto, trocar de aba / ir para a tela inicial do celular e voltar | Indicador de câmera apaga ao sair | barcode-scanner › Liberar a câmera ao encerrar |

## 6. Configurações

| # | Ação | Resultado esperado | Spec |
|---|------|--------------------|------|
| 6.1 | Abrir Configurações | "Dados da loja" com nome, e-mail e telefone do cadastro | store-settings › Consultar os dados da loja |
| 6.2 | Apagar o nome e salvar; depois e-mail `contato@` e salvar | Mensagem pedindo o nome / um e-mail válido; nada é gravado | store-settings › Validação |
| 6.3 | Trocar o nome para "Pet Shop Amigo Fiel", apagar o telefone e salvar | Aviso confirma; a barra lateral mostra "Pet Shop Amigo Fiel" e "PS" sem recarregar | store-settings › Salvar (Alterar o nome; Telefone em branco) |
| 6.4 | Trocar o e-mail da loja para outro endereço e salvar; recarregar | Formulário mostra os dados salvos; o texto do formulário deixa claro que o e-mail de acesso não muda | store-settings › Salvar (Recarregar); E-mail de contato separado do acesso |

## 7. Sair e entrar

| # | Ação | Resultado esperado | Spec |
|---|------|--------------------|------|
| 7.1 | Tocar **Sair**; recarregar | Tela Entrar; continua deslogado após recarregar | auth › Sair |
| 7.2 | Entrar com e-mail em formato inválido; depois com senha vazia | Mensagem indicando o campo; nada é enviado | auth › Tela de entrar (Campos inválidos) |
| 7.3 | Entrar com a senha errada | "E-mail ou senha incorretos."; a senha digitada continua no campo | auth › Tela de entrar (Credenciais incorretas) |
| 7.4 | Entrar com o **e-mail de acesso original** (não o trocado em 6.4) | Botão mostra "Entrando…"; entra em Produtos | auth › Tela de entrar (Login bem-sucedido); store-settings › E-mail separado |
| 7.5 | Sair; abrir `https://pet-gest.vercel.app/configuracoes`; entrar | Após entrar, volta para **Configurações** | auth › Páginas protegidas (Acesso sem sessão) |
| 7.6 | Logado, abrir `https://pet-gest.vercel.app/entrar` | É levado a Produtos | auth › Páginas protegidas (Usuário logado abre a tela de entrar) |
| 7.7 | Sair; em Criar conta, usar o mesmo e-mail já cadastrado | Nada é criado; mensagem sugere entrar, com link para Entrar | auth › Criar conta (E-mail já cadastrado) |

## 8. Sem conexão (modo avião)

Ligar o **modo avião** só na hora de enviar; desligar logo depois.

| # | Ação | Resultado esperado | Spec |
|---|------|--------------------|------|
| 8.1 | Em Entrar, preencher certo, ativar modo avião e enviar | Mensagem de que não foi possível conectar | auth › Tela de entrar (Sem conexão) |
| 8.2 | Logado, abrir um produto, alterar, ativar modo avião e salvar | Formulário continua aberto com os dados; mensagem de falha de conexão. Sem modo avião, salvar funciona | products › Falha ao gravar |
| 8.3 | Em Configurações, alterar, ativar modo avião e salvar | Dados digitados continuam; mensagem de falha de conexão | store-settings › Validação (Sem conexão ao salvar) |
| 8.4 | Com modo avião, recarregar Produtos (se a página não carregar, pular) e, voltando a conexão, tocar "Tentar de novo" | Mensagem de falha com "Tentar de novo" (não lista vazia); ao tentar de novo com rede, a lista volta | products › Listagem (Falha ao carregar) |

## 9. Medições e motor do scanner

| # | Ação | Resultado esperado | Spec |
|---|------|--------------------|------|
| 9.1 | **M1** (feito em 1.1): primeiro acesso em rede móvel até a tela Entrar | Anotar segundos | — (design D5) |
| 9.2 | **M2**: logado, fechar e reabrir o navegador em `pet-gest.vercel.app` e cronometrar até ver a lista de Produtos | Anotar segundos | — (design D5) |
| 9.3 | **M3**: tempo da primeira leitura em 3 embalagens (toque em Escanear → resultado) | Anotar os 3 tempos | — (design D5) |
| 9.4 | Abrir `https://pet-gest.vercel.app/spike`, tocar "Iniciar câmera" e ler um EAN-13 | Android: motor `nativo`; iPhone: motor `wasm`. Anotar `firstReadMs` e se a primeira leitura demorou perceptivelmente (iPhone = T-01 5.4) | barcode-scanner › Funcionar em Android e iPhone |
| 9.5 | Só Android: repetir 9.4 em `/spike?engine=wasm` | Motor `wasm`; anotar `firstReadMs` | barcode-scanner › Funcionar em Android e iPhone |

## 10. Ao final

| # | Ação | Resultado esperado | Spec |
|---|------|--------------------|------|
| 10.1 | No Supabase, tabela `products`: conferir a coluna `source` dos produtos B (5.7) e C (5.8) | B = `barcode`; C = `manual` | product-scanning › Origem do cadastro |
| 10.2 | Decidir se a conta de campo fica (vira a loja de demonstração) ou é apagada | Registrar a decisão no relatório | — (design D3) |

---

## Cobertura do `ROADMAPV0.md` (T-10)

| Item do roadmap | Passos |
|-----------------|--------|
| Login | 7.1–7.6 |
| Cadastro de petshop | 2.1–2.4, 7.7 |
| Scanner | 5.1–5.14, 9.3–9.5 |
| Cadastro/edição de produto | 4.1–4.15, 5.6–5.10 |
| Celular real, URL publicada, HTTPS, rede real | 0.2, 0.4, 1.1–1.3, 9.1–9.2 |
| Erros do scanner: permissão negada | 5.2, 5.4 |
| Erros do scanner: código desconhecido | 5.6, 5.9 |
| Erros de auth: senha errada | 7.3 |
| Erros de auth: e-mail inválido | 7.2 |
