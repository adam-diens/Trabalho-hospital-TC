# UX, personas e decisões de produto

## Personas

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
