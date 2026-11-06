# Experiência do Paciente — FHDOD

Aplicação de pesquisa de satisfação para a Fundação Hospitalar Dr. Oswaldo Diesel, de Três Coroas. Pacientes respondem pelo celular ou tablet; a equipe acompanha indicadores e manifestações conforme seu perfil.

Projeto do Curso Técnico em Informática Integrado ao Ensino Médio da Escola Técnica Estadual Monteiro Lobato, desenvolvido por **Theo Keller Paiva, Adam Romão Dientsmann e Ygor Marcadenti Squena**. Contato: [theokpaiva@gmail.com](mailto:theokpaiva@gmail.com).

## Rodar no seu computador

### 1. Preparar o ambiente

Instale Node.js 24 LTS (22 LTS também é compatível), Git e tenha um projeto Supabase. Clone este repositório, entre na pasta e instale as dependências:

```powershell
npm.cmd ci
```

Os exemplos usam PowerShell. Em outros terminais, pode usar `npm` no lugar de `npm.cmd`.

### 2. Configurar o .env

Copie `.env.example` para `.env`, caso ainda não exista. Preencha:

| Variável | Valor |
|---|---|
| `SUPABASE_URL` | URL da API do seu projeto Supabase |
| `SUPABASE_PUBLISHABLE_KEY` | Chave pública do projeto (`sb_publishable_...`) |
| `SUPABASE_SECRET_KEY` | Chave operacional (`sb_secret_...`), exclusiva do servidor |
| `ORIGIN_HMAC_SECRET` | Segredo aleatório gerado pelo comando abaixo |

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Copie o resultado para `ORIGIN_HMAC_SECRET` e mantenha o valor entre reinícios. Para uso local, preserve os demais valores do modelo, incluindo:

```dotenv
NODE_ENV=development
PUBLIC_ORIGIN=http://127.0.0.1:5173
AUTH_REDIRECT_URL=http://127.0.0.1:5173/?fluxo=recuperar-senha
ALLOW_SIGNUP=true
HOST=127.0.0.1
PORT=5173
```

Não versione o `.env`. Em produção, use as variáveis do provedor conforme [.env.production.example](.env.production.example).

### 3. Instalar o banco e criar o primeiro administrador

Em um **projeto Supabase limpo**, gere o instalador:

```powershell
npm.cmd run db:bundle
```

No SQL Editor do Supabase:

1. Execute o conteúdo de `output/database/instalar.sql`.
2. Execute [verificar_instalacao.sql](supabase/operacoes/verificar_instalacao.sql); os resultados devem ser `true`.
3. Crie e confirme a primeira conta em **Authentication → Users**. Copie seu UUID, preencha UUID e nome em [primeiro_admin.sql](supabase/operacoes/primeiro_admin.sql) e execute o script.

Se o banco já estiver instalado, aplique somente as migrations pendentes, na ordem; não reinstale o bundle. Consulte o [tutorial do banco](docs/modelo-de-dados-e-requisitos.md#instalar-ou-atualizar).

Em **Authentication → URL Configuration**, configure a Site URL local e autorize a URL de recuperação indicadas acima. Permita cadastros por e-mail para receber solicitações de conta.

### 4. Iniciar a aplicação

```powershell
npm.cmd run dev
```

Abra [http://127.0.0.1:5173](http://127.0.0.1:5173). Em outro terminal, mantenha a manutenção automática:

```powershell
npm.cmd run jobs
```

Entre em **Acesso da equipe** com o Super Admin. Em **Cadastro → Configurações**, preencha o aviso de privacidade, sua versão e habilite a coleta. Sem isso, a pesquisa fica indisponível. Reinicie os processos após alterar o `.env`.

## Uso básico

- **Paciente:** escolha o setor e a pesquisa rápida ou completa, leia o aviso e responda à nota geral. Na completa, etapas, manifestação e contato são opcionais.
- **Equipe:** solicite uma conta em **Criar conta da equipe** e aguarde a aprovação do Super Admin em **Cadastro → Gestores**.
- **Gestão:** aplique os filtros em **Visão da gestão** e consulte os indicadores. **Exportar Excel** baixa CSV com os filtros aplicados, quando o perfil permitir.
- **Ouvidoria:** consulte a manifestação e registre o atendimento. Telefone e histórico interno são restritos à Ouvidoria e ao Super Admin.
- **TV Wall:** apresenta resultados agregados publicados pelo worker. A primeira publicação exige ao menos cinco respostas na mesma escala; consulte as [regras da TV](docs/administracao-tablet.md#tv-wall).

Tutoriais por função estão no [índice da documentação](docs/README.md). O [registro do processo e das justificativas](docs/ux-personas-e-fluxo.md) explica as decisões do projeto.

## Tecnologias

| Tecnologia | Uso |
|---|---|
| HTML, CSS e JavaScript com módulos ES | Interface responsiva |
| Node.js e módulos HTTP nativos | Servidor, API e manutenção |
| Supabase Auth e PostgreSQL | Autenticação, persistência, funções SQL e RLS |
| `qrcode` | Geração local de QR Codes em SVG |
| SSE e CSV | Atualização do painel e exportação |
| Figma | Referência visual das telas |
| Git e npm | Versionamento e dependências |
| Edge e ferramentas do PostgreSQL | Testes de navegador e integração |
| Render | Configuração de hospedagem web e worker |

## Publicação e verificação

O [tutorial de hospedagem](docs/seguranca-e-nuvem.md) explica o [render.yaml](render.yaml), as variáveis e o domínio dos QR Codes. O modelo usa dois serviços pagos e a branch `developer`; revise os custos antes de criar os serviços. Não há configuração de deploy para Vercel nesta versão.

| Comando | Finalidade |
|---|---|
| `npm.cmd run check` | Sintaxe, imports e consistência do OpenAPI |
| `npm.cmd test` | API e configuração de produção |
| `npm.cmd run test:frontend` | Fluxos no Edge; requer navegador instalado (`EDGE_BIN` opcional) |
| `npm.cmd run test:db` | Banco descartável; requer PostgreSQL 15+ (`PG_BIN` opcional) |
| `npm.cmd run api:spec` | Atualizar o contrato OpenAPI |
| `npm.cmd run deploy:check -- https://seu-dominio` | Verificar a hospedagem sem gravar dados |

Os testes SQL não devem ser executados no Supabase remoto. Código, migrations e testes são versionados; segredos, dependências e artefatos em `output/` ficam fora do Git. Os testes locais passaram; domínio, Auth/SMTP, proxy, carga, acessibilidade e rotinas operacionais ainda precisam de homologação no ambiente real. Consulte o [relatório de testes](docs/plano-e-relatorio-de-testes.md).
