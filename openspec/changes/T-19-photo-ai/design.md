## Context

Motivação em `proposal.md`; comportamento exigido em `specs/api-product-drafts/spec.md`, `specs/api-products/spec.md` e `specs/product-ai-capture/spec.md`.

- **O que a arquitetura já prevê:**
  - contrato `ProductDraft` e uma só tela de confirmação para scanner, foto e voz (`PLANOMVP.md` §4.3);
  - endpoint `multipart/form-data` com `async`/`await`, sem fila (§4.3);
  - resposta bruta no `JSONB` do produto (§2.3);
  - coluna `ai_raw_response` e origens `photo_ai`/`voice_ai` desde a T-13.
- **T-11, D6:** provedor atrás de `IProductDraftExtractor`, escolhido no início da T-19 com um teste de bancada (~20 fotos e ~10 áudios reais). Critérios, nesta ordem: acerto em PT-BR → custo por cadastro → latência do Brasil → LGPD → SDK.
- **Restrição desta etapa:** desenvolvimento sem o usuário, sem fotos reais de embalagem e sem chaves de nenhum provedor. Não há como fazer o teste de bancada.
- **Ordem do roadmap:** a T-19 vem depois da T-18 (virada). Esta change implementa na branch; ligar em produção espera a virada e a chave.

## Goals / Non-Goals

**Goals:**
- Foto da embalagem → formulário preenchido em poucos segundos, em celular com 4G.
- A IA sugere, o usuário confirma: nada é gravado sem passar pelo formulário.
- Custo previsível: imagem reduzida, limite de uso por usuário, consumo de tokens registrado.
- Provedor trocável sem mudar o fluxo.

**Non-Goals:**
- Teste de bancada e escolha definitiva do provedor (tarefa do usuário, 3.1).
- Fila, webhook, processamento assíncrono (§4.3: só se o volume pedir).
- Base de referência de produtos ou busca por similaridade (fora do V1).
- Ler preço de etiquetas de concorrentes, várias fotos por produto, recorte automático.

## Decisions

### D1. Provedor provisório: OpenAI, pela API REST
**OpenAI** é o adaptador inicial. Os motivos, conferíveis sem o bench:
1. um provedor e **uma chave** cobrem foto (modelo multimodal) e voz (transcrição em PT-BR), o que simplifica a T-20 e a operação;
2. **saída estruturada com JSON Schema estrito** (`response_format: json_schema`), então a resposta vem no formato do `ProductDraft`;
3. a mesma família de modelos existe no **Azure OpenAI**, que fica na mesma fatura do App Service e é um caminho para a LGPD sem trocar o formato das requisições.

**Como chama:** pela API REST com `HttpClient`, não pelo SDK, por dois motivos: é "só mais um HttpClient" (§4.1), e um `HttpMessageHandler` falso testa as requisições sem rede e sem chave.

**Modelos por configuração:**
- `Ai:OpenAI:Model` (padrão `gpt-4.1-mini`) e `Ai:OpenAI:TranscriptionModel` (padrão `gpt-4o-mini-transcribe`), trocáveis sem deploy de código;
- `Ai:OpenAI:BaseUrl` permite apontar para outro endpoint compatível. É assim que o ensaio local usou um servidor falso.

**O que fica pendente:**
- **Teste de bancada (tarefa 3.1):** antes de ligar em produção, rodar as mesmas fotos e áudios no adaptador atual e anotar acerto, custo, latência e política de dados. Se outro provedor ganhar, entra outro `IProductDraftExtractor`.
- **Estimativa de custo por cadastro** (fórmula da T-11, preencher com a tabela de preços do dia):
  - foto: ~1.000–1.500 tokens de entrada (imagem 1600 px em `detail: high` + instruções) e ~50 de saída por cadastro;
  - o consumo real de cada cadastro fica em `ai_raw_response.usage`, que é a base da conta na T-21.

### D2. Uma chamada por foto, saída em esquema estrito
Chat Completions com:
- **instruções em PT-BR:**
  - nome como na prateleira;
  - as sete categorias;
  - preço **só** se estiver na etiqueta ("nunca invente");
  - código só se legível por completo;
  - tudo `null` se não houver produto;
- **a imagem** em `data:` URL com `detail: high`;
- **`temperature: 0`;**
- **`json_schema` estrito** com `name`, `category`, `price`, `ean`, cada um com `null` permitido.

A lista de categorias vai nas instruções, e não num `enum` do esquema: o modo estrito com `enum` contendo `null` não pôde ser conferido sem chave, e um erro ali derrubaria toda chamada. O normalizador (D3) descarta o que vier fora da lista.

Falhas viram `AiExtractionException` → `502 ai_failed`: status de erro, recusa do modelo, JSON inválido, tempo esgotado (`Ai:OpenAI:TimeoutSeconds`, padrão 45 s) ou rede.

