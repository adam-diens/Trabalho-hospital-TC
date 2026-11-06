# Trabalho-hospital-TC

Sistema de pesquisa de satisfação dos pacientes da Fundação Hospitalar Dr. Oswaldo Diesel, de Três Coroas, com pesquisa por setor, manifestações à Ouvidoria, painel de gestão e TV Wall.

Projeto do Curso Técnico em Informática Integrado ao Ensino Médio da Escola Técnica Estadual Monteiro Lobato, desenvolvido por **Theo Keller Paiva, Adam Romão Dientsmann e Ygor Marcadenti Squena**. Contato: [theokpaiva@gmail.com](mailto:theokpaiva@gmail.com).

## Executar localmente

1. Instale Node.js 22+.
2. Execute `npm ci` para instalar as dependências.
3. Copie `.env.example` para `.env`, se ainda não existir, e configure `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, `ORIGIN_HMAC_SECRET` (aleatório, mínimo 32 bytes) e `PUBLIC_ORIGIN`. Segredos ficam somente no servidor.
4. Execute `npm run dev` e acesse [http://127.0.0.1:5173](http://127.0.0.1:5173). Para atualizar a TV e executar a retenção de contatos, mantenha `npm run jobs` em outro terminal.

**Estado atual:** frontend e backend integrados pela API `/api/v2`, com testes locais aprovados. As telas foram refeitas a partir das páginas fornecidas do Figma. A homologação com Auth e dados do Supabase real e a implantação pública continuam pendentes.

## Manual de uso

- **Paciente:** abra o link ou QR Code, escolha o setor e a pesquisa rápida ou completa. Responda à nota geral; as outras etapas são opcionais. Se desejar, deixe uma manifestação e telefone para retorno, com consentimento. Confira o agradecimento ao finalizar.
- **Gestão:** entre em **Acesso da equipe** com uma conta autorizada. Em **Visão da gestão**, filtre período, setor, turno e equipe; selecione a escala dos indicadores. **Exportar Excel** baixa um CSV com os filtros aplicados. As opções disponíveis dependem do perfil. Saia da conta ao terminar.
- **Ouvidoria:** abra uma manifestação, consulte os detalhes permitidos e registre o atendimento e a situação. Em caso de conflito, recarregue o registro antes de salvar novamente.
- **Conta da equipe:** em **Acesso da equipe → Criar conta da equipe**, informe nome, e-mail e senha. Confirme o e-mail quando solicitado e aguarde a aprovação; a solicitação não libera acesso à gestão.
- **Cadastro:** administradores publicam perguntas e organizam equipes e escalas. Em **Cadastro → Gestores**, somente o superadministrador analisa solicitações, aprova com uma função ou rejeita com motivo. As funções para contas novas são Visualizador, Gestão, Ouvidoria e Administrador de Setor (exige setor). O superadministrador também gerencia setores, permissões, privacidade, coleta e auditoria.
- **QR Codes:** copie o link, baixe a imagem ou imprima os códigos de celular/tablet. Os códigos são gerados no próprio servidor. Configure o endereço definitivo em `PUBLIC_ORIGIN` antes de imprimir.
- **TV Wall:** abra **TV Wall** para exibir os indicadores agregados. A tela consulta o último snapshot publicado a cada minuto.

O aviso de privacidade aparece antes da pesquisa. A escala da pergunta geral e das etapas vem da versão publicada; o envio ocorre uma única vez ao concluir. Recuperação de senha exige `AUTH_REDIRECT_URL` autorizado também no Supabase Auth.

## Registro do processo e justificativas

1. **Análise:** foram revisados o enunciado, o projeto atual e as imagens do protótipo no Figma para identificar requisitos e pendências.
2. **Pesquisa simples:** uma pergunta obrigatória no início e etapas opcionais reduzem o esforço e permitem participar mesmo com pouco tempo. Celular e tablet oferecem alternativas de acesso.
3. **Privacidade:** anonimato como opção padrão e telefone opcional com consentimento permitem avaliar sem exigir identificação.
4. **Banco reconstruído:** scripts sobrepostos e falhas de integração e autorização motivaram a organização em migrations, com dados no schema `hospital` e permissões verificadas no banco.
5. **Escalas configuráveis:** o banco v2 permite escolher rostinhos 1–5 ou nota 1–10 por pergunta. Versões preservam respostas antigas e indicadores separados evitam misturar escalas diferentes.
6. **Equipes e indicadores:** a associação à escala é indicativa, sem atribuição de culpa individual. A divulgação pública usa dados agregados.
7. **Backend v2:** a API passou a validar entradas, sessões e perfis, enviar a pesquisa de forma atômica, atender a Ouvidoria e exportar com os mesmos filtros do painel. SSE atualiza indicadores, e um worker separado cuida da TV e do expurgo.
8. **Frontend integrado:** as páginas do Figma orientaram cores, navegação e composição, adaptadas às funções reais. Módulos separados organizam pesquisa, gestão e administração. Indicadores mantêm as escalas separadas; não são apresentados como NPS nem usam números demonstrativos em produção. A sessão fica na aba, o telefone respeita o perfil e os QR Codes dispensam serviços externos.
9. **Aprovação e hierarquia:** novas contas geram solicitações no banco, sem perfil ativo. Somente o Super Admin decide, com auditoria e proteção contra decisões simultâneas. A aprovação oferece funções abaixo de Super Admin, começando por Visualizador; o solicitante não escolhe nem recebe privilégios automaticamente. Metadados do Auth nunca definem autorização.
10. **Validação:** testes da API, banco e navegador verificam fluxos, permissões, aprovação/rejeição, envio com repetição segura, conflitos de atendimento, contraste de hover e responsividade. Auth/gateway são simulados; homologação remota, acessibilidade com leitor de tela e carga de produção continuam pendentes.

Ferramentas utilizadas: HTML, CSS, JavaScript, Node.js, Supabase/PostgreSQL, Git, Edge e Figma como referência visual.

## Instalar ou atualizar o banco no Supabase

**Se o banco v2 já está instalado:** execute [202611060006_aprovacao_contas.sql](supabase/migrations/202611060006_aprovacao_contas.sql) no SQL Editor para habilitar a fila de contas. Se ainda não aplicou a [migration 005](supabase/migrations/202611060005_leitura_administrativa.sql), aplique-a antes. Execute cada migration somente uma vez; não reinstale o bundle. A atualização preserva dados e inclui na fila contas já existentes sem perfil.

Mantenha `ALLOW_SIGNUP=true` no `.env` e permita novos cadastros por e-mail no Supabase Auth. Confirmar e-mail não equivale a aprovar o acesso: são verificações independentes. `ALLOW_SIGNUP=false` desabilita somente o formulário de solicitação; não altera as permissões do banco.

**Para instalação nova:**

1. Em um projeto limpo, execute `npm run db:bundle` e rode o conteúdo gerado em `output/database/instalar.sql` no SQL Editor.
2. Execute [verificar_instalacao.sql](supabase/operacoes/verificar_instalacao.sql); todos os resultados devem ser `true`.
3. Crie a conta do administrador em Authentication, ajuste UUID e nome em [primeiro_admin.sql](supabase/operacoes/primeiro_admin.sql) e execute esse script.

Preserve os schemas nativos do Supabase e mantenha `hospital` fora dos schemas expostos na API. Não aplique o instalador e as migrations separadamente no mesmo banco. A coleta v2 começa desabilitada: configure o aviso e habilite-a em **Cadastro → Configuração** antes do uso.

## Testes e repositório

- `npm test`: 29 cenários da API v2; requer Node.js 22+.
- `npm run test:frontend`: 63 verificações em Edge real com API v2 e Supabase simulado. Requer Edge instalado; `EDGE_BIN` pode indicar o executável. A opção `-- --screenshots` salva imagens de teste em `output/`, sem incluí-las no manual.
- `npm run test:db`: testes do banco e integração HTTP com PostgreSQL real; requer PostgreSQL 15+ (`PG_BIN` informa a pasta dos executáveis).
- `npm run api:spec`: atualiza o OpenAPI; disponível também em `/api/openapi.json`.
- `npm run jobs`: inicia o worker de publicação da TV e expurgo diário em outro processo.

Todos os testes ficam em `tests/`; não execute os SQLs dessa pasta no Supabase. No PowerShell, use `npm.cmd` se necessário.

Configuração, endpoints e operação estão na [arquitetura da API](docs/arquitetura-backend.md).

O `.gitignore` exclui segredos, backups, dependências e arquivos gerados em `output/`. Migrations e testes permanecem versionados. O projeto ainda precisa de homologação antes do uso com dados reais.
