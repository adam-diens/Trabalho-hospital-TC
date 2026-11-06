# Registro do processo e justificativas

## Etapas do desenvolvimento


1. **Análise:** foram revisados o enunciado, o projeto atual e as imagens do protótipo no Figma para identificar requisitos e pendências.
2. **Pesquisa simples:** uma pergunta obrigatória no início e etapas opcionais reduzem o esforço e permitem participar mesmo com pouco tempo. Celular e tablet oferecem alternativas de acesso.
3. **Privacidade:** anonimato como opção padrão e telefone opcional com consentimento permitem avaliar sem exigir identificação.
4. **Banco reconstruído:** scripts sobrepostos e falhas de integração e autorização motivaram a organização em migrations, com dados no schema `hospital` e permissões verificadas no banco.
5. **Escalas configuráveis:** o banco v2 permite escolher rostinhos 1–5 ou nota 1–10 por pergunta. Versões preservam respostas antigas e indicadores separados evitam misturar escalas diferentes.
6. **Equipes e indicadores:** a associação à escala é indicativa, sem atribuição de culpa individual. A divulgação pública usa dados agregados.
7. **Backend v2:** a API passou a validar entradas, sessões e perfis, enviar a pesquisa de forma atômica, atender a Ouvidoria e exportar com os mesmos filtros do painel. SSE atualiza indicadores, e um worker separado cuida da TV e do expurgo.
8. **Frontend integrado:** as páginas do Figma orientaram cores, navegação e composição, adaptadas às funções reais. Módulos separados organizam pesquisa, gestão e administração. Indicadores mantêm as escalas separadas; não são apresentados como NPS nem usam números demonstrativos em produção. A sessão fica na aba, o telefone respeita o perfil e os QR Codes dispensam serviços externos.
9. **Aprovação e hierarquia:** novas contas geram solicitações no banco, sem perfil ativo. Somente o Super Admin decide, com auditoria e proteção contra decisões simultâneas. A aprovação oferece funções abaixo de Super Admin, começando por Visualizador; o solicitante não escolhe nem recebe privilégios automaticamente. Metadados do Auth nunca definem autorização.
10. **Hospedagem:** Render mantém HTTP/SSE e manutenção em processos separados. Configuração de produção vem do provedor, com HTTPS, origem canônica e suporte ao proxy controlado; o worker recebe somente as credenciais necessárias. QR Codes acompanham a URL pública sem serviços de terceiros. Falhas da TV não interrompem o expurgo de contatos.
11. **Validação:** testes da API, banco e navegador verificam fluxos, permissões, aprovação/rejeição, produção, envio com repetição segura, conflitos de atendimento, contraste de hover e responsividade. Auth/gateway são simulados; homologação remota, acessibilidade com leitor de tela e carga de produção continuam pendentes.

## Personas

Perfis fictícios usados para orientar as decisões de interface e os fluxos; não representam entrevistas ou participantes identificados.

### Marisa, 58 — paciente/acompanhante

Está acompanhando um familiar, tem familiaridade básica com smartphone e usa WhatsApp e câmera. Quer avaliar o atendimento sem criar conta nem digitar muito. Dores: cansaço, pressa, receio de exposição. Canal preferido: QR Code no cartão/alta ou tablet assistido. Frase: “Se for rápido e eu puder responder sem me identificar, eu participo.”

### Luciana, 42 — Ouvidoria

Recebe manifestações, consolida planilhas e precisa encontrar padrões por setor/turno. Familiaridade alta com sistemas administrativos. Dores: baixa participação, respostas incompletas e retrabalho de transcrição. Canal: painel desktop. Frase: “Quero entender o que aconteceu e fechar o ciclo com quem precisa agir.”

## Jornada implementada

QR/link do setor → pesquisa rápida ou completa → aviso de privacidade publicado → nota geral obrigatória, com rostinhos 1–5 ou notas 1–10 conforme a versão. A rápida conclui a participação; a completa oferece etapas opcionais, conclusão antecipada e manifestação com contato opcional mediante consentimento. Toda a pesquisa é enviada de forma atômica ao concluir; uma participação abandonada não fica parcialmente gravada. Links usam ?setor=rx&modo=celular ou ?setor=rx&modo=tablet. Sem setor, a pessoa precisa selecioná-lo.

## Decisões visíveis

1. **Escalas configuráveis:** rostinhos 1–5 favorecem a leitura por toque; notas 1–10 atendem perguntas numéricas. Cada pergunta respeita sua configuração e os indicadores mantêm as escalas separadas. Nenhuma delas é apresentada como NPS.
2. **Nota até o limiar configurado como convite à Ouvidoria:** ponto de triagem operacional, não diagnóstico nem envio automático de denúncia. Toda nota pode conter comentário; usuário decide se quer retorno.
3. **Boa experiência:** perguntar também por elogio, agradecer de forma explícita e oferecer QR em pontos de saída sem pressionar nem premiar respostas positivas.
4. **Escala:** cruzar setor + data + turno com escala vigente e mostrar equipe provável apenas a perfis autorizados. Validar ausência/plantão e oferecer revisão humana; nunca inferir culpa individual.
5. **LGPD:** resposta anônima como padrão; telefone separado logicamente e restrito à Ouvidoria, prazo de retenção definido com o hospital, registro de finalidade e canal de atendimento ao titular.
6. **TV Wall:** contagens e médias agregadas; ocultar comentário, telefone, equipe e grupos com volume pequeno (mínimo de cinco respostas e janela publicada pelo worker). Não exibir nota instantânea que possa identificar paciente.
7. **Canal:** QR no celular como prioritário por implantação simples e sem compartilhamento de tela; tablet/totem como alternativa acessível para quem não possui smartphone. Disponibilizar apoio humano.

## Design system

Paleta baseada nas páginas fornecidas do Figma: verde petróleo nas ações e navegação, menta nas superfícies de apoio, fundo claro e texto escuro. Fontes do sistema dispensam fontes remotas. Cartões, barra lateral, formulários com prévia e TV seguem o protótipo, adaptados a celular e tablet. Rótulos, foco visível, texto junto aos ícones, movimento reduzido e tabelas dos gráficos apoiam a acessibilidade; leitor de tela exige homologação.

## Referências visuais e Figma

As imagens fornecidas em Downloads/Figma orientaram pesquisa, login, gestão, Ouvidoria, cadastros e TV. As telas foram adaptadas ao banco e à API reais: métricas sem NPS, ausência de indicadores fictícios, controles por perfil e QR Codes locais. Anotações de projeto das imagens não aparecem como conteúdo da aplicação.