### D3. Normalização antes do formulário
`DraftNormalizer`, para o rascunho só trazer valores que o cadastro aceitaria:
- **categoria:** comparada sem acento e sem caixa com as sete do V0; fora delas, `null`;
- **código:** só dígitos (aceita espaços e hífens), 8–14 dígitos e **dígito verificador GS1 válido**, a mesma regra do scanner. Um dígito trocado pela IA vira `null`, não um código errado salvo;
- **preço:** `>= 0`, até o máximo da coluna, arredondado a 2 casas;
- **nome:** aparado e cortado em 200 caracteres.

A resposta **antes** da normalização vai para a resposta bruta, para a T-21 medir o acerto do modelo e não o do normalizador.

### D4. Rascunho em memória por 30 minutos, ligado ao produto pelo `draftId`
A extração devolve um `draftId`; o servidor guarda `(petshop, origem, resposta bruta)` num `IMemoryCache` por 30 minutos (`Ai:DraftLifetimeMinutes`).
- `POST /products` com origem de IA e `draftId` só anexa a resposta bruta se o rascunho for **da mesma loja e da mesma origem**, e o consome (vale para um produto só).
- **Por que não o cliente reenviar a resposta bruta:** ela registra o que a IA disse; vinda do navegador, seria o que o cliente quisesse.
- **Por que não uma tabela:** seria mais uma migration na sequência da T-18 para um dado de minutos. Numa instância B1 o cache em memória basta. O custo: reinício ou segunda instância entre a foto e o salvar faz o produto ser gravado **sem** a resposta bruta, com a origem certa. Aceito, e revisitar se a API tiver mais de uma instância.
- **A origem fica `photo_ai`** mesmo que o usuário corrija campos (D7).

### D5. Limite de uso por usuário; rate limiter depois da autenticação
A política `ai` conta por `sub` (padrão 20 extrações por minuto, `RateLimit:Ai`), porque o custo é de quem usa e um IP compartilhado não deve bloquear a loja vizinha.

Para o limitador conhecer o usuário, `UseRateLimiter()` passou para **depois** de `UseAuthentication()`/`UseAuthorization()`:
- a política `auth` (por IP, endpoints anônimos) não muda;
- uma chamada sem token a rota protegida recebe `401` antes de contar.

A suíte inteira continuou verde com a nova ordem.

### D6. Foto reduzida no navegador
`<input type="file" accept="image/*" capture="environment">`: no celular abre direto a câmera traseira, com a permissão do próprio sistema, sem `getUserMedia`, e no desktop abre o seletor de arquivo. Antes de enviar, `toJpeg`:
- decodifica respeitando a orientação EXIF (`createImageBitmap` com `imageOrientation: 'from-image'`, com `<img>` como alternativa);
- reduz para no máximo 1600 px no lado maior e gera JPEG com qualidade 0,82.

Resultado: uma foto de 12 MP vira centenas de KB (sobe rápido em 4G e gasta menos tokens), e o HEIC do iPhone chega como JPEG. A API aceita só JPEG, PNG e WebP, até 8 MB (`Ai:MaxImageBytes`).

### D7. O formulário de cadastro é a tela de confirmação
O bloco "Preencher com IA" fica no topo do formulário de **cadastro** (não da edição). A sugestão:
- preenche **só** os campos reconhecidos, sem apagar o que o usuário já digitou;
- mostra um aviso "Preenchido pela IA… confira os campos", que pede o preço quando a IA não o leu;
- quando a IA não reconhece nem nome nem código, mostra um aviso para tentar outra foto ou preencher à mão, e a origem continua a normal.

Ao salvar, a origem é `photo_ai` mesmo com campos corrigidos: o produto *veio* da IA, e medir quanto o usuário corrige é justamente o que a T-21 compara (resposta bruta × produto salvo). As demais regras do formulário (validação, código repetido) são as de sempre.

A disponibilidade é consultada uma vez por carregamento do app; sem IA na API ou no modo `supabase`, o bloco não aparece e o cadastro fica como no V0.

## Risks / Trade-offs

- [Provedor escolhido sem o bench] → adaptador trocável (D1), e o bench é tarefa antes de ligar em produção.
- [Esquema estrito recusado pelo provedor] → o esquema usa só tipos com `null`; um erro aparece no primeiro teste real como `ai_failed` no log da API, com a mensagem do provedor.
- [IA inventa preço ou código] → instruções proíbem; o código passa pelo dígito verificador; o usuário confirma tudo (D7).
- [Fotos de clientes no provedor] → a imagem não é guardada pelo PetGest; a política de retenção do provedor entra no bench (LGPD).
- [Rascunho perdido em reinício] → produto salvo sem resposta bruta (D4).
