## Purpose

Cadastro de produto assistido por IA no frontend do PetGest (modo `api`): preencher o formulário de cadastro a partir de uma foto da embalagem (e, na T-20, da voz), sempre com o usuário conferindo antes de salvar.

## ADDED Requirements

### Requirement: Preencher o cadastro com IA
No formulário de cadastro de produto (não no de edição), o app SHALL mostrar o bloco "Preencher com IA" somente quando a API informar que o cadastro por IA está disponível. No modo `supabase`, ou sem IA disponível, o bloco MUST NOT aparecer e o cadastro SHALL funcionar como antes.

#### Scenario: IA disponível
- **WHEN** o usuário abre "Cadastrar produto" com a IA disponível na API
- **THEN** o formulário mostra "Preencher com IA" com o botão "Foto"

#### Scenario: Edição
- **WHEN** o usuário abre um produto existente para editar
- **THEN** o bloco "Preencher com IA" não aparece

### Requirement: Cadastro por foto
O botão "Foto" SHALL abrir a câmera traseira do celular (no desktop, a escolha de um arquivo de imagem). A foto SHALL ser reduzida no próprio aparelho antes do envio, respeitando a orientação, e enviada à API enquanto o botão mostra "Lendo a foto…". Os campos reconhecidos SHALL ser preenchidos no próprio formulário, sem apagar os que a IA não reconheceu, com um aviso de que foram preenchidos pela IA e devem ser conferidos — pedindo o preço quando ele não foi reconhecido. Quando a IA não reconhecer nem o nome nem o código, o app SHALL avisar para tentar outra foto ou preencher à mão. Erros (IA indisponível, falha, arquivo recusado, limite de uso, sem conexão) SHALL aparecer como mensagem no bloco, mantendo o formulário.

#### Scenario: Foto reconhecida
- **WHEN** o usuário tira a foto de uma embalagem e a IA reconhece nome, categoria e código, sem preço
- **THEN** os três campos são preenchidos e o aviso pede para conferir e informar o preço

#### Scenario: Foto sem produto
- **WHEN** a IA não reconhece um produto na foto
- **THEN** os campos ficam como estavam e o app sugere outra foto ou o preenchimento manual

### Requirement: Origem do cadastro feito com IA
Um produto salvo depois de preenchido pela IA SHALL ser gravado com a origem da IA (`photo_ai` na foto, `voice_ai` na voz) e com o identificador do rascunho, mesmo que o usuário tenha corrigido campos antes de salvar. Sem sugestão aplicada, a origem SHALL seguir as regras do V0 (código lido pela câmera e não alterado → `barcode`; senão, `manual`).

#### Scenario: Foto conferida e salva
- **WHEN** o usuário preenche pela foto, corrige o nome e salva
- **THEN** o produto é gravado com origem `photo_ai`
