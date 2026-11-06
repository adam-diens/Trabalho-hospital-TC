# Modelo de dados e requisitos — v2

A instalação está no [README principal](../README.md#instalar-o-banco-no-supabase). O banco v2 ainda não foi aplicado ao Supabase nem integrado ao site.

Todos os dados do domínio ficam em **`hospital`**. `public` contém apenas as RPCs `ep_*`; nenhuma tabela do domínio. `auth`, `storage`, `realtime`, `extensions` e outros schemas gerenciados pelo Supabase são infraestrutura, não fragmentação do modelo. Não os exclua. Não exponha `hospital` na Data API.

## Modelo

| Tabela | Responsabilidade |
|---|---|
| `setores` | Seis setores iniciais; desativação sem apagar histórico |
| `perfis` | Conta Auth, um dos cinco papéis, setor obrigatório apenas para admin de setor |
| `questionarios` | Versões por setor; uma publicação vigente |
| `perguntas` | Uma geral obrigatória e até 20 etapas opcionais; escala individual |
| `respostas` | Nota geral, escala, versão, canal e data/turno calculados no servidor |
| `avaliacoes_etapas` | Notas opcionais normalizadas com FKs para a versão e pergunta corretas |
| `manifestacoes` | Elogio, reclamação, sugestão ou solicitação de retorno; protocolo mesmo no anonimato |
| `contatos` | Telefone opcional, consentimento e expurgo, separados do comentário |
| `interacoes` | Histórico imutável de atendimento da Ouvidoria |
| `equipes`, `escalas` | Uma equipe operacional por setor/data/turno; impede duplicação em indicadores |
| `avisos_privacidade`, `configuracao` | Avisos versionados, habilitação da coleta e parâmetros operacionais |
| `auditoria` | Leituras sensíveis, exportações e ações administrativas; sem telefone ou texto de relato |
| `limites_coleta` | Contadores atômicos por janela fixa de 10 minutos; limpeza após um dia |
| `tv_publicacoes` | Snapshots agregados seguros para a TV pública |

### Regras de produto

- Cada pergunta pode usar **`rostos_5` (1–5)** ou **`nota_10` (1–10)**. Nenhuma dessas escalas é NPS. Não há conversão artificial entre elas.
- O formulário de cada setor tem exatamente uma geral obrigatória. Etapas, manifestação e telefone são opcionais.
- Publicar alterações cria outra versão. Respostas anteriores preservam pergunta, escala e versão; perguntas e respostas não são editáveis.
- O limiar de convite à Ouvidoria é definido por versão. Só orienta a interface; não bloqueia manifestação de nenhuma nota nem abre chamado sem escolha do paciente.
- `ep_enviar_pesquisa` grava tudo em uma transação. Um telefone com consentimento pode abrir solicitação de retorno sem tornar o comentário obrigatório.
- Etapas só aceitam inteiros dentro da escala e perguntas pertencentes à versão respondida.
- Chave de envio UUID identifica uma submissão lógica. Retry com mesmo conteúdo devolve o mesmo resultado; reutilização com conteúdo diferente falha. Dois envios com chaves diferentes são respostas distintas.
- O turno é o **horário de envio** em São Paulo: manhã 07h–12h59; tarde 13h–18h59; noite 19h–06h59. Não é prova do horário do atendimento. Associação à escala é indicativa e acompanha correções da escala vigente.
- Médias, distribuição, tendência e satisfação ficam separadas por escala. Satisfação usa notas >=4 em 1–5 e >=8 em 1–10; não é NPS. Equipes só aparecem com pelo menos cinco respostas por escala.
- A TV pública usa snapshots. Publicar exige pelo menos cinco novas respostas na escala e intervalo mínimo de 15 minutos. Snapshots expiram em 24h; não há comentário, equipe, contato ou resposta individual. O painel institucional consulta os dados atuais. Essa política de TV evita mostrar cada nota individual imediatamente.
- Exportação aplica os mesmos filtros de setor, período, turno e equipe, com cursor UUID. Não contém comentário, telefone nem relatos. Para exportar com estabilidade durante coleta, o backend deve fixar o período em dias encerrados ou implementar um job de snapshot; páginas do dia corrente não são uma transação única.
- Retenção de telefone começa no consentimento, inclusive em chamados abertos. Padrão técnico: 90 dias, configurável. O hospital deve aprovar o prazo. **Comentários e relatos também podem conter dados pessoais: o expurgo de telefone não anonimiza esses textos.**

## Matriz de acesso

Todos os papéis abaixo exigem perfil ativo; cadastro no Auth sozinho não concede acesso. Admin de setor só opera seu setor ativo e é rejeitado ao solicitar outro setor.

| Operação | Público | Super Admin | Admin setor | Gestão | Ouvidoria | Visualizador | Backend operacional |
|---|---|---|---|---|---|---|---|
| Setores/formulário/TV | Sim | Sim | Sim | Sim | Sim | Sim | — |
| Enviar pesquisa | — | — | — | — | — | — | `service_role` |
| Indicadores | — | Sim | Seu setor | Sim | Sim | Sem equipes | — |
| Manifestações/comentários | — | Sim | Seu setor | Sim | Sim | — | — |
| Telefone e histórico interno | — | Sim | — | — | Sim | — | — |
| Atender/encerrar | — | Sim | — | — | Sim | — | — |
| Exportar respostas analíticas | — | Sim | Seu setor | Sim | — | — | — |
| Publicar questionário/equipes/escala | — | Sim | Seu setor | — | — | — | — |
| Setores, perfis, configuração, auditoria | — | Sim | — | — | — | — | — |
| Expurgar contato/publicar TV | — | — | — | — | — | — | `service_role` ou proprietário |

RLS em todas as tabelas, sem policies/grants para acesso direto. RPCs verificam perfil no próprio banco. `SECURITY DEFINER` tem `search_path=''` e referências qualificadas. Helpers não são executáveis por clientes; RPCs têm grants explícitos. A chave `service_role` é um segredo poderoso do Supabase: usar somente no servidor, não em `.js` público, celular ou tablet.
