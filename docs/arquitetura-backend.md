# Arquitetura do backend

> Documento do backend anterior, ainda utilizado pelo site. O contrato para a futura integração está em [contrato SQL v2](#contrato-sql-v2); o banco v2 não é compatível com chamadas antigas.

## Arquitetura atual

Frontend estático (`index.html`, `app.js`, `styles.css`, `tablet.css`) → API própria Node (`backend/server.cjs`) → Supabase Auth e REST/RPC (PostgREST) → PostgreSQL gerenciado. O navegador não recebe URL/chave do Supabase; a API lê `SUPABASE_URL` e `SUPABASE_PUBLISHABLE_KEY` do `.env` e encaminha o JWT do usuário para que o banco aplique RLS e as funções autorizem cada operação. Não usamos chave `secret`/`service_role`.

O servidor também entrega os arquivos estáticos na execução local, valida a lista de rotas encaminháveis e não serve arquivos `.env`. A API é acessível no mesmo domínio em `/api`; `/api/health` retorna o estado do processo. Em produção, hospede o backend em um serviço Node e configure as variáveis no gerenciador de segredos do provedor.

- `registrar_resposta`, `complementar_resposta` e `registrar_contato` persistem a pesquisa e as solicitações de retorno.
- `painel_resumo`, `listar_manifestacoes` e `exportar_respostas` atendem ao painel conforme o perfil.
- `tv_resumo` entrega indicadores agregados para o TV Wall.
- `definir_perfil` concede papéis a contas existentes no Supabase Auth.
- `salvar_pergunta_setor` mantém uma pergunta ativa por setor e confere a atribuição do usuário antes de gravar.

## Perfis e autorização

A tabela `perfis` liga a identidade do Supabase Auth a um perfil e, para `admin_setor`, ao setor permitido. O administrador de setor pode editar somente a pergunta do próprio setor. O superadministrador pode configurar qualquer setor e conceder os perfis `admin_setor` ou `super_admin`. O e-mail precisa corresponder a uma conta já existente no Supabase Auth.

As regras são verificadas dentro das funções SQL `SECURITY DEFINER`; a interface apenas apresenta as ações disponíveis. As funções qualificam os objetos e restringem `EXECUTE` a `authenticated`, sem acesso para `anon`. Uma chave administrativa não é necessária no frontend.

## Pergunta por setor

O projeto Supabase conectado já possui o índice único parcial para manter uma pergunta ativa por setor. O arquivo da migration correspondente não está nesta cópia do repositório; compare o esquema remoto antes de reaplicar scripts. O modo tablet é ativado com `?setor=pa&modo=tablet`.

## Revisão de segurança

O advisor do Supabase identificou avisos preexistentes sobre tabelas com RLS sem políticas diretas, funções privilegiadas publicamente executáveis, `search_path` mutável em `turno_de` e `limpar_pii`, e proteção contra senhas vazadas desativada. As novas RPCs de administração não são executáveis por `anon`; os demais avisos ainda precisam ser avaliados pelo mantenedor antes do uso com dados reais de pacientes.

Nunca exponha chaves secret ou `service_role`. HTTPS, MFA, revisão de retenção, backups, auditoria e política institucional de incidentes são requisitos para operação.

## Documentação da API

As rotas RPC e seus schemas estão em [OpenAPI](../backend/openapi.yaml); [Swagger UI](api.html) carrega a documentação interativa localmente e requer internet.

## Contrato SQL v2

RPCs ficam em `public`, no endpoint Supabase `/rest/v1/rpc/ep_*` com POST. Parâmetros abaixo mantêm os nomes exatos do SQL. Datas são `YYYY-MM-DD`, UUIDs são strings, turnos são `manha`, `tarde`, `noite`; escalas são `rostos_5`, `nota_10`.

Não há compatibilidade com `registrar_resposta`, `complementar_resposta`, `painel_resumo` ou demais RPCs antigas. Não substituir chamadas parcialmente: reconstruir o fluxo ao redor da submissão atômica.

## Público

- `ep_setores()` → array `{id,slug,nome}` de setores ativos.
- `ep_formulario(p_setor text)` → `{questionario_id,versao,metrica,limite_ouvidoria,privacidade_versao,privacidade_texto,perguntas:[{id,chave,texto,metrica,obrigatoria,ordem}]}`. Escala de cada pergunta governa sua renderização. Só a geral é obrigatória.
- `ep_tv()` → `{periodo_dias,metricas:[{metrica,n,media,satisfacao,publicado_em,inicio,fim}]}`. Array vazio significa ausência de snapshot público válido, não nota zero.

## Submissão pelo backend

`ep_enviar_pesquisa(p_chave_envio uuid,p_questionario uuid,p_nota int,p_canal text,p_origem_hash text,p_privacidade_versao text,p_etapas jsonb='{}',p_tipo text=null,p_comentario text=null,p_telefone text=null,p_consentimento boolean=false)`.

Somente `service_role` pode chamar. O navegador envia o formulário à API própria, que valida tamanho e tipo, deriva a origem confiável e chama a RPC. Credencial operacional nunca deve ser devolvida ao navegador. A origem deve ser HMAC-SHA256 (hexadecimal de 64 caracteres) calculado com segredo do servidor e origem validada, por exemplo IP obtido do proxy confiável. **Não confiar no hash ou `X-Forwarded-For` enviados livremente pelo cliente.** IP compartilhado pode afetar cotas; quiosques autorizados precisam de identificação autenticada no backend, não apenas `modo=tablet`.

```json
{
  "p_chave_envio": "UUID mantido nos retries do mesmo envio",
  "p_questionario": "UUID retornado por ep_formulario",
  "p_nota": 5,
  "p_canal": "celular",
  "p_origem_hash": "64 caracteres hex gerados no servidor",
  "p_privacidade_versao": "versão exibida ao paciente",
  "p_etapas": {"recepcao": 4},
  "p_tipo": "elogio",
  "p_comentario": "A equipe me acolheu bem.",
  "p_telefone": null,
  "p_consentimento": false
}
```

Retorna `{recebida:true,protocolo:123}` quando há manifestação/retorno; protocolo `null` em avaliação sem manifestação. Protocolo é identificador de acompanhamento, **não credencial para consulta pública**. Não existe endpoint público de leitura de manifestação.

Um novo UUID deve ser criado só para uma nova participação. Timeout não autoriza trocar a chave: repetir exatamente o payload anterior. Erro de questionário/aviso desatualizado exige recarregar e obter nova confirmação do usuário antes de preparar outro envio.

`p_tipo` aceita `elogio`, `reclamacao`, `sugestao`, com comentário. Telefone sem comentário/tipo abre `retorno`, com consentimento explícito. Não é necessário informar telefone para obter protocolo em manifestação escrita.

## Sessão institucional

Usar `apikey` pública e `Authorization: Bearer <JWT do usuário>` no backend. Não substituir o JWT institucional por service role.

| RPC | Parâmetros | Retorno |
|---|---|---|
| `ep_meu_perfil` | nenhum | `{user_id,nome,papel,setor_id}` |
| `ep_painel` | `p_inicio date,p_fim date,p_setor uuid=null,p_turno text=null,p_equipe uuid=null` | Objeto de indicadores |
| `ep_listar_manifestacoes` | `p_setor uuid=null,p_situacao text=null,p_limite int=50,p_antes bigint=null` | Array; usar menor protocolo como próximo cursor |
| `ep_detalhar_manifestacao` | `p_id uuid` | Comentário, estado e revisão; contato/histórico só para Ouvidoria e Super Admin |
| `ep_atender_manifestacao` | `p_id uuid,p_revisao int,p_situacao text,p_relato text` | Nova revisão inteira |
| `ep_exportar` | `p_inicio date,p_fim date,p_setor uuid=null,p_turno text=null,p_equipe uuid=null,p_limite int=500,p_depois uuid=null` | Array; usar último id como próximo cursor |
| `ep_publicar_questionario` | `p_setor uuid,p_metrica text,p_limite int,p_pergunta_geral text,p_etapas jsonb='[]'` | UUID da versão publicada |
| `ep_salvar_setor` | `p_slug text,p_nome text,p_ativo boolean=true` | UUID |
| `ep_salvar_equipe` | `p_setor uuid,p_nome text,p_ativa boolean=true` | UUID |
| `ep_listar_equipes` | `p_setor uuid=null,p_limite int=100,p_depois uuid=null` | Array com UUID, nome, setor e estado |
| `ep_salvar_escala` | `p_setor uuid,p_equipe uuid,p_data date,p_turno text` | UUID; atualiza equipe do mesmo setor/data/turno |
| `ep_listar_escalas` | `p_inicio date,p_fim date,p_setor uuid=null` | Array; período máximo de 93 dias |
| `ep_definir_perfil` | `p_usuario uuid,p_nome text,p_papel text,p_setor uuid=null,p_ativo boolean=true` | void; usuário deve existir no Auth |
| `ep_listar_perfis` | `p_limite int=50,p_depois uuid=null` | Array; cursor no último user_id |
| `ep_configurar_operacao` | `p_privacidade_versao text,p_privacidade_texto text,p_habilitada boolean,p_retencao_dias int=90` | void |
| `ep_auditoria` | `p_antes bigint=null,p_limite int=100` | Array; cursor no menor id |

Escalas opcionais são definidas ao publicar:

```json
[
  {"chave":"recepcao","texto":"Como foi o acolhimento na recepção?","metrica":"rostos_5"},
  {"chave":"triagem","texto":"Como foi sua experiência na triagem?","metrica":"nota_10"}
]
```

`ep_painel` retorna `respostas`, `manifestacoes`, `por_metrica`, `tendencia`, `distribuicao`, `por_setor`, `por_turno`, `por_equipe`, `etapas`, `equipes_aviso`, `atualizado_em`, `inicio`, `fim`. Arrays não têm valores inventados quando faltam dados. `etapas` distingue pergunta, versão e escala. O período máximo é de 366 dias, inclusivo; o backend pode fazer polling autenticado para atualização do painel.

Atendimento aceita `em_atendimento` ou `encerrada`. Uma revisão obsoleta falha com SQLSTATE `40001`; recarregar antes de reenviar, sem retry cego. Encerramento exige relato e é terminal nesta versão.

## Operação confiável

- `ep_expurgar_contatos()` → quantidade de telefones removidos. Agendar diariamente.
- `ep_publicar_tv()` → quantidade de escalas com snapshot atualizado. Agendar a cada 15 minutos; pode retornar zero por intervalo/lote insuficiente.

Essas duas RPCs são exclusivas de `service_role`/proprietário. Primeiro administrador usa o script operacional, não uma RPC pública de bootstrap.

## Erros e limites

`42501`: acesso negado. `22023`: argumento/estado inválido. `23514`/`23502`/`23503`/`23505`: integridade. `40001`: conflito de revisão. `55000`: coleta desabilitada. `P0001`: cota de coleta. PostgREST define seu próprio mapeamento HTTP; a API Node deve traduzir mensagens/códigos para o usuário e não expor detalhes internos. Atualmente a cota usa `P0001`, que o backend deve mapear para HTTP 429.

Listas de manifestação/perfis: até 100; equipes: até 200; exportação: até 1000; auditoria: até 500. Todos os filtros são aplicados no banco. O backend deve impedir CSV formula injection ao gerar planilhas, limitar corpo/requisições e tempos de execução, observar logs e controlar tentativas de login. Esses controles de transporte não são implementados por migrations.
