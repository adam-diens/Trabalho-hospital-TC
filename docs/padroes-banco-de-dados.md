# Padrões de banco — v2

- PostgreSQL 15+ / Supabase; um schema de domínio `hospital`, RPCs `public.ep_*`, infraestrutura Supabase preservada.
- Tabelas no plural, nomes em português, `snake_case`; UUIDs de domínio e FKs explícitas. Protocolo/auditoria/interações usam identities sem truncamento.
- Migrations ordenadas em `supabase/migrations/`. Sem scripts paralelos redefinindo as mesmas funções. Fonte única; instalador gerado por `npm run db:bundle`.
- Timestamps `timestamptz`; data/turno da coleta calculados em `America/Sao_Paulo`, sem confiar no relógio do cliente.
- Notas inteiras com `CHECK` por escala; respostas e etapas preservam escala e versão. JSON de entrada é validado e convertido para relações normalizadas.
- Uma pergunta geral por versão publicada, uma versão vigente por setor, uma escala por setor/data/turno. FKs compostas validam relacionamentos cruzados.
- Coleta atômica e idempotente; locks na ordem setor → questionário para publicação/coleta, advisory lock para chave de envio e contadores por `UPSERT` atômico.
- RLS em todas as tabelas internas e nenhum grant direto para clientes, inclusive papel operacional. Funções verificam perfil ativo e setor; `NULL` nunca concede acesso.
- RPCs `SECURITY DEFINER` com `search_path=''`, nomes qualificados e grants por assinatura. Não expor helpers nem schema `hospital` na Data API.
- `auth.users` é gerenciado pelo Supabase; não criar cópia de senhas ou excluir schemas nativos. Exclusão de conta vinculada a perfis ou histórico pode ser bloqueada; desativar perfil preserva histórico.
- Auditoria/histórico/respostas/perguntas são imutáveis pela API. Telefone separado com consentimento versionado e expurgo operacional. Texto livre requer política de retenção própria antes de produção.
- Testar integridade, autorizações, isolamento e concorrência em PostgreSQL real com `npm run test:db`. Testes com Auth simulado não substituem homologação JWT/PostgREST.
