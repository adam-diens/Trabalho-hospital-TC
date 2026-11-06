# Padrões Git e metodologia

- **Branches:** `developer` concentra a integração atual e é a branch configurada para deploy manual. Use branches de trabalho e revise antes de integrar; promova à `main` somente uma versão validada.
- **Commits:** Conventional Commits em português quando couber: `feat: adiciona avaliação por rostinhos`, `fix: corrige filtro de setor`, `docs: documenta modelo de dados`.
- **PR/revisão:** descrição do problema, escopo, evidência visual, passos manuais de validação, impacto em dados/segurança; uma revisão por outro integrante antes de merge; nunca subir `.env` ou dados reais.
- **Organização:** `.gitignore`, README com setup e lista explícita do que falta; mudanças de esquema por migração revisável; tags para entregas.
- **Kanban sugerido:** Backlog → Pronto → Em andamento → Revisão → Validado. Cartões com critérios de aceite e responsável. Quadro remoto ainda não criado/link não fornecido.
- **Contribuição individual:** combinar divisão de tarefas, mas revisar e contribuir em frontend, modelagem e documentação conjuntamente. O histórico Git registra as contribuições e revisões realizadas.

## Arquivos versionados e locais

- Versionar código, `.env.example`, `.env.production.example`, `package-lock.json`, documentação, migrations em `supabase/migrations/`, operações SQL e todos os testes de `tests/`.
- Manter fora do Git: `.env` e variações locais, chaves privadas, backups, dumps, logs, dependências e estado local da CLI do Supabase. `.gitignore` não remove arquivos já rastreados: revisar o diff antes de cada commit.
- `output/` contém artefatos gerados. Para obter o instalador SQL depois de clonar, executar `npm run db:bundle`; editar sempre as migrations, nunca o arquivo gerado.
- Os testes SQL de `tests/database/` são fixtures e verificações para um cluster descartável. Não fazem parte da instalação em produção e não devem ser executados no SQL Editor remoto.
- `.gitattributes` normaliza arquivos de texto com finais LF, preservando binários e CRLF para `.cmd`/`.bat`. `.editorconfig` orienta os editores a salvar texto em UTF-8 com a mesma convenção.
- Antes de integrar alterações no banco, executar `npm run test:db`; para alterações no site/API atual, executar `npm test`. Registrar limitações quando algum ambiente necessário não estiver disponível.

O link do quadro Kanban continua pendente. O histórico de commits e revisões deve ser consultado diretamente no Git, sem inferir contribuição individual a partir desta documentação.
