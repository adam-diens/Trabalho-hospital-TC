# Manual de uso

## Iniciar a aplicação

Configure `SUPABASE_URL` e `SUPABASE_PUBLISHABLE_KEY` no `.env` a partir de `.env.example` e execute `node backend/server.cjs`. Abra `http://127.0.0.1:5173`. O frontend conversa com o backend local em `/api`; o Supabase mantém autenticação e persistência.

## Responder no celular ou tablet

1. Escolha o setor na tela inicial ou abra seu link/QR: pa (Pronto Atendimento), int (Internacao), enfermagem, lab (Laboratorio), rx (Raio-X) ou refeitorio.
2. Toque em **Começar** e responda à pergunta geral configurada para o setor com uma nota de 1 a 5. Esta é a única resposta obrigatória.
3. Responda, se desejar, ate cinco perguntas especificas do setor usando os rostinhos de 1 a 5. Cada pergunta pode ser pulada. Consulte a lista de perguntas por setor.
4. Opcionalmente, deixe elogio, reclamação ou sugestão, ou solicite retorno da Ouvidoria. O telefone só é enviado com seu consentimento explícito.

Para um tablet fixo no setor, use, por exemplo, `?setor=pa&modo=tablet`. O modo tablet esconde a navegação e amplia os botões.

## Administrador de setor

1. Abra **Gestão** → **Entrar no painel** → **Cadastre-se** e informe nome, e-mail institucional e senha.
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