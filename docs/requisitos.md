
## Objetivo e contexto

Digitalizar a escuta após atendimento na Fundação Hospitalar Dr. Oswaldo Diesel (Três Coroas). O briefing informa aproximadamente 3 respostas a cada 500 atendimentos, papel incompleto, manifestações no verso e horas de transcrição. A API v2 cobre os fluxos do banco reestruturado; o frontend está integrado ao novo contrato, com homologação remota pendente.

## Atores

Paciente/acompanhante (sem conta); Ouvidoria (manifestações e contato); Gestão (indicadores); Admin de setor; Super Admin; Visualizador; TV Wall público/interno sem identificação individual. Auth e perfis existem no Supabase; painel do site exige login.

## Requisitos funcionais

| ID | Requisito | Prioridade | Estado |
|---|---|---|---|
| RF01 | Oferecer URL de pesquisa contextualizada por setor/QR | Alta | Setores pa, int, enfermagem, lab, rx e refeitorio; QR por setor |
| RF02 | Recolher uma avaliação geral obrigatória com escala configurável | Alta | API v2 valida nota 1–5 ou 1–10 conforme a versão; tela integrada à versão publicada |
| RF03 | Oferecer etapas opcionais específicas do setor, com escala por pergunta | Alta | API lê perguntas versionadas dos seis setores; rostinhos ou nota numérica por etapa |
| RF04 | Recolher elogio, reclamação ou sugestão opcional | Alta | Implementado |
| RF05 | Permitir anonimato ou telefone opcional para retorno | Alta | RPC separa contato e exige consentimento explícito |
| RF06 | Registrar setor, data e turno | Alta | RPC registra setor, horário e turno; escala existe |
| RF07 | Correlacionar resposta com escala de equipe, sem atribuição automática de culpa | Alta | Resumo agrega equipes apenas com N≥5 |
| RF08 | Disponibilizar indicadores com filtros hospital/setor/turno/período | Alta | API `/api/v2/painel` e SSE autenticados, com filtros de equipe e escalas separadas |
| RF09 | Exibir TV Wall sem dados pessoais | Média | API `/api/v2/tv` serve snapshots; worker publica sem dados individuais |
| RF10 | Exportar dados para Excel | Média | CSV/JSON na API v2, com todos os filtros, paginação e proteção contra fórmulas |
| RF11 | Controlar ações conforme perfil (5 perfis) | Alta | API e RPCs validam os cinco perfis; contas novas aguardam decisão exclusiva do Super Admin, que aprova uma função inferior ou rejeita; homologação Auth remota pendente |
| RF12 | Manter trilha de auditoria de ações administrativas | Média | Auditoria de leituras sensíveis, atendimentos, perfis, configurações e exportações; consulta restrita ao Super Admin |

## Requisitos não funcionais

- RNF01 Usabilidade: etapas curtas, alvos táteis grandes, redação simples e uma pergunta obrigatória.
- RNF02 Acessibilidade: contraste, navegação sem depender apenas de cor, rótulos acessíveis e responsividade; validar com leitor de tela e WCAG antes da implantação.
- RNF03 Segurança: HTTPS, autenticação de gestores, RBAC/RLS, validação de entrada, proteção de segredos e acesso mínimo.
- RNF04 Privacidade: minimizar dados, telefone opcional e acesso restrito, retenção definida com o controlador e transparência ao paciente.
- RNF05 Integridade: nota geral 1–5 ou 1–10 conforme configuração, setor válido, timestamps confiáveis e associação de escala com nível de confiança.
- RNF06 Disponibilidade/escala: API desacoplada, banco gerenciado e agregações indexadas; metas/SLO a definir com a Fundação.
- RNF07 Portabilidade: funcionar em navegadores móveis/tablets atuais; frontend e backend v2 integrados; testes locais em Edge.

## Critérios de aceite

1. Paciente envia resposta com somente a nota geral; demais campos podem ficar vazios.
2. Avaliações até o limiar configurado recebem convite acolhedor para manifestação/retorno, sem bloquear resposta anônima.
3. Painel atualiza indicadores após uma resposta no mesmo navegador.
4. TV Wall não renderiza mensagem, telefone, identificador da resposta ou escala individual.
5. Exportação abre como CSV no Excel; contatos não são incluídos na exportação.
6. Nenhuma associação a profissional é apresentada como fato sem validação humana.

## Rastreabilidade resumida

Briefing → RF02 (baixa fricção), RF03 (jornada), RF04–05 (manifestações), RF06–07 (setor/turno/equipe), RF08–09 (dashboard/TV), RF10 (Excel), RF11–12 (papéis/auditoria). Referências visuais anexadas: fluxo de pesquisa, componentes de design, painel/Ouvidoria/TV Wall e esquema Supabase.
