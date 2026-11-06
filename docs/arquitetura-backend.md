# Consultar e alterar a API

## Organização

O frontend em `assets/js/` chama a API `/api/v2` no mesmo domínio. O servidor usa Supabase Auth para identificar o usuário e RPCs `ep_*` para acessar o PostgreSQL. O [OpenAPI](../backend/openapi.yaml), servido em `/api/openapi.json`, é a referência de rotas, campos e perfis.

| Arquivo | Responsabilidade |
|---|---|
| `backend/server.cjs` | Iniciar e encerrar o servidor |
| `backend/app.cjs` | HTTP, autenticação, CSV, QR Codes e SSE |
| `backend/routes.cjs` | Rotas, schemas e perfis autorizados |
| `backend/validation.cjs` | Tipos, datas, limites e campos permitidos |
| `backend/supabase.cjs` | Auth/RPC, timeout e tradução de erros |
| `backend/security.cjs` | Origens, proxy, HMAC e limites HTTP |
| `backend/config.cjs` | Configuração do ambiente |
| `backend/maintenance.cjs`, `backend/worker.cjs` | Publicação da TV e expurgo de contatos |

## Alterar uma operação

1. Localize ou defina a rota em `backend/routes.cjs`, incluindo campos e perfis.
2. Implemente o tratamento necessário em `backend/app.cjs` e a regra no banco por migration.
3. Atualize o módulo do frontend correspondente e acrescente teste para o comportamento alterado.
4. Execute `npm run api:spec`, `npm run check` e `npm test`. Para mudanças SQL, execute também `npm run test:db`.

Não encaminhe RPCs arbitrárias nem aceite perfil, data de coleta ou hash de origem enviados pelo navegador. Cada operação institucional valida a sessão e o perfil ativo; o banco também verifica as permissões.

## Sessão e coleta

Operações institucionais usam `Authorization: Bearer <access_token>`. A sessão fica em `sessionStorage`, com renovação e revalidação do perfil. Cadastro não concede acesso: o Super Admin decide as solicitações. Logout remove a sessão local; um JWT já emitido pode permanecer válido no Supabase até expirar.

A pesquisa é enviada ao concluir, em uma única transação. O UUID de envio deve ser mantido com o mesmo conteúdo nas tentativas após falha. Trocar a chave após timeout pode gerar outra resposta. O telefone exige consentimento; perguntas respeitam a escala e a versão recebidas do formulário.

## Indicadores, paginação e exportação

O painel aceita período de até 366 dias, setor, turno e equipe. SSE envia atualizações autenticadas a cada 15 segundos e encerra após cinco minutos; o cliente reconecta usando fetch com Bearer. Não coloque tokens na URL.

Listas paginadas retornam `X-Next-Cursor`. Perfis, solicitações, equipes e exportações usam cursor UUID; manifestações usam protocolo, e auditoria usa id. Consulte o nome do parâmetro no OpenAPI.

O CSV mantém os filtros aplicados, usa UTF-8 com BOM e separador ponto e vírgula, protege contra fórmulas e não inclui telefone, comentário ou relato. O limite padrão é 10 mil linhas; reduza o período se exceder. Páginas do dia corrente não constituem um snapshot transacional único.

## Configuração e manutenção

Siga o [README](../README.md) para uso local e o [tutorial de hospedagem](seguranca-e-nuvem.md) para produção. O serviço web exige origem pública, HMAC e chaves do Supabase. O worker exige URL e chave operacional. Chaves secret/service role nunca entram em arquivos públicos.

| Comando | Operação |
|---|---|
| `npm run jobs` | Worker contínuo: TV a cada 15 minutos e expurgo diário |
| `npm run jobs:once -- tv` | Tentar publicar a TV uma vez |
| `npm run jobs:once -- expurgar` | Executar expurgo de contatos vencidos |

O servidor HTTP não inicia o worker. Falhas da TV não impedem o expurgo; o worker aguarda a tarefa em andamento ao encerrar. Não há rota pública para manutenção.

## Limites operacionais

O padrão aceita JSON de até 32 KiB, resposta upstream de até 8 MiB e timeout upstream de oito segundos. A configuração dos limites está em `.env.example`. Somente arquivos públicos autorizados são servidos. Logs registram rota, status, duração e identificador, sem corpos, senhas, telefone ou tokens.

Os limites HTTP ficam em memória por instância; várias instâncias exigem controle compartilhado no ingresso. A cota de coleta fica no PostgreSQL. Pacientes na mesma rede podem compartilhar a origem; declarar canal tablet não concede cota maior. A cadeia de proxies confiáveis precisa ser validada na hospedagem.
