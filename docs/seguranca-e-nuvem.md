# Segurança e nuvem

> Registro histórico do ambiente anterior; os avisos abaixo não foram verificados novamente no Supabase remoto nesta reconstrução. Para as permissões, instalação e limites do banco v2, consulte [docs/modelo-de-dados-e-requisitos.md](modelo-de-dados-e-requisitos.md). O banco v2 ainda não foi implantado e o backend atual ainda precisa ser adaptado.

## Conexão

Banco Supabase ativo `Trabalho-hospital-TC`, projeto `sorjfxmcqfbxddgfdaka`, região us-west-2. O navegador chama a API Node local em `/api`; `backend/server.cjs` usa `SUPABASE_URL` e `SUPABASE_PUBLISHABLE_KEY` de `.env` para acessar as APIs do projeto. A chave publishable não tem privilégios elevados e as regras de dados continuam no RLS/funções SQL. `.env` é ignorado pelo Git; `.env.example` contém somente valores ilustrativos. Não usamos chave secret/service role nem senha de banco no frontend. A RPC pública agregada inclui um elogio aprovado; o TV Wall ignora texto e mostra somente números. Nenhum contato foi consultado.

O projeto contém oito tabelas com RLS ligado e as funções RPC descritas. O sistema usa RPC para inserir/consultar dados; não faz acesso direto às tabelas de resposta/contato.

## Avisos de segurança encontrados

O Supabase Security Advisor identificou:

- RLS sem política em `auditoria`, `contatos`, `respostas` e `tentativas`.
- Funções `SECURITY DEFINER` executáveis por `anon` e/ou `authenticated`, incluindo `registrar_resposta`, `registrar_contato`, `complementar_resposta`, `tv_resumo` e `perfil_atual`.
- `search_path` mutável em `turno_de` e `limpar_pii`.
- Proteção de senhas vazadas desativada.

Algumas funções validam perfil, limitação ou consentimento internamente; ainda assim, grants privilegiados precisam de auditoria antes de uso com dados reais. O projeto foi apenas inspecionado: não alterei políticas, grants, usuários ou dados.

## Recomendações de operação

1. Rever grants e lógica de funções `SECURITY DEFINER`; restringir execução por papel e fixar `search_path`.
2. Habilitar proteção contra senha vazada, MFA de administradores, TLS e backups.
3. Provisionar usuários individuais e papéis no Auth, sem contas compartilhadas.
4. Definir retenção/expurgo de telefone, finalidade e canal do titular com a Fundação.
5. Manter contato opcional, consentimento explícito e acesso da Ouvidoria auditado.
6. Restringir origens/CSP do site publicado e monitorar abuso/rate limit.
7. Testar autorização por papel e recuperação antes de qualquer dado real.

Papéis: `super_admin`, `admin_setor`, `gestao`, `ouvidoria`, `visualizador`. Para execução local, copie `.env.example` para `.env`, configure URL e publishable key do painel Supabase, então execute `node backend/server.cjs`. O arquivo `.env` nunca deve ser commitado. Não configure secret/service role nessa aplicação.
