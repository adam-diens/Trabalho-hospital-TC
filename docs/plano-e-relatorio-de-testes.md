# Plano e relatório de testes

## Estratégia

| Nível | Casos principais | Critério |
|---|---|---|
| Unitário | nota 1–5, limiar de convite, consentimento, montagem de CSV | regras válidas e inválidas |
| Integração | RPCs Supabase, gravação relacionada, janela de resposta, perfis e setores | integridade e autorização |
| Funcional/E2E | QR → nota → jornada → manifestação → agradecimento; painel/login; TV Wall | fluxo sem bloqueios em celular/tablet |
| Acessibilidade | teclado, foco, leitor de tela, contraste, zoom 200%, alvos táteis | revisar WCAG aplicável e corrigir achados |
| Segurança | payload inválido, abuso/rate limit, permissões cruzadas, telefone e chave pública | negar/limitar operações indevidas |

## Casos de aceite manual

1. Nota geral obrigatória; opções de jornada e manifestação facultativas.
2. Nota 1–2 convida a Ouvidoria e permite resposta anônima.
3. Telefone só é enviado com consentimento explícito; aparece apenas conforme perfil autorizado.
4. Filtros de período/setor/turno atualizam os indicadores autenticados.
5. Exportação CSV segue a permissão de perfil e não contém telefone.
6. TV Wall mostra somente KPIs agregados, sem comentários.
7. Testar acesso permitido/negado de cada perfil.
8. Testar teclado e larguras móveis.

## Relatório de execução

Os testes da API v2 (`npm test`) e do banco com integração HTTP (`npm run test:db`) passaram localmente. A suíte npm run test:frontend executa 65 verificações em Edge real, usando o servidor da API v2 e Supabase simulado. Substitui a suíte antiga do contrato v1. Cobertura percentual, acessibilidade com leitor de tela e integração remota ainda não foram medidas ou homologadas.


## Validação do banco v2 — 06/11/2026

### Resultado observado

`npm.cmd run test:db` concluiu com código 0 em PostgreSQL 18.4 local:

- Seis migrations instaladas em sequência em cluster descartável.
- 122 verificações funcionais, de integridade e autorização aprovadas.
- Sete verificações de catálogo, grants, RLS e `search_path` aprovadas.
- 34 cenários HTTP da API com Supabase simulado: perfis, validação, Auth, exportação, SSE, jobs, segurança e erros.
- 27 operações HTTP da API executando RPCs reais no PostgreSQL: coleta/idempotência, perfis, Ouvidoria, conflito de revisão, exportação, equipes, escala e administração. Auth e gateway são simulados.
- Instalador SQL único aplicado em outro banco limpo; catálogo comparado ao das migrations (funções, ACLs, colunas, constraints e índices).
- Oito conexões simultâneas repetindo a mesma submissão: uma resposta e um protocolo.
- Oito conexões simultâneas com limite de origem igual a um: uma gravação aceita, sete rejeitadas, sem respostas parciais.
- Instalação sobre tabela legada: rejeitada e transação revertida.

O teste usa fixtures fictícias de setores, questionários, contas e contato. O cluster é encerrado ao final; nenhuma conexão com Supabase remoto é utilizada. As fixtures de `auth.users`/`auth.uid()` simulam o contexto de identidade, mas o SQL, locks, transações, constraints, grants, triggers e RLS são executados pelo PostgreSQL real.

### O que ainda falta validar

1. Aplicação das migrations 005/006 no Supabase já instalado e homologação remota da API.
2. Supabase Auth, JWTs reais, PostgREST e cache da API.
3. Credenciais operacionais e proxy confiável configurados no ambiente de hospedagem; teste de carga e limites por rede.
4. Worker/scheduler implantado e fluxos SSE/frontend no ambiente real.
5. Backup/restauração, concorrência representativa do hospital, planos de consulta e limites da hospedagem.
6. Retenção de comentários/relatos e aprovação institucional do aviso e dos prazos de contato.
7. Leitor de tela, navegação assistiva e dispositivos físicos do hospital.

O resultado demonstra o contrato local testado; não é uma certificação de produção nem uma afirmação de que o banco remoto foi corrigido.

## Frontend integrado — 06/11/2026

As 65 verificações cobrem coleta rápida/completa, escalas, privacidade, contato, repetição segura após falha, formulário indisponível, seleção de setor, cinco perfis, filtros e CSV, telefone restrito, texto escapado, conflito de atendimento preservando o relato, publicação de questionário, escalas, configuração, QR SVG, TV, recuperação de senha, renovação e logout. O painel foi verificado sem overflow nas larguras 320, 390, 768, 1024 e 1440 px. Imagens opcionais usam fixtures e ficam em output/frontend, fora do manual. Nenhum teste acessa o Supabase remoto.

## Aprovação de contas e contraste

Mais 26 verificações SQL validam a fila, contas sem acesso, proibição de autopromoção, perfis inferiores, setor obrigatório, rejeição e auditoria. Uma aprovação e uma rejeição concorrentes produzem uma única decisão consistente. A API também testa o mapeamento do conflito HTTP 500/SQLSTATE 40001 para 409. No navegador, cadastro, aprovação, rejeição e histórico foram exercitados; quatro variantes de botão mantêm contraste mínimo de 4,5:1 no hover.

## Preparação para hospedagem

Cinco cenários adicionais da API verificam configuração de produção, URLs derivadas do Render/domínio próprio, .env ignorado em produção, IP/HMAC atrás do proxy, arquivos internos bloqueados, headers HTTPS/CSP, QR canônico e ciclo de manutenção. O smoke test de 20 requisições foi exercitado contra o servidor local em modo produção, com Supabase simulado; o endereço real só poderá ser verificado depois do deploy. O render.yaml passou na validação do schema oficial em https://render.com/schema/render.yaml.json. A suíte do navegador também verifica preservação e recuperação da sessão após erro transitório de renovação.

Mantêm-se pendentes a validação do proxy real (incluindo dois visitantes distintos), Supabase Auth/SMTP, domínio/TLS, envio de pesquisa, aprovação, recuperação, SSE, CSV e execução do worker na hospedagem. Nenhum deploy ou alteração remota foi feito nesta etapa.

A instalação reproduzível das 29 dependências foi conferida com npm ci (sem scripts de instalação), o servidor real iniciou em modo produção e respondeu ao health check, e npm audit --omit=dev retornou zero vulnerabilidades conhecidas. A execução local usou Node 24.14.1; o Blueprint fixa a linha 24 LTS no Render. O gerador do instalador passou a aceitar indentação/BOM sem alterar o SQL das migrations, e o catálogo do bundle foi comparado ao das seis migrations em PostgreSQL descartável.
