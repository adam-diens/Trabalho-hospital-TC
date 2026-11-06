# UX, personas e decisões de produto

## Personas

### Marisa, 58 — paciente/acompanhante

Está acompanhando um familiar, tem familiaridade básica com smartphone e usa WhatsApp e câmera. Quer avaliar o atendimento sem criar conta nem digitar muito. Dores: cansaço, pressa, receio de exposição. Canal preferido: QR Code no cartão/alta ou tablet assistido. Frase: “Se for rápido e eu puder responder sem me identificar, eu participo.”

### Luciana, 42 — Ouvidoria

Recebe manifestações, consolida planilhas e precisa encontrar padrões por setor/turno. Familiaridade alta com sistemas administrativos. Dores: baixa participação, respostas incompletas e retrabalho de transcrição. Canal: painel desktop. Frase: “Quero entender o que aconteceu e fechar o ciclo com quem precisa agir.”

## Jornada implementada

QR/link do setor → escolha entre pesquisa rápida e completa → nota geral 1–5 obrigatória (rostos do melhor para o pior). A rápida vai ao agradecimento. A completa oferece etapas opcionais com notas de 1 a 10, conclusão antecipada e manifestação (ênfase de acolhimento para notas 1–2), com contato opcional mediante consentimento. Links usam, por exemplo, `?setor=rx&modo=celular` ou `?setor=rx&modo=tablet`; sem setor, a pessoa precisa selecioná-lo. A interface mantém pesquisa e gestão disponíveis em qualquer dispositivo, respeitando as permissões.

## Decisões visíveis

1. **Rostinhos 1–5 no começo:** leitura imediata e interação por toque, adequada a tablet e a pessoas cansadas. NPS fica para estudo posterior; não misturar métricas incompatíveis.
2. **Nota 1–2 como convite à Ouvidoria:** ponto de triagem operacional, não diagnóstico nem envio automático de denúncia. Toda nota pode conter comentário; usuário decide se quer retorno.
3. **Boa experiência:** perguntar também por elogio, agradecer de forma explícita e oferecer QR em pontos de saída sem pressionar nem premiar respostas positivas.
4. **Escala:** cruzar setor + data + turno com escala vigente e mostrar equipe provável apenas a perfis autorizados. Validar ausência/plantão e oferecer revisão humana; nunca inferir culpa individual.
5. **LGPD:** resposta anônima como padrão; telefone separado logicamente e restrito à Ouvidoria, prazo de retenção definido com o hospital, registro de finalidade e canal de atendimento ao titular.
6. **TV Wall:** contagens e médias agregadas; ocultar comentário, telefone, equipe e grupos com volume pequeno (limiar a definir com encarregado). Não exibir nota instantânea que possa identificar paciente.
7. **Canal:** QR no celular como prioritário por implantação simples e sem compartilhamento de tela; tablet/totem como alternativa acessível para quem não possui smartphone. Disponibilizar apoio humano.

## Design system

Paleta institucional: vermelho FHDOD para ação principal, verde petróleo para cuidado/indicadores, menta para superfícies de apoio, fundo claro e texto escuro. Tipografia Manrope em títulos e DM Sans em interface. Botões com altura mínima de 48 px, cartões com bordas suaves, progressão curta, estados de foco/seleção, ícones complementados por texto e layout responsivo. A aplicação carrega fontes do Google Fonts quando há internet; usa fontes do sistema como fallback.

## Referências visuais e Figma

Referência fornecida: [Trabalho Hospital no Figma](https://www.figma.com/design/xnlPTPfmS2bqv6VDbI4rAo/Trabalho-Hospital?node-id=16-2). O link não pôde ser consultado pela ferramenta nesta revisão; a comparação visual com os frames permanece pendente. A implementação preserva a marca, as cores e a estrutura existentes, com ajustes para celular, tablet e computador.
