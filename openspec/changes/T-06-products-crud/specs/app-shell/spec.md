## MODIFIED Requirements

### Requirement: Áreas ainda não implementadas
Enquanto Configurações não estiver pronta, a área SHALL mostrar um aviso de que está em construção, sem dados fictícios. Produtos deixa de ser um aviso e passa a ser a tela do catálogo (capability `products`).

#### Scenario: Abrir Configurações antes de T-08
- **WHEN** o usuário abre Configurações
- **THEN** vê um estado vazio dizendo que a área está em construção, sem dados da loja simulados
