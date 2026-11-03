# Modelo de dados e requisitos

## Paradigma

PostgreSQL relacional é apropriado porque respostas, setores, escalas, turnos, usuários/perfis e auditoria mantêm relações explícitas. Chaves, constraints, transações e índices apoiam integridade e agregações por setor + data + turno. JSONB é usado para avaliações opcionais da jornada, cuja forma varia, mantendo a resposta geral relacional.

## Estado observado

Projeto Supabase ativo **Trabalho-hospital-TC**, região us-west-2. Existem as oito tabelas abaixo com RLS habilitado, as RPCs referidas na arquitetura e 3 respostas já registradas. A RPC pública agregada devolve um elogio previamente marcado como publicável; o frontend usa apenas KPIs e descarta comentários. Nenhum telefone foi consultado. A captura enviada está desatualizada quanto à contagem.

| Tabela | Atributos centrais | Relações |
|---|---|---|
| `setores` | id, slug, nome, limite_ouvidoria, ativo | pai de perguntas, respostas, escala, perfis |
| `respostas` | id, setor_id, criado_em, turno, nota, nps, jornada JSONB, tipo, comentario, publicavel, origem | pertence a setor; pode ter contato |
| `contatos` | resposta_id, protocolo, telefone, aceite_lgpd, datas/estado Ouvidoria | um contato por resposta |
| `perguntas` | id, setor_id, etapa, texto, obrigatoria, ordem, ativa | setor opcional |
| `escala` | id, setor_id, data, turno, equipe | equipe por setor/data/turno |
| `perfis` | user_id, nome, perfil enum, setor_id | identidade Supabase Auth; cinco papéis |
| `auditoria` | id, user_id, acao, alvo, em | trilha administrativa |
| `tentativas` | id, dispositivo, setor_id, em | rate limit/telemetria curta |

## Regra da pergunta ativa

Cada setor possui no máximo uma pergunta ativa, garantida pelo índice parcial `perguntas_uma_ativa_por_setor_idx`. Perguntas substituídas são mantidas com `ativa=false`; cada resposta continua relacionada ao setor e guarda a nota de 1 a 5.

## Modelo lógico

`setores 1—N respostas`; `respostas 1—0..1 contatos`; `setores 1—N escala`; `setores 1—N perguntas`; `setores 1—N perfis`; `auth.users 1—1 perfis`. Escala candidata por setor/data/turno não identifica culpabilidade individual.

`supabase/schema.sql` contém o DDL inicial e `supabase/correcoes_seguranca.sql` reúne funções e regras complementares. Esses scripts são uma base histórica e não representam necessariamente todas as alterações do banco conectado; revise antes de executar.
