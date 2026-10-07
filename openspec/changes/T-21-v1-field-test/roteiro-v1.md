# Roteiro do teste de campo — V1

Mesmo formato do roteiro da T-10. Resultados no `relatorio-v1.md` (✅ passou,
❌ falhou, — não se aplica), pelo código de cada passo. Ao anotar uma falha,
registre o que apareceu (com print, se der), o que era esperado e se repetiu.

**Ambiente** (design D1): rede local (`como-testar-agora.md`), teste (prévia da
`dev`) ou produção (depois da T-18). Anote no cabeçalho do relatório.

---

## 0. Preparação

| # | Ação | Resultado esperado | Change |
|---|------|--------------------|--------|
| 0.1 | Conferir o ambiente: no computador, `/health` da API responde `Healthy` | — | T-17 |
| 0.2 | Confirmar que a IA está ligada: no app, "Cadastrar produto" mostra "Preencher com IA" | Bloco com "Foto" e "Voz" | T-19 |
| 0.3 | Separar **10 embalagens reais** variadas: ração, medicamento, higiene, petisco, acessório; pelo menos 2 sem preço na etiqueta e 1 com etiqueta de preço | — | — |
| 0.4 | Para a voz: estar no petshop em horário de movimento, ou com algum ruído de fundo | — | — |

## 1. Paridade com o V0

| # | Ação | Resultado esperado | Change |
|---|------|--------------------|--------|
| 1.1 | Rodar o `roteiro.md` da T-10 inteiro (blocos 1 a 9) neste ambiente | Mesmos resultados do V0 | T-16 (tarefa 4.4) |

## 2. Conta e e-mail

| # | Ação | Resultado esperado | Change |
|---|------|--------------------|--------|
| 2.1 | Criar uma conta com um e-mail seu | Entra no app; chega o e-mail "Confirme seu e-mail no PetGest" (texto em português, botão "Confirmar e-mail"; confira também o spam). Na rede local, o link aparece no console da API | T-22 |
| 2.2 | Abrir o link de confirmação no celular | Tela "E-mail confirmado" com "Ir para o PetGest" | T-22 |
| 2.3 | Abrir o mesmo link de novo | Continua "E-mail confirmado" (confirmar de novo é inofensivo) | T-22 |
| 2.4 | Sair. Em Entrar, tocar **Esqueci minha senha**, enviar o seu e-mail; depois enviar um e-mail sem conta | As duas vezes: "Se houver uma conta com …, enviamos um link". Só o seu recebe e-mail | T-22 |
| 2.5 | Abrir o link do e-mail "Redefinir sua senha"; tentar a senha `123` | Mensagem do mínimo de 6 caracteres | T-22 |
| 2.6 | Salvar uma senha nova válida | "Senha alterada" com "Entrar com a senha nova" | T-22 |
| 2.7 | Abrir o mesmo link de novo | "Link inválido" com "Pedir um link novo" | T-22 |
| 2.8 | Entrar com a senha antiga; depois com a nova | Antiga: "E-mail ou senha incorretos." Nova: entra | T-22 |
| 2.9 | Se outro aparelho estava logado na mesma conta antes do 2.6, usar o app nele | Volta para a tela de entrar (sessão encerrada) | T-22 |
| 2.10 | (Só com `RequireConfirmedEmail` ligado, como em produção depois da T-18) Criar outra conta e entrar sem confirmar | Mensagem de e-mail não confirmado e botão "Reenviar e-mail de confirmação"; o link novo confirma | T-22 |

## 3. Cadastro por foto

Para cada uma das 10 embalagens, anote também o tempo do toque em "Foto" (depois
de tirar a foto) até os campos preenchidos (**M4**) e o acerto de cada campo na
tabela "Acerto da IA" do relatório.

