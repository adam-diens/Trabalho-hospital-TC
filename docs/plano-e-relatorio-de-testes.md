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

Não foram executados testes automatizados nem validação funcional estruturada durante esta entrega; cobertura numérica não foi medida. A inspeção do schema e advisors foi somente leitura e não conta como teste da aplicação. Executar os casos acima em ambiente de teste antes de apresentar o sistema a pacientes, registrar evidências e repetir depois de corrigir os avisos de segurança.
