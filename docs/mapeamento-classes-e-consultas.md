# Mapeamento de persistência e consultas

## Componentes em execução

O frontend chama a API própria em `/api`. O backend Node encaminha chamadas permitidas às rotas REST/RPC do Supabase, sem expor a URL ou chave no navegador. Não existem classes JavaScript de repositório separadas; validações, transações, filtros de perfil e agregações ficam nas funções do banco.

| Função RPC | Operação I/O e responsabilidade |
|---|---|
| `registrar_resposta` | Valida setor ativo/nota e limite de tentativas; cria `respostas` e registra `tentativas` |
| `complementar_resposta` | Acrescenta `jornada`, `tipo` e comentário com sanitização PII |
| `registrar_contato` | Exige aceite, valida telefone e grava `contatos` com protocolo |
| `painel_resumo` | Agrega respostas por período/setor/turno/equipe com limite mínimo de cinco por equipe |
| `listar_manifestacoes` | Lê manifestações; telefone aparece apenas para Ouvidoria/Super Admin e acesso é auditado |
| `exportar_respostas` | Retorna campos autorizados sem telefone para gerar CSV |
| `tv_resumo` | Agregados públicos dos últimos 30 dias sem dados de contato |

## Consultas centrais

As consultas abaixo refletem a lógica confirmada nas funções SQL do projeto, simplificada para leitura:

```sql
-- Agregar por setor e período
SELECT s.slug, s.nome, count(*) AS respostas, round(avg(r.nota), 2) AS media
FROM public.respostas r JOIN public.setores s ON s.id = r.setor_id
WHERE r.criado_em >= now() - make_interval(days => $1)
  AND ($2 IS NULL OR s.slug = $2)
  AND ($3 IS NULL OR r.turno = $3)
GROUP BY s.slug, s.nome;

-- Cruzar escala; mostrar somente grupos com pelo menos cinco respostas
SELECT e.equipe, count(*) AS n, round(avg(r.nota), 2) AS media
FROM public.respostas r JOIN public.escala e
  ON e.setor_id = r.setor_id AND e.turno = r.turno
 AND e.data = (r.criado_em AT TIME ZONE 'America/Sao_Paulo')::date
GROUP BY e.equipe HAVING count(*) >= 5;

-- Ouvidoria: juntar contato na função de perfil; telefone omitido para outros perfis
SELECT r.id, s.nome, r.criado_em, r.nota, r.tipo, r.comentario,
       CASE WHEN $perfil IN ('super_admin','ouvidoria') THEN c.telefone END AS telefone
FROM public.respostas r JOIN public.setores s ON s.id = r.setor_id
LEFT JOIN public.contatos c ON c.resposta_id = r.id;
```

Usar RPCs existentes para manter política de perfil. Não consultar `contatos` diretamente no frontend.
# Camada de API e persistência

`backend/server.cjs` serve a aplicação e implementa `/api/health`, `/api/auth/v1/token` e uma lista restrita de rotas de dados. Injeta a chave publishable a partir de `.env` e encaminha o JWT do usuário quando presente. Não usa `service_role`/secret nem conexão direta por `DATABASE_URL`.

`app.js` é o cliente da API: login/renovação de sessão, pesquisa, painel, exportação, TV Wall e administração chamam `/api`. As regras de autorização e persistência permanecem no Postgres via funções RPC e RLS.
