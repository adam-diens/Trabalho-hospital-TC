# Padrões do banco de dados

- PostgreSQL; tabelas no plural, `snake_case` e nomes em português.
- PKs/FKs tipadas: `id`, `setor_id`, `resposta_id`; perfis vinculam `auth.users.id`.
- Timestamp da resposta chama-se `criado_em` (`timestamptz`, UTC); escala usa `data` (`date`) e `turno`.
- Nota `smallint` com `CHECK (1..5)`; categorias de manifestação limitadas a `elogio`, `reclamacao`, `sugestao`.
- Jornada opcional armazenada em JSONB; telefone fica em `contatos`, separado da resposta analítica.
- Dados analíticos devem usar constraints, consulta parametrizada, transação e migração revisável. Nunca concatenar texto de entrada para formar SQL.
- RLS está habilitado em todas as tabelas; respostas/contatos/auditoria/tentativas são operadas pelas RPCs e não por acesso direto do browser.
- Índices recomendados para filtros por resposta `(setor_id, criado_em)` e escala `(setor_id, data, turno)`. O advisor ainda aponta FKs sem índice em `escala.setor_id`, `perfis.setor_id`, `perguntas.setor_id`.
- O advisor também sinaliza índices ainda não usados em `respostas`/`tentativas`; com poucos registros isso não justifica removê-los sem plano de execução e carga representativa.
- A coluna `nps` existente é derivada da nota 1–5 no schema atual. Como a escala facial não mede NPS, o site não apresenta nem exporta esse campo como NPS; revisar a coluna no próximo ciclo de migração.
- Retenção e anonimização devem ser rotina documentada. Existe função de expurgo de telefone após fechamento; prazo final deve ser aprovado pela Fundação.
