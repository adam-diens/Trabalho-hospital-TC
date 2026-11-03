# Padrões Git e metodologia

- **Branches:** Trunk-Based simplificado: `main` sempre executável; branches curtas `feat/...`, `fix/...`, `docs/...`; integrar por PR.
- **Commits:** Conventional Commits em português quando couber: `feat: adiciona avaliação por rostinhos`, `fix: corrige filtro de setor`, `docs: documenta modelo de dados`.
- **PR/revisão:** descrição do problema, escopo, evidência visual, passos manuais de validação, impacto em dados/segurança; pelo menos uma revisão da dupla antes de merge; nunca subir `.env` ou dados reais.
- **Organização:** `.gitignore`, README com setup e lista explícita do que falta; mudanças de esquema por migração revisável; tags para entregas.
- **Kanban sugerido:** Backlog → Pronto → Em andamento → Revisão → Validado. Cartões com critérios de aceite e responsável. Quadro remoto ainda não criado/link não fornecido.
- **Contribuição individual:** combinar divisão de tarefas, mas revisar e contribuir em frontend, modelagem e documentação conjuntamente. Commits/PRs futuros serão a evidência; não inventar histórico que não existe.

Estado do repositório no momento da documentação: protótipo estático sem histórico de PR/commits individuais fornecido; link de Kanban pendente.
