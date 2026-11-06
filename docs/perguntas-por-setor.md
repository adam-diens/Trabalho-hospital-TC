# Cadastrar setores, perguntas, equipes e escalas

## Setor

O Super Admin abre **Cadastro → Setores**, informa nome, identificador do link e estado ativo. O identificador usa letras minúsculas, números, hífen ou sublinhado e permanece igual ao editar. Desativar preserva o histórico.

Os setores iniciais são Pronto Atendimento (`pa`), Internação (`int`), Enfermagem (`enfermagem`), Laboratório (`lab`), Raio-X (`rx`) e Refeitório (`refeitorio`). Novos setores precisam de questionário publicado para receber respostas.

## Publicar perguntas

1. Abra **Cadastro → Perguntas** e selecione o setor autorizado.
2. Preencha a pergunta geral e escolha **Rostinhos de 1 a 5** ou **Notas de 1 a 10**.
3. Defina o limiar do convite à Ouvidoria, inferior ao valor máximo da escala.
4. Adicione até 20 etapas opcionais. Cada etapa tem texto, escala e identificador único; `geral` é reservado.
5. Confira a prévia e clique em **Publicar nova versão**.

A pergunta geral é a única obrigatória. As etapas podem ter escalas diferentes. O limiar apenas orienta o convite: participantes com qualquer nota podem deixar uma manifestação.

Uma publicação cria outra versão e preserva o histórico das respostas anteriores. Rostinhos e notas numéricas não são tratados como NPS. Admin de Setor só publica no próprio setor; Super Admin pode selecionar qualquer setor ativo.

## Equipes e escalas

1. Em **Cadastro → Equipes e escalas**, escolha o setor e o mês.
2. Cadastre o nome da equipe e marque se está ativa. Selecionar uma equipe existente permite alterar seu estado; mudar o nome cadastra outra equipe.
3. Informe data, turno e equipe ativa e clique em **Salvar escala**.
4. Para corrigir uma atribuição, selecione **Editar** na linha correspondente e salve.

Há uma equipe por setor, data e turno; salvar outra substitui a atribuição daquele período. A associação das avaliações usa o horário de envio em São Paulo e serve como contexto, sem atribuir responsabilidade individual.

Para habilitar a coleta, o Super Admin também precisa configurar o aviso em **Cadastro → Configurações**. Consulte o [manual](manual-do-usuario.md).
