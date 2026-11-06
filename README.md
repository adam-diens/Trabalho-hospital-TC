# Trabalho-hospital-TC

Projeto acadêmico do Curso Técnico em Informática Integrado ao Ensino Médio da Escola Técnica Estadual Monteiro Lobato, desenvolvido por Theo Keller Paiva, Adam Romão Dientsmann e Ygor Marcadenti Squena conforme as requisições da Fundação Hospitalar Dr. Oswaldo Diesel, de Três Coroas.

Aplicação para coletar a satisfação dos pacientes do hospital. Contato: [theokpaiva@gmail.com](mailto:theokpaiva@gmail.com).

## Executar localmente

1. Instale Node.js 18 ou superior.
2. Copie `.env.example` para `.env` e configure `SUPABASE_URL` e `SUPABASE_PUBLISHABLE_KEY` no painel do Supabase.
3. Inicie a aplicação com `npm run dev` ou `node backend/server.cjs`.
4. Acesse `http://127.0.0.1:5173`.

A aplicação inclui frontend responsivo e API própria em Node.js. A API encaminha somente rotas permitidas ao Supabase; credenciais administrativas não devem ser colocadas no navegador. O arquivo `.env` contém segredos locais e não deve ser commitado.

## Recursos

- Pesquisa rápida: apenas a avaliação geral, com cinco rostos do melhor para o pior.
- Pesquisa completa: avaliação geral, etapas opcionais com notas de 1 a 10 e manifestação à Ouvidoria. É possível concluir sem percorrer todas as etapas.
- QR Codes distintos por setor para celular (`?setor=pa&modo=celular`) e tablet (`?setor=pa&modo=tablet`). Ambos permitem escolher a outra jornada. No tablet, o agradecimento reinicia a pesquisa após oito segundos.
- Painel autenticado com perfis e indicadores, TV Wall público e exportação compatível com Excel.
- Persistência e autenticação no Supabase.

## Atualização da escala e acesso

Em bancos existentes, execute [escala_jornada_10.sql](supabase/escala_jornada_10.sql) no SQL Editor do Supabase, após `schema.sql` e `correcoes_seguranca.sql`. Isso libera as notas inteiras de 1 a 10 nas etapas opcionais, preservando os dados anteriores. A avaliação geral continua de 1 a 5. O script não é executado automaticamente ao iniciar o servidor.

A navegação pública oferece pesquisa e TV Wall (dentro do menu). O acesso da equipe também fica no menu. Gestão, gráficos e QR Codes exigem perfil `admin_setor`, `gestao` ou `super_admin`; a API verifica a sessão e o perfil no Supabase, além das regras do banco. O cadastro sozinho não concede acesso. A gestão funciona também no celular, e a pesquisa funciona também no computador. Em telas grandes, uma sessão de gestão válida abre o painel por padrão.

## Validação

Execute `npm test` (`npm.cmd test` no PowerShell se a política de scripts bloquear o npm). Os testes usam um Supabase simulado e o Edge em modo headless, sem gravar dados reais. Defina `EDGE_BIN` caso o executável esteja em outro caminho. Cobrem permissões da API, seleção do primeiro setor, pesquisa rápida, escala de 1 a 10, consentimento sem perda dos campos, telefone, QR Codes e ausência de rolagem horizontal entre 320 e 1440 pixels.

## Documentação

- [Índice dos documentos](docs/README.md)
- [Requisitos](docs/requisitos.md)
- [Arquitetura do backend](docs/arquitetura-backend.md)
- [Especificação OpenAPI](backend/openapi.yaml)
- [Visualizador interativo da API](docs/api.html)
- Scripts SQL mantidos em `supabase/` para configurar o banco; revise o estado do projeto antes de aplicá-los.
- [Modelo de variáveis de ambiente](.env.example)

O quadro Kanban ainda não foi disponibilizado; o link deve ser incluído aqui quando criado.

## Aviso

Projeto acadêmico. Não use com dados reais de pacientes sem revisão institucional de segurança, privacidade, consentimento e operação. Indicadores de demonstração não devem ser usados para decisões clínicas ou disciplinares.
