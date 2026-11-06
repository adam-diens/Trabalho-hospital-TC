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

Os testes automatizados do site (`npm test`) e do banco (`npm run test:db`) passaram localmente. A suíte do site usa Supabase simulado; os resultados do PostgreSQL real estão abaixo. Cobertura percentual, acessibilidade com leitor de tela e integração remota ainda não foram medidas ou homologadas.


## Validação do banco v2 — 06/11/2026

### Resultado observado

`npm.cmd run test:db` concluiu com código 0 em PostgreSQL 18.4 local:

- Quatro migrations instaladas em sequência em cluster descartável.
- 115 verificações funcionais, de integridade e autorização aprovadas.
- Sete verificações de catálogo, grants, RLS e `search_path` aprovadas.
- Instalador SQL único aplicado em outro banco limpo; catálogo comparado ao das migrations (funções, ACLs, colunas, constraints e índices).
- Oito conexões simultâneas repetindo a mesma submissão: uma resposta e um protocolo.
- Oito conexões simultâneas com limite de origem igual a um: uma gravação aceita, sete rejeitadas, sem respostas parciais.
- Instalação sobre tabela legada: rejeitada e transação revertida.

O teste usa fixtures fictícias de setores, questionários, contas e contato. O cluster é encerrado ao final; nenhuma conexão com Supabase remoto é utilizada. As fixtures de `auth.users`/`auth.uid()` simulam o contexto de identidade, mas o SQL, locks, transações, constraints, grants, triggers e RLS são executados pelo PostgreSQL real.

### O que ainda falta validar

1. Instalação no projeto Supabase de destino e inventário/remoção explícita dos objetos legados desse ambiente.
2. Supabase Auth, JWTs reais, PostgREST e cache da API.
3. Backend adaptado: credencial operacional somente no servidor, origem confiável para cotas, limite de requisição, timeout e tradução de erros.
4. Polling/atualização do painel e jobs de publicação da TV e expurgo.
5. Backup/restauração, concorrência representativa do hospital, planos de consulta e limites da hospedagem.
6. Retenção de comentários/relatos e aprovação institucional do aviso e dos prazos de contato.
7. Frontend e manual adaptados às novas escalas e RPCs.

O resultado demonstra o contrato local testado; não é uma certificação de produção nem uma afirmação de que o banco remoto foi corrigido.
