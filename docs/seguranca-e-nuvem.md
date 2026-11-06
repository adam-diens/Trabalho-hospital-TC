# Hospedar no Render e configurar o domínio


O [render.yaml](../render.yaml) prepara um serviço web (site + API) e um worker (TV a cada 15 minutos e expurgo diário), usando a branch `developer`. Os dois serviços usam planos pagos para operação contínua; revise os valores no Render antes de criar. O banco continua no Supabase. A Vercel não está configurada nesta entrega: exigiria adaptar a execução da API e agendar a manutenção fora do processo contínuo atual.

1. Envie as alterações ao repositório. No Render, crie um **Blueprint**, conecte o repositório e selecione `developer`.
2. Informe `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` e `SUPABASE_SECRET_KEY` quando solicitado. O Blueprint gera o HMAC estável e configura o worker; não envie o `.env` local. Consulte [.env.production.example](../.env.production.example) para as variáveis de produção.
3. No domínio `onrender.com`, os QR Codes e a recuperação usam automaticamente a URL pública fornecida pelo Render. Com domínio próprio, configure no serviço web `PUBLIC_ORIGIN=https://seu-dominio` e `AUTH_REDIRECT_URL=https://seu-dominio/?fluxo=recuperar-senha`. A URL nunca vem do cabeçalho Host do navegador.
4. No Supabase Auth, configure **Site URL** com esse domínio e adicione a URL de recuperação às **Redirect URLs**. Mantenha cadastros por e-mail permitidos, confirmação conforme a política institucional e configure SMTP para os e-mails de produção. Confirme as migrations 001–006 e o perfil do primeiro Super Admin.
5. Após o deploy, execute `npm run deploy:check -- https://seu-dominio`. Faça a homologação de login, solicitação/aprovação de conta, recuperação, pesquisa, Ouvidoria e CSV. Configure o aviso/coleta e publique a TV pelo worker. Só então baixe e imprima os QR Codes definitivos.

O deploy automático está desativado: publique novas versões manualmente e atualize **web e worker**. O build verifica código/contrato e testes antes de iniciar. `/api/health` verifica o processo; `/api/ready` verifica a configuração e leitura pública do Supabase, sem comprovar todas as permissões operacionais. Comece com uma instância web; os limites HTTP são locais à instância, enquanto a cota de coleta está no PostgreSQL.

Fontes da configuração: [serviços web](https://render.com/docs/web-services), [variáveis automáticas](https://render.com/docs/environment-variables), [Blueprint](https://render.com/docs/blueprint-spec) e [workers](https://render.com/docs/background-workers).

## Conferir a instalação

Abra o site publicado, solicite e aprove uma conta de teste e valide pesquisa, recuperação de senha, filtros, Ouvidoria e exportação. Confira os logs de `fhdod-jobs`; a TV pode retornar zero até atingir o volume mínimo. O [tutorial de tablet e TV](administracao-tablet.md) explica as condições de publicação.

Teste o acesso por duas redes para conferir os limites por origem. O ingresso preparado considera um proxy controlado; adicionar CDN ou outro proxy exige revisar `TRUST_PROXY_HOPS`. O `.env` em disco é ignorado em produção. As credenciais são configuradas no provedor e não são incluídas no frontend.

Antes do uso real, valide backups/restauração, carga e acessibilidade e aprove o aviso e a retenção com a instituição. A [arquitetura da API](arquitetura-backend.md) detalha permissões, limites, headers e manutenção.
