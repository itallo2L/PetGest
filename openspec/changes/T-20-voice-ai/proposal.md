## Why

Nem todo produto tem embalagem fácil de fotografar (ração a granel, acessórios sem rótulo, itens no fundo do estoque), e no balcão do petshop as mãos estão ocupadas. Falar "Ração Golden adultos frango, quinze quilos, cento e oitenta e nove e noventa" é mais rápido que digitar. É a segunda metade do gatilho do V1 (T-11, D1), sobre a base de IA da T-19.

## What Changes

- **API:** `POST /products/drafts/voice` (`multipart/form-data`, campo `audio`): transcreve o áudio em PT-BR, extrai os campos da transcrição e devolve um rascunho com `source = voice_ai` e a transcrição, no mesmo formato e com as mesmas regras da foto (normalização, limite por usuário, `503`/`502`/`400`).
- **Adaptador da OpenAI:**
  - transcrição (`/audio/transcriptions`, idioma `pt`) seguida do mesmo Chat Completions estruturado da foto;
  - áudio sem fala não chama o modelo;
  - a transcrição e o modelo de transcrição vão para a resposta bruta.
- **Frontend (modo `api`):** botão "Voz" no bloco "Preencher com IA":
  - gravador em modal com `MediaRecorder` (WebM/Opus no Chrome, MP4 no Safari), até 30 segundos, cronômetro, "Parar e preencher" e exemplo do que falar;
  - o microfone é solto ao parar, cancelar ou sair da tela;
  - a sugestão preenche o formulário e mostra o que foi entendido ("Entendemos: …").

## Capabilities

### New Capabilities
<!-- nenhuma — as capacidades nascem na T-19 -->

### Modified Capabilities
- `api-product-drafts`: rascunho a partir de um áudio.
- `product-ai-capture`: cadastro por voz no formulário.

## Impact

- **Backend:** `OpenAiProductDraftExtractor.FromAudioAsync` e `AudioExtension`; `ProductDraftService.FromVoiceAsync`; endpoint em `ProductDraftEndpoints`; testes em `OpenAiExtractorTests` e `ProductDraftsApiTests`.
- **Frontend:** `features/products/ai/VoiceRecorder.tsx`, `pickAudioMimeType` em `aiHelpers.ts`, botão "Voz" e transcrição no aviso do `ProductFormModal`; ícones `mic` e `stop`.
- **Banco e dependências:** nada novo.
- **Produção:** nenhum efeito até a T-18 e até a chave da IA ser configurada (mesma chave da T-19).
