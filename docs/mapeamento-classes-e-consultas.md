# Entender o caminho dos dados

O projeto usa módulos JavaScript e funções SQL, sem uma camada de classes de repositório. O navegador chama `/api/v2`; a API valida a entrada e a sessão e executa RPCs do Supabase. As tabelas do domínio ficam em `hospital`, sem acesso direto pelo cliente.

| Fluxo | RPC principal | Persistência |
|---|---|---|
| Abrir formulário | `ep_formulario` | Versão publicada, perguntas e aviso |
| Enviar pesquisa | `ep_enviar_pesquisa` | Resposta, etapas, manifestação e contato em uma transação |
| Consultar painel | `ep_painel` | Agregação por período, setor, turno, equipe e escala |
| Consultar/atender Ouvidoria | `ep_listar_manifestacoes`, `ep_detalhar_manifestacao`, `ep_atender_manifestacao` | Manifestação, contato autorizado e interações |
| Exportar | `ep_exportar` | Página analítica sem telefone ou texto livre |
| Publicar/ler TV | `ep_publicar_tv`, `ep_tv` | Snapshot público agregado |
| Aprovar conta | `ep_decidir_solicitacao` | Solicitação, perfil e auditoria |

Para localizar uma operação, procure sua rota em [backend/routes.cjs](../backend/routes.cjs), o tratamento HTTP em [backend/app.cjs](../backend/app.cjs) e a função SQL nas [migrations](../supabase/migrations). O [OpenAPI](../backend/openapi.yaml) descreve campos e permissões. Depois de alterar rotas, execute `npm run api:spec` e `npm run check`.

Filtros e escopo são verificados no servidor e no banco. As agregações mantêm as escalas separadas. Escalas de equipe usam setor/data/turno, e a unicidade dessa atribuição impede duplicar respostas nas junções. O envio usa UUID para repetir uma mesma tentativa sem duplicá-la. Consulte o [modelo de dados](modelo-de-dados-e-requisitos.md).
