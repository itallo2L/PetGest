## ADDED Requirements

### Requirement: Rascunho a partir da voz
A API SHALL oferecer `POST /products/drafts/voice`, protegido, que recebe um áudio (`multipart/form-data`, campo `audio`, nos formatos gravados pelos navegadores — WebM, Ogg, MP4/M4A, MP3 ou WAV —, até o limite configurado), transcreve a fala em português e responde `200` com um rascunho de origem `voice_ai`: identificador do rascunho, nome, categoria, preço, código de barras e a transcrição, com as mesmas regras de validação, de arquivo recusado, de falha do provedor e de limite de uso do rascunho a partir de uma foto. O preço SHALL vir só quando for dito. Áudio sem fala SHALL resultar num rascunho sem campos, sem erro. A API MUST NOT guardar o áudio.

#### Scenario: Produto falado com preço
- **WHEN** um usuário grava "Petisco Dreamies salmão sessenta gramas, categoria petiscos, nove e noventa"
- **THEN** recebe o nome, a categoria "Petiscos", o preço 9,90, a transcrição e a origem `voice_ai`

#### Scenario: Gravação em silêncio
- **WHEN** o áudio enviado não tem fala
- **THEN** recebe `200` com o rascunho sem nome, categoria, preço nem código

#### Scenario: Produto salvo a partir da voz
- **WHEN** o usuário cadastra o produto com origem `voice_ai` e o identificador desse rascunho
- **THEN** o produto é gravado com origem `voice_ai` e com a resposta bruta, que inclui a transcrição
