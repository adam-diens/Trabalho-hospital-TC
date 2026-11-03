# Arquitetura do backend

## Arquitetura atual

Frontend estático (`index.html`, `app.js`, `styles.css`, `tablet.css`) → API própria Node (`backend/server.cjs`) → Supabase Auth e REST/RPC (PostgREST) → PostgreSQL gerenciado. O navegador não recebe URL/chave do Supabase; a API lê `SUPABASE_URL` e `SUPABASE_PUBLISHABLE_KEY` do `.env` e encaminha o JWT do usuário para que o banco aplique RLS e as funções autorizem cada operação. Não usamos chave `secret`/`service_role`.

O servidor também entrega os arquivos estáticos na execução local, valida a lista de rotas encaminháveis e não serve arquivos `.env`. A API é acessível no mesmo domínio em `/api`; `/api/health` retorna o estado do processo. Em produção, hospede o backend em um serviço Node e configure as variáveis no gerenciador de segredos do provedor.

- `registrar_resposta`, `complementar_resposta` e `registrar_contato` persistem a pesquisa e as solicitações de retorno.
- `painel_resumo`, `listar_manifestacoes` e `exportar_respostas` atendem ao painel conforme o perfil.
- `tv_resumo` entrega indicadores agregados para o TV Wall.
- `definir_perfil` concede papéis a contas existentes no Supabase Auth.
- `salvar_pergunta_setor` mantém uma pergunta ativa por setor e confere a atribuição do usuário antes de gravar.

## Perfis e autorização

A tabela `perfis` liga a identidade do Supabase Auth a um perfil e, para `admin_setor`, ao setor permitido. O administrador de setor pode editar somente a pergunta do próprio setor. O superadministrador pode configurar qualquer setor e conceder os perfis `admin_setor` ou `super_admin`. O e-mail precisa corresponder a uma conta já existente no Supabase Auth.

As regras são verificadas dentro das funções SQL `SECURITY DEFINER`; a interface apenas apresenta as ações disponíveis. As funções qualificam os objetos e restringem `EXECUTE` a `authenticated`, sem acesso para `anon`. Uma chave administrativa não é necessária no frontend.

## Pergunta por setor

O projeto Supabase conectado já possui o índice único parcial para manter uma pergunta ativa por setor. O arquivo da migration correspondente não está nesta cópia do repositório; compare o esquema remoto antes de reaplicar scripts. O modo tablet é ativado com `?setor=pa&modo=tablet`.

## Revisão de segurança

O advisor do Supabase identificou avisos preexistentes sobre tabelas com RLS sem políticas diretas, funções privilegiadas publicamente executáveis, `search_path` mutável em `turno_de` e `limpar_pii`, e proteção contra senhas vazadas desativada. As novas RPCs de administração não são executáveis por `anon`; os demais avisos ainda precisam ser avaliados pelo mantenedor antes do uso com dados reais de pacientes.

Nunca exponha chaves secret ou `service_role`. HTTPS, MFA, revisão de retenção, backups, auditoria e política institucional de incidentes são requisitos para operação.

## Documentação da API

As rotas RPC e seus schemas estão em [OpenAPI](../backend/openapi.yaml); [Swagger UI](api.html) carrega a documentação interativa localmente e requer internet.
