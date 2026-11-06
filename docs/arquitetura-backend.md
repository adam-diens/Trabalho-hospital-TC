# Backend e API v2

## Estado e arquitetura

A API Node foi adaptada ao banco v2. O frontend anterior não foi alterado e ainda chama rotas antigas, que agora retornam HTTP 410. A migração do frontend é a próxima etapa.

Fluxo: cliente → API `/api/v2` → Supabase Auth e RPCs `ep_*` → PostgreSQL. Não há acesso direto às tabelas por HTTP. O backend não exige dependências npm externas; usa módulos nativos do Node.js 22+.

| Arquivo | Responsabilidade |
|---|---|
| `backend/server.cjs` | Inicialização e encerramento do servidor |
| `backend/app.cjs` | HTTP, autenticação, execução dos fluxos, CSV e SSE |
| `backend/routes.cjs` | Rotas, perfis autorizados e schemas de entrada |
| `backend/validation.cjs` | Validação estrita de JSON, consultas, datas e limites |
| `backend/supabase.cjs` | Cliente de Auth/RPC com timeout e tradução de erros |
| `backend/security.cjs` | CORS, origem confiável, HMAC e limites por IP |
| `backend/config.cjs` | Configuração por ambiente, sem expor valores secretos |
| `backend/maintenance.cjs`, `worker.cjs` | Publicação da TV e expurgo, fora do servidor HTTP |
| `backend/openapi.cjs` | Contrato OpenAPI gerado das mesmas definições de rotas |

## Atualizar o banco já instalado

Executar somente [202611060005_leitura_administrativa.sql](../supabase/migrations/202611060005_leitura_administrativa.sql) no SQL Editor. Ela acrescenta consultas de configuração, setores inativos e questionários por versão, sem recriar tabelas. Recarregar o cache se necessário: `notify pgrst, 'reload schema';`.

A administração precisa consultar perguntas mesmo antes de habilitar a coleta; a RPC pública de formulário não permite isso. A nova leitura é restrita ao perfil/escopo autorizado. Instalações novas recebem essa migration no bundle normal. Não reinstalar o bundle no banco já configurado.

## Configuração

Usar `.env.example` como referência. Variáveis principais:

- `SUPABASE_URL` e `SUPABASE_PUBLISHABLE_KEY`: Auth, leituras públicas e operações com JWT institucional.
- `SUPABASE_SECRET_KEY`: chave operacional `sb_secret_*`, usada somente para coleta e manutenção. Como alternativa, `SUPABASE_SERVICE_ROLE_KEY` aceita JWT legado. Nunca colocar essas chaves em código público.
- `ORIGIN_HMAC_SECRET`: valor aleatório de pelo menos 32 bytes; manter o mesmo entre reinícios e réplicas.
- `PUBLIC_ORIGIN`: endereço externo exato para os links dos setores. Não é derivado do cabeçalho Host do cliente.
- `AUTH_REDIRECT_URL`: URL do futuro formulário de recuperação, autorizada também no Supabase Auth.
- `ALLOW_SIGNUP=false`: cadastro público desabilitado por padrão; as contas podem ser criadas pelo painel do Supabase. Habilitar apenas se o hospital desejar cadastro seguido de aprovação.
- `TRUSTED_PROXY_IPS`: somente IPs exatos dos proxies controlados. Por padrão, `X-Forwarded-For` é ignorado.
- `CORS_ORIGINS`: origens extras exatas; não aceita curingas. O mesmo domínio de `PUBLIC_ORIGIN` já é autorizado.

`NODE_ENV=production` exige URLs HTTPS, credenciais e origem/HMAC configurados. Atrás de proxy, configurar também `HOST`/`PORT` conforme o provedor. O Node não termina TLS; o proxy deve fornecer HTTPS.

## Rotas e fluxos

O contrato com campos, tipos, limites e perfis está em [backend/openapi.yaml](../backend/openapi.yaml), também servido em `/api/openapi.json`. Execute `npm run api:spec` após alterar as definições das rotas.

| Grupo | Rotas principais |
|---|---|
| Público | `GET /api/v2/setores`, `GET /api/v2/setores/:slug/formulario`, `GET /api/v2/tv` |
| Pesquisa | `POST /api/v2/pesquisas` |
| Sessão | `POST /api/v2/auth/entrar`, `/renovar`, `/cadastrar`, `/recuperar-senha`, `/sair`; `PUT /api/v2/auth/senha`; `GET /api/v2/me` |
| Gestão | `GET /api/v2/painel`, `/painel/stream`, `/exportacoes`, `/exportacoes.csv`, `/qrcodes` |
| Ouvidoria | `GET /api/v2/manifestacoes`, `/manifestacoes/:id`; `POST /api/v2/manifestacoes/:id/atendimentos` |
| Administração | `GET/PUT /api/v2/configuracao`, `GET/PUT /api/v2/perfis`, `GET/POST /api/v2/questionarios`, `GET/PUT /api/v2/equipes`, `GET/PUT /api/v2/escalas`, `PUT /api/v2/setores`, `GET /api/v2/admin/setores`, `GET /api/v2/auditoria` |
| Operação | `GET /api/health` (processo), `GET /api/ready` (configuração e conectividade pública) |

### Coleta

O navegador deve enviar uma única pesquisa ao concluir. Exemplo mínimo:

