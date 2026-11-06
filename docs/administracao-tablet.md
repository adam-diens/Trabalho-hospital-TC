# Configurar tablet, QR Codes e TV

## QR Codes e tablet

1. Entre com uma conta autorizada e abra **QR Codes**.
2. Selecione o código de celular ou tablet do setor. Copie o link, baixe o SVG ou imprima.
3. Confira o endereço antes de distribuir: ele usa a URL pública da hospedagem ou `PUBLIC_ORIGIN`.
4. No tablet, abra o link com `?setor=pa&modo=tablet`, substituindo `pa` pelo identificador do setor.

Tablet inicia na pesquisa rápida e celular na completa; o participante pode trocar. Ambas usam as perguntas e escalas publicadas. Após o agradecimento, o tablet reinicia em oito segundos, com opção de pausar o reinício. Não mantenha conta da equipe aberta no dispositivo público.

## TV Wall

Abra **TV Wall** no navegador da tela. A página consulta o resultado publicado a cada minuto. Para publicar automaticamente, mantenha o worker em execução:

```powershell
npm.cmd run jobs
```

O worker tenta publicar ao iniciar e a cada 15 minutos. A publicação considera os últimos 30 dias, somando os setores, e exige ao menos cinco respostas na mesma escala da pergunta geral. Rostinhos e notas numéricas são grupos separados. Depois da primeira publicação, são necessárias cinco novas respostas na escala e intervalo mínimo de 15 minutos. Publicações com mais de 24 horas deixam de aparecer.

Para tentar uma publicação manual:

```powershell
npm.cmd run jobs:once -- tv
```

`{"tv":0}` significa que nenhum grupo novo foi publicado; `{"tv":1}` indica uma escala publicada. A TV não exibe comentários, contatos ou avaliações individuais. Na hospedagem, o serviço de worker substitui o terminal local.

## Quando não aparece nada

- **Pesquisa indisponível:** confira aviso e habilitação da coleta em **Cadastro → Configurações** e o questionário publicado do setor.
- **TV vazia:** confira quantidade por escala, janela de publicação e execução do worker.
- **QR abre endereço errado:** ajuste a origem no serviço web e gere os códigos novamente; códigos já impressos não mudam.

Consulte [hospedagem](seguranca-e-nuvem.md) e [perguntas por setor](perguntas-por-setor.md).
