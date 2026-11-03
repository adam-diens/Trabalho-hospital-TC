
## Objetivo e contexto

Digitalizar a escuta após atendimento na Fundação Hospitalar Dr. Oswaldo Diesel (Três Coroas). O briefing informa aproximadamente 3 respostas a cada 500 atendimentos, papel incompleto, manifestações no verso e horas de transcrição. O protótipo cobre a jornada do paciente e uma visão inicial de gestão.

## Atores

Paciente/acompanhante (sem conta); Ouvidoria (manifestações e contato); Gestão (indicadores); Admin de setor; Super Admin; Visualizador; TV Wall público/interno sem identificação individual. Auth e perfis existem no Supabase; painel do site exige login.

## Requisitos funcionais

| ID | Requisito | Prioridade | Estado |
|---|---|---|---|
| RF01 | Oferecer URL de pesquisa contextualizada por setor/QR | Alta | Setores pa, int, enfermagem, lab, rx e refeitorio; QR por setor |
| RF02 | Recolher uma avaliação geral obrigatória de 1 a 5 por rostinhos | Alta | Implementado no frontend |
| RF03 | Oferecer cinco avaliacoes opcionais com rostinhos especificas para cada setor | Alta | Implementado para os seis setores |
| RF04 | Recolher elogio, reclamação ou sugestão opcional | Alta | Implementado |
| RF05 | Permitir anonimato ou telefone opcional para retorno | Alta | RPC separa contato e exige consentimento explícito |
| RF06 | Registrar setor, data e turno | Alta | RPC registra setor, horário e turno; escala existe |
| RF07 | Correlacionar resposta com escala de equipe, sem atribuição automática de culpa | Alta | Resumo agrega equipes apenas com N≥5 |
| RF08 | Disponibilizar indicadores com filtros hospital/setor/turno/período | Alta | Implementado via `painel_resumo` autenticado |
| RF09 | Exibir TV Wall sem dados pessoais | Média | Implementado via agregados `tv_resumo` |
| RF10 | Exportar dados para Excel | Média | CSV via `exportar_respostas`; requer perfil autorizado |
| RF11 | Controlar ações conforme perfil (5 perfis) | Alta | Auth + RPCs com papéis no projeto; requer teste de cada perfil |
| RF12 | Manter trilha de auditoria de ações administrativas | Média | Tabela e registro de leituras pela Ouvidoria existentes |

## Requisitos não funcionais

- RNF01 Usabilidade: etapas curtas, alvos táteis grandes, redação simples e uma pergunta obrigatória.
- RNF02 Acessibilidade: contraste, navegação sem depender apenas de cor, rótulos acessíveis e responsividade; validar com leitor de tela e WCAG antes da implantação.
- RNF03 Segurança: HTTPS, autenticação de gestores, RBAC/RLS, validação de entrada, proteção de segredos e acesso mínimo.
- RNF04 Privacidade: minimizar dados, telefone opcional e acesso restrito, retenção definida com o controlador e transparência ao paciente.
- RNF05 Integridade: nota geral 1–5, setor válido, timestamps confiáveis e associação de escala com nível de confiança.
- RNF06 Disponibilidade/escala: API desacoplada, banco gerenciado e agregações indexadas; metas/SLO a definir com a Fundação.
- RNF07 Portabilidade: funcionar em navegadores móveis/tablets atuais; sincronização exige backend ainda ausente.

## Critérios de aceite

1. Paciente envia resposta com somente a nota geral; demais campos podem ficar vazios.
2. Avaliações 1–2 recebem convite acolhedor para manifestação/retorno, sem bloquear resposta anônima.
3. Painel atualiza indicadores após uma resposta no mesmo navegador.
4. TV Wall não renderiza mensagem, telefone, identificador da resposta ou escala individual.
5. Exportação abre como CSV no Excel; exportação contendo contato deve ser exclusiva de Ouvidoria no sistema real.
6. Nenhuma associação a profissional é apresentada como fato sem validação humana.

## Rastreabilidade resumida

Briefing → RF02 (baixa fricção), RF03 (jornada), RF04–05 (manifestações), RF06–07 (setor/turno/equipe), RF08–09 (dashboard/TV), RF10 (Excel), RF11–12 (papéis/auditoria). Referências visuais anexadas: fluxo de pesquisa, componentes de design, painel/Ouvidoria/TV Wall e esquema Supabase.
