# Experiência do Paciente

Projeto do curso técnico em informática integrado ao ensino médio da Escola Técnica Estadual Monteiro Lobato, com finalidade unicamente acadêmica, desenvolvido por Theo Keller Paiva, Adam Romão Dientsmann e Ygor Marcadenti Squena, conforme as requisições da Fundação Hospitalar Dr. Oswaldo Diesel.

Aplicação para coletar a satisfação dos pacientes do hospital. Contato: theokpaiva@gmail.com


## Funcionalidades

- Pesquisas de satisfação acessadas por setor, com suporte a links e QR Codes.
- Registro de avaliações, comentários e etapas da jornada do paciente.
- Encaminhamento opcional de solicitações à Ouvidoria.
- Painel de gestão com indicadores, filtros e exportação de respostas.
- Área TV Wall para exibição de elogios autorizados.
- Controle de acesso por perfil, com políticas de segurança no Supabase.

## Tecnologias

- [Vite](https://vite.dev/) — desenvolvimento e build da aplicação.
- [Supabase](https://supabase.com/) — banco de dados, autenticação e API.

## Configuração

### Pré-requisitos

- Node.js e npm.
- Um projeto Supabase.

### Instalação

1. Instale as dependências:

   ```bash
   npm install
   ```

2. Copie `.env.example` para `.env` e preencha as credenciais do projeto Supabase:

   ```env
   VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
   VITE_SUPABASE_ANON_KEY=sua_chave_anon
   ```

   Encontre esses valores em **Supabase → Project Settings → API**.

3. No SQL Editor do Supabase, execute os arquivos nesta ordem:

   1. `supabase/schema.sql`
   2. `supabase/correcoes_seguranca.sql`
   3. `supabase/testes.sql`

   Os testes devem retornar `true`.

## Comandos

| Comando | Descrição |
| --- | --- |
| `npm run dev` | Inicia o servidor de desenvolvimento. |
| `npm run build` | Gera a versão de produção na pasta `dist/`. |
| `npm run preview` | Pré-visualiza localmente a versão de produção. |

O conteúdo de `dist/` pode ser publicado em qualquer servidor de sites estáticos.

## Segurança

- A chave `anon` é utilizada no navegador e não é secreta. Proteja os dados com as políticas RLS e as funções do banco.
- Não inclua no front-end nem versione a senha do banco, uma connection string PostgreSQL ou a chave `service_role`.
- Mantenha o arquivo `.env` fora do Git.
- Se alguma credencial sensível tiver sido publicada, revogue-a ou troque-a no Supabase.

## Autoria

Desenvolvido por Theo Keller Paiva, Adam Romão Dientsmann e Ygor Marcadenti Squena.

