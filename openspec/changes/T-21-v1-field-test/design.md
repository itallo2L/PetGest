## Context

- **Roteiro do V0:** `openspec/changes/T-10-field-test/roteiro.md` (blocos 0 a 10), com relatório por passo e defeitos virando tarefa na change de origem.
- **V1 entregue em código** (2026-10-07):
  - T-16: frontend no modo `api`;
  - T-17: deploy preparado;
  - T-18: virada preparada;
  - T-19/T-20: foto e voz;
  - T-22: e-mail e recuperação de senha.
- **Dependências externas para o roteiro completo:**
  - ambiente publicado (T-17, tarefas 3.x);
  - chave da IA (T-19, tarefa 3.2);
  - e-mail real (T-22, tarefa 3.1);
  - para rodar em produção, a virada (T-18).

## Decisions

### D1. Três ambientes possíveis, o mesmo roteiro
| Ambiente | Quando | E-mail | Observação |
|---|---|---|---|
| **Rede local** (`como-testar-agora.md`) | já | links no console da API | certificado local: aceitar o aviso uma vez; iPhone pode recusar a câmera com certificado local |
| **Teste** (prévia da `dev` + API de teste) | depois da T-17 | real (ACS) | o mais parecido com produção antes da virada |
| **Produção** | depois da T-18 | real | é o que fecha o V1 |

O relatório registra em qual ambiente cada passo rodou. **O V1 só fecha com o roteiro completo em produção, em Android e iPhone.**

### D2. Acerto da IA medido contra o produto salvo
Para cada cadastro por foto ou voz, o acerto de cada campo (nome, categoria, preço, código) é anotado como:
- ✅ veio certo;
- ✏️ veio e foi corrigido;
- ⬜ não veio.

Os dois lados ficam no banco: a resposta bruta (`ai_raw_response.output`) e o produto salvo. A consulta do roteiro (bloco 5) mostra os dois lado a lado. O custo sai de `ai_raw_response.usage`, multiplicado pela tabela de preços do provedor no dia (fórmula da T-11, D6).

### D3. Mesma regra de defeitos da T-10
Cada ❌ vira uma linha em "Defeitos" e uma tarefa na change de origem (T-16 a T-22); não vira tarefa nova (`ROADMAPV1.md`, T-21). Depois da correção, o passo é refeito.
