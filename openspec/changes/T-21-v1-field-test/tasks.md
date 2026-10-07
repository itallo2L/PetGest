## 1. Preparação

- [x] 1.1 Roteiro `roteiro-v1.md` (paridade, conta e e-mail, foto, voz, medições com a consulta SQL, fechamento), `relatorio-v1.md` (resultados, acerto da IA por campo, medições, defeitos) e `como-testar-agora.md` (API e frontend pela rede local, com Postgres por Docker ou sem Docker, chave da IA em `user-secrets`, links de e-mail no console)

## 2. Teste de campo (usuário)

- [ ] 2.1 (Usuário) Rodar o `roteiro-v1.md` pela rede local (`como-testar-agora.md`) no Android e, se a câmera/microfone abrirem com o certificado local, no iPhone; anotar no `relatorio-v1.md`
- [ ] 2.2 (Usuário) Repetir no ambiente de teste publicado (depois da T-17, tarefas 3.x, com e-mail real e chave da IA)
- [ ] 2.3 (Usuário) Repetir em produção, no Android e no iPhone, com rede móvel (depois da T-18), incluindo as medições de acerto e custo (bloco 5)
- [ ] 2.4 (Usuário) Todo ❌ com correção na change de origem ou aceite explícito; decisão final do provedor de IA registrada no relatório

## 3. Fechamento do V1

- [ ] 3.1 Arquivar as changes T-11 a T-22 (`openspec archive`), marcar o V1 como concluído no `ROADMAPV1.md` e atualizar o `CLAUDE.md` (produção no V1)