```json
{
  "chave_envio": "UUID criado no dispositivo e preservado nos retries",
  "questionario_id": "UUID recebido no formulário",
  "nota": 5,
  "canal": "celular",
  "privacidade_versao": "versão recebida no formulário"
}
```

Opcionais: `etapas` (objeto chave/nota), `tipo`, `comentario`, `telefone`, `consentimento`. Tipo e comentário são enviados juntos; contato exige consentimento. É permitido pedir retorno sem escrever comentário. Escalas são verificadas na versão do questionário no banco.

A API calcula `p_origem_hash` por HMAC do IP confiável e executa a coleta com credencial operacional. Nunca aceita `p_origem_hash`, perfil ou data do cliente. O banco preserva a atomicidade e a idempotência. Repetir a mesma chave com o mesmo payload retorna o mesmo resultado; conteúdo diferente falha. Timeout não autoriza criar uma chave nova para a mesma participação.

### Sessão e autorização

Usar `Authorization: Bearer <access_token>` em toda operação institucional. A API consulta o Supabase Auth e o perfil ativo, sem cache de autorização. O próprio banco verifica as regras novamente. Não enviar tokens em URLs.

Login e renovação devolvem tokens e perfil somente para contas com acesso ativo. Cadastro não concede perfil. Recuperação usa resposta genérica para evitar revelar contas. A troca de senha aceita sessão válida ou de recuperação, inclusive `nonce` quando exigido pelo Auth. A tela de recuperação ainda será implementada no frontend.

Logout usa escopo local do Supabase; o frontend deve remover seus tokens. Como no Supabase, JWTs já emitidos podem continuar válidos até expirar; revogação imediata distribuída de access tokens não foi implementada nesta entrega.

Ouvidoria e Super Admin podem ler contatos e registrar atendimentos. Gestão e Admin de Setor não recebem telefone nem histórico interno. Visualizador acessa indicadores sem equipe e não lê manifestações nem exporta respostas individuais. Admin de Setor é limitado ao setor ativo atribuído.

### Atualização e exportação

O painel aceita `inicio`, `fim`, `setor`, `turno`, `equipe`, com intervalo máximo de 366 dias. SSE em `/painel/stream` envia eventos `painel` a cada 15 segundos, revalidando a sessão e o perfil. Usar `fetch` com Bearer, pois `EventSource` nativo não envia esse header. Reconectar quando o fluxo encerrar após cinco minutos; máximo de três fluxos por usuário/instância.

JSON paginado usa `limite` e `depois`; respostas trazem `X-Next-Cursor`. Manifestações usam `antes` com o menor protocolo recebido. Auditoria usa `antes` com o menor id. Quando a página vier vazia, terminou.

CSV percorre páginas preservando os mesmos filtros, gera UTF-8 com BOM, separador `;` e proteção contra fórmulas. Não inclui telefone, comentário ou relato. Máximo padrão de 10 mil linhas, uma exportação por usuário e duas por instância; exceder o limite exige reduzir o período ou usar JSON paginado. Exportação durante coleta do dia atual não é um snapshot transacional entre páginas; para um relatório estável, usar dias encerrados.

`/qrcodes` devolve links por setor/canal, limitados ao setor do administrador quando aplicável. As imagens dos QR Codes serão geradas na etapa de frontend; nenhuma URL é enviada a gerador externo pelo backend.

## Manutenção

- `npm run jobs:once -- tv`: tenta publicar o snapshot agregado da TV.
- `npm run jobs:once -- expurgar`: remove telefones vencidos conforme a retenção configurada.
- `npm run jobs:once`: executa as duas tarefas.
- `npm run jobs`: mantém um worker separado, com TV a cada 15 minutos e expurgo diário; ambas executam também na inicialização.

O servidor HTTP não inicia o worker automaticamente nem oferece uma rota pública de manutenção. Usar apenas um worker ou um scheduler externo controlado. As rotinas são idempotentes; não precisam de credenciais de usuários institucionais. Publicar a TV pode retornar zero quando o grupo/intervalo mínimo ainda não foi atingido.

## Segurança e limites operacionais

Corpo JSON: 32 KiB; resposta upstream: 8 MiB; timeout upstream: 8 segundos. Datas reais, tipos, propriedades desconhecidas, campos reservados e consultas repetidas são validados. SQLSTATEs viram erros HTTP controlados; logs registram identificador, rota, método, status e duração, sem corpo, query, IP, senha, telefone ou tokens.

Somente HTML/JS/CSS do frontend e imagens em `assets/` são servidos. `.env`, `.git`, SQLs, código do backend, testes e backups não são públicos. Headers de segurança, CORS explícito, limite de leitura/tentativas e HMAC reduzem abuso. O limite HTTP fica em memória por instância; múltiplas réplicas exigem também controle no gateway. A cota de coleta no PostgreSQL continua compartilhada por origem e setor.

Como a origem usa IP, pacientes na mesma rede podem compartilhar a cota; o hospital deve dimensionar os limites e a identificação confiável dos quiosques na homologação. Declarar `canal=tablet` não concede uma cota maior. Monitoramento, restauração de backup, políticas de texto livre e carga real ainda dependem do ambiente de produção.

Referências: [chaves do Supabase](https://supabase.com/docs/guides/getting-started/api-keys), [Auth REST](https://supabase.github.io/auth/), [logout](https://supabase.com/docs/guides/auth/signout).
