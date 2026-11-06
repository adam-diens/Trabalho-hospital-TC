# Manual de uso

> Este manual descreve o site anterior. O banco v2 está em reconstrução independente; use [a documentação do banco](modelo-de-dados-e-requisitos.md) para instalação. A API e o manual do usuário serão adaptados ao remodelar o site.

## Iniciar a aplicação

Configure `SUPABASE_URL` e `SUPABASE_PUBLISHABLE_KEY` no `.env` a partir de `.env.example` e execute `node backend/server.cjs`. Abra `http://127.0.0.1:5173`. O frontend conversa com o backend local em `/api`; o Supabase mantém autenticação e persistência.

## Responder no celular ou tablet

1. Escolha o setor na tela inicial ou abra seu link/QR: pa (Pronto Atendimento), int (Internacao), enfermagem, lab (Laboratorio), rx (Raio-X) ou refeitorio.
2. Escolha **Estou com pouco tempo** ou **Posso contar mais**, toque em **Começar pesquisa** e responda à pergunta geral com um dos cinco rostos, apresentados do melhor para o pior. Esta é a única resposta obrigatória; na pesquisa rápida ela já conclui a participação.
3. Na pesquisa completa, responda, se desejar, até cinco perguntas específicas do setor usando números de 1 a 10. Cada pergunta pode ser pulada, e **Concluir agora** encerra a participação sem percorrer todas as etapas.
4. Opcionalmente, deixe elogio, reclamação ou sugestão, ou solicite retorno da Ouvidoria. O telefone só é enviado com seu consentimento explícito.

Para um tablet fixo no setor, use, por exemplo, `?setor=pa&modo=tablet`. Esse link prioriza a pesquisa rápida e reinicia após oito segundos no agradecimento. O QR do celular usa `?setor=pa&modo=celular` e prioriza a pesquisa completa. A escolha da jornada continua disponível em ambos. O menu mantém o TV Wall e o acesso da equipe. Erros no envio do contato indicam o que faltou e preservam os campos; o telefone recebe máscara com DDD.

## Administrador de setor

1. Abra **Menu** → **Acesso da equipe** → **Cadastre-se** e informe nome, e-mail institucional e senha.
2. Confirme o e-mail, se solicitado. Envie ao superadministrador o mesmo e-mail usado no cadastro.
3. Aguarde a liberação do perfil e do setor; o cadastro por si só não libera dados nem ferramentas administrativas.
4. Entre com e-mail e senha. No painel, edite e salve a pergunta do seu setor. O banco impede alterações em outros setores.

## Superadministrador

1. Entre com uma conta que possua perfil `super_admin`.
2. Oriente a pessoa a criar a conta pela tela de login. Depois que a conta existir no Supabase Auth (e o e-mail estiver confirmado, quando a confirmação estiver habilitada), informe o e-mail e nome cadastrados, selecione **Administrador de setor** e escolha o setor. Para promover outra pessoa a superadministrador, escolha esse perfil.
3. A pessoa acessa o sistema com a própria conta. O administrador de setor só vê a configuração do setor atribuído.
4. O superadministrador também pode selecionar qualquer setor e editar sua pergunta.

O superadministrador libera contas registradas e concede perfis. A criação de conta usa a rota de cadastro do Auth por meio da API do projeto; chaves administrativas não são usadas no frontend.

## Administração e banco

No Supabase conectado, a regra de uma pergunta ativa por setor mantém perguntas anteriores inativas. O arquivo da migration correspondente não está nesta cópia do repositório; compare o esquema remoto antes de reaplicar scripts.


## Limite de respostas

Para reduzir spam, cada dispositivo pode enviar ate 15 respostas por QR ou 100 respostas em modo tablet a cada 10 minutos. Para demonstracoes no tablet, use o link do setor com `modo=tablet`. O limite agregado por setor e 1000 respostas no mesmo periodo.
