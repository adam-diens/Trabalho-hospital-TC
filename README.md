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

- Pesquisa de experiência com avaliação por setor, perguntas opcionais com rostinhos e envio de manifestação à Ouvidoria.
- QR Codes específicos por setor e modo tablet.
- Painel autenticado com perfis e indicadores, TV Wall público e exportação compatível com Excel.
- Persistência e autenticação no Supabase.

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
