# Trabalho-hospital-TC

Sistema de pesquisa de satisfação dos pacientes da Fundação Hospitalar Dr. Oswaldo Diesel, de Três Coroas, com pesquisa por setor, manifestações à Ouvidoria, painel de gestão e TV Wall.

Projeto do Curso Técnico em Informática Integrado ao Ensino Médio da Escola Técnica Estadual Monteiro Lobato, desenvolvido por **Theo Keller Paiva, Adam Romão Dientsmann e Ygor Marcadenti Squena**. Contato: [theokpaiva@gmail.com](mailto:theokpaiva@gmail.com).

## Executar localmente

1. Instale Node.js 18+.
2. Copie `.env.example` para `.env` e configure `SUPABASE_URL` e `SUPABASE_PUBLISHABLE_KEY`.
3. Execute `npm run dev` e acesse [http://127.0.0.1:5173](http://127.0.0.1:5173).

**Estado atual:** o site ainda usa o contrato anterior do banco. O banco v2 foi reconstruído e testado localmente, mas sua aplicação no Supabase e integração com o site estão pendentes. O link público definitivo ainda não foi informado.

## Manual de uso

- **Paciente:** abra o link ou QR Code, escolha o setor e a pesquisa rápida ou completa. Responda à nota geral; as outras etapas são opcionais. Se desejar, deixe uma manifestação e telefone para retorno, com consentimento. Confira o agradecimento ao finalizar.
- **Gestão:** entre em **Menu → Acesso da equipe** com uma conta autorizada. Abra **Gestão e gráficos**, use os filtros de período, setor e turno e consulte os indicadores e manifestações. **Exportar Excel** baixa um CSV; na versão atual, a exportação considera apenas o filtro de setor. Saia da conta ao terminar.
- **QR Codes:** a equipe autorizada pode abrir **QR Codes** e copiar o link do setor para celular ou tablet. Use o endereço definitivo antes de imprimir.
- **TV Wall:** abra **Menu → TV Wall** para exibir os indicadores agregados. A tela atual atualiza a cada minuto.

O atendimento completo da Ouvidoria e o acesso aos cinco perfis ainda dependem da integração com o banco v2.

## Registro do processo e justificativas

1. **Análise:** foram revisados o enunciado, o projeto atual e as imagens do protótipo no Figma para identificar requisitos e pendências.
2. **Pesquisa simples:** uma pergunta obrigatória no início e etapas opcionais reduzem o esforço e permitem participar mesmo com pouco tempo. Celular e tablet oferecem alternativas de acesso.
3. **Privacidade:** anonimato como opção padrão e telefone opcional com consentimento permitem avaliar sem exigir identificação.
4. **Banco reconstruído:** scripts sobrepostos e falhas de integração e autorização motivaram a organização em migrations, com dados no schema `hospital` e permissões verificadas no banco.
5. **Escalas configuráveis:** o banco v2 permite escolher rostinhos 1–5 ou nota 1–10 por pergunta. Versões preservam respostas antigas e indicadores separados evitam misturar escalas diferentes.
6. **Equipes e indicadores:** a associação à escala é indicativa, sem atribuição de culpa individual. A divulgação pública usa dados agregados.
7. **Validação:** os testes do site passaram com Supabase simulado. O banco passou por 115 verificações funcionais, sete de catálogo e testes concorrentes em PostgreSQL real. A homologação remota e a adaptação do site são as próximas etapas.

Ferramentas utilizadas: HTML, CSS, JavaScript, Node.js, Supabase/PostgreSQL, Git, Edge e Figma como referência visual.

## Instalar o banco no Supabase

1. Em um projeto limpo, execute `npm run db:bundle` e rode o conteúdo gerado em `output/database/instalar.sql` no SQL Editor.
2. Execute [verificar_instalacao.sql](supabase/operacoes/verificar_instalacao.sql); todos os resultados devem ser `true`.
3. Crie a conta do administrador em Authentication, ajuste UUID e nome em [primeiro_admin.sql](supabase/operacoes/primeiro_admin.sql) e execute esse script.

Preserve os schemas nativos do Supabase e mantenha `hospital` fora dos schemas expostos na API. Não aplique o instalador e as migrations separadamente no mesmo banco. A coleta v2 começa desabilitada e exige integração do site e configuração do aviso de privacidade antes do uso.

## Testes e repositório

- `npm test`: testes do site; requer Node.js 22+ e Edge (`EDGE_BIN` permite outro caminho).
- `npm run test:db`: testes do banco; requer PostgreSQL 15+ (`PG_BIN` informa a pasta dos executáveis).

Todos os testes ficam em `tests/`; não execute os SQLs dessa pasta no Supabase. No PowerShell, use `npm.cmd` se necessário.

O `.gitignore` exclui segredos, backups, dependências e arquivos gerados em `output/`. Migrations e testes permanecem versionados. O projeto ainda precisa de homologação antes do uso com dados reais.