| # | Ação | Resultado esperado | Change |
|---|------|--------------------|--------|
| 3.1 | Abrir "Cadastrar produto"; depois abrir um produto existente | O cadastro mostra "Preencher com IA"; a edição não | T-19 |
| 3.2 | Tocar **Foto** | Abre a câmera **traseira** do celular | T-19 |
| 3.3 | Fotografar a embalagem 1, de frente e bem iluminada | "Lendo a foto…" e depois nome, categoria e (se legível) código preenchidos; aviso "Preenchido pela IA…" pedindo o preço se não veio | T-19 |
| 3.4 | Conferir, corrigir o que precisar, informar o preço e salvar | "Produto cadastrado"; aparece na lista | T-19 |
| 3.5 | Repetir 3.3–3.4 com as embalagens 2 a 10 | Anotar o acerto por campo e o M4 | T-19 |
| 3.6 | Fotografar algo que não é produto (parede, mesa) | Aviso para tentar outra foto ou preencher à mão; campos como estavam | T-19 |
| 3.7 | Fotografar de novo uma embalagem já cadastrada e salvar | Mensagem "O código de barras … já pertence a …" | T-19 |
| 3.8 | Ligar o modo avião e tocar Foto (tirar a foto) | Mensagem de falha de conexão; o formulário continua | T-19 |
| 3.9 | iPhone: repetir 3.2–3.4 com 3 embalagens | Funciona igual (a foto do iPhone é convertida para JPEG) | T-19 |

## 4. Cadastro por voz

| # | Ação | Resultado esperado | Change |
|---|------|--------------------|--------|
| 4.1 | Tocar **Voz** pela primeira vez e **negar** o microfone | "O microfone foi bloqueado…" explicando como liberar | T-20 |
| 4.2 | Liberar o microfone nas configurações do site e tocar Voz de novo | "Gravando… Xs de 30s", com exemplo do que falar; indicador de microfone do celular aceso | T-20 |
| 4.3 | Falar um produto completo (ex.: "Ração Golden adultos frango, quinze quilos, categoria ração, cento e oitenta e nove e noventa") e tocar **Parar e preencher** | "Ouvindo…" e depois nome, categoria e preço preenchidos; aviso com "Entendemos: …". Anotar o tempo do Parar até os campos (**M5**) | T-20 |
| 4.4 | Conferir e salvar | "Produto cadastrado" | T-20 |
| 4.5 | Repetir 4.3–4.4 com 10 produtos diferentes, alguns com ruído de fundo | Anotar o acerto por campo e a transcrição | T-20 |
| 4.6 | Tocar Voz e **Cancelar** no meio | O gravador fecha; o indicador de microfone apaga; nada é preenchido | T-20 |
| 4.7 | Tocar Voz e não parar | Para sozinho aos 30 s e preenche | T-20 |
| 4.8 | Tocar Voz e ir para a tela inicial do celular | O indicador de microfone apaga; ao voltar, o gravador fechou | T-20 |
| 4.9 | iPhone (Safari): repetir 4.2–4.4 com 3 produtos | Funciona igual (o Safari grava em MP4) | T-20 |

## 5. Medições e conferência no banco

| # | Ação | Resultado esperado | Change |
|---|------|--------------------|--------|
| 5.1 | No SQL Editor (ou no Postgres local), rodar a consulta abaixo | Os cadastros dos blocos 3 e 4 com `photo_ai`/`voice_ai`, a resposta bruta da IA ao lado do produto salvo e o consumo de tokens | T-19/T-20 |
| 5.2 | Calcular o custo médio por cadastro: tokens × preço do provedor no dia (fórmula da T-11, D6); a voz soma o custo da transcrição por minuto | Anotar no relatório e comparar com a estimativa | T-19/T-20 |

```sql
select p.created_at, p.source, p.name as salvo, p.category as categoria_salva, p.price as preco_salvo, p.ean as codigo_salvo,
       p.ai_raw_response->'output'->>'name'     as ia_nome,
       p.ai_raw_response->'output'->>'category' as ia_categoria,
       p.ai_raw_response->'output'->>'price'    as ia_preco,
       p.ai_raw_response->'output'->>'ean'      as ia_codigo,
       p.ai_raw_response->>'transcript'         as transcricao,
       (p.ai_raw_response->'usage'->>'prompt_tokens')::int     as tokens_entrada,
       (p.ai_raw_response->'usage'->>'completion_tokens')::int as tokens_saida
from products p
where p.source in ('photo_ai', 'voice_ai')
order by p.created_at;
```

## 6. Fechamento (só em produção, depois da T-18)

| # | Ação | Resultado esperado |
|---|------|--------------------|
| 6.1 | Blocos 1 a 5 em produção, no Android e no iPhone | Todos ✅ ou com aceite explícito |
| 6.2 | Arquivar as changes T-11 a T-22 e marcar o V1 como concluído no `ROADMAPV1.md` | — |
