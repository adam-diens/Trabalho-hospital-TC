# Executar os testes e conferir a entrega

## Comandos

Execute na raiz do projeto, após `npm ci`:

| Comando | Pré-requisito e objetivo |
|---|---|
| `npm run check` | Node.js; sintaxe, imports e contrato OpenAPI |
| `npm test` | API, permissões, erros e configuração de produção com Supabase simulado |
| `npm run test:frontend` | Edge instalado; fluxos de interface com API real e Supabase simulado |
| `npm run test:db` | PostgreSQL 15+; instala e testa o banco em cluster local descartável |
| `npm run deploy:check -- https://seu-dominio` | Hospedagem disponível; verificações somente de leitura |

Use `EDGE_BIN` para informar o executável do navegador e `PG_BIN` para a pasta de `initdb`, `pg_ctl` e `psql`, se necessário. No PowerShell, use `npm.cmd`. Não execute os arquivos SQL de testes no Supabase remoto. Imagens opcionais geradas com `npm run test:frontend -- --screenshots` ficam em `output/`, fora do manual.

## Resultado local registrado

- 34 cenários da API e configuração de produção aprovados.
- 68 verificações no Edge aprovadas, incluindo pesquisa, perfis, aprovação/rejeição, Ouvidoria, filtros, CSV, QR, TV, recuperação e renovação de sessão.
- 122 verificações funcionais do banco, 26 de aprovação de contas e sete de catálogo aprovadas.
- 27 operações HTTP integradas às RPCs reais do PostgreSQL aprovadas, com Auth/gateway simulados.
- Instalador e seis migrations produziram o mesmo catálogo em bancos limpos.
- Oito envios simultâneos iguais produziram uma resposta; a cota de origem resistiu a oito conexões sem gravações parciais.
- Aprovação e rejeição simultâneas produziram uma única decisão consistente.

A execução registrada usou Node 24.14.1 e PostgreSQL 18.4. O Blueprint passou no schema oficial do Render; o servidor iniciou em modo produção e a auditoria npm não apontou vulnerabilidades conhecidas na ocasião da preparação. Esses resultados são um registro, não uma garantia permanente.

## Regressões verificadas

Os testes cobrem repetição de envio após falha, conflito de atendimento preservando relato, resposta atrasada sem substituir o chamado atual, identificadores únicos ao adicionar/remover etapas e recuperação da sessão após falha transitória. Também conferem ausência de overflow no painel entre 320 e 1440 px e contraste das quatro variantes de botão no hover.

## Homologação no ambiente real

Antes do uso com pacientes, valide com contas dos cinco perfis: cadastro/aprovação, confirmação e recuperação por e-mail, pesquisa anônima/com contato, autorização por setor, atendimento, CSV, QR Codes e TV. Confira SMTP, domínio/TLS, proxy com visitantes de duas redes, worker, limites sob carga, backups/restauração e navegação com leitor de tela.

A instituição deve aprovar finalidade, aviso e retenção. Testes locais com Auth simulado não comprovam integração remota, cobertura total, acessibilidade completa ou aceite institucional.
