# Segurança e hospedagem

O frontend acessa somente a API própria. Credenciais do Supabase ficam no servidor; respostas, contatos e permissões são controlados pelas RPCs do banco v2. O schema hospital mantém RLS e não deve ser exposto no PostgREST. As funções usam search_path fixo e grants explícitos. A criação da conta não concede perfil; o Super Admin decide as solicitações.

A configuração de hospedagem está no [README](../README.md#hospedar-no-render), no [render.yaml](../render.yaml) e no [.env.production.example](../.env.production.example). O .env local fica ignorado pelo Git e não é lido em produção: as variáveis vêm do provedor. Site e API usam a mesma origem HTTPS, CSP restritiva, headers de segurança e autorização por requisição. QR Codes usam a origem configurada ou a URL externa do Render, nunca o Host do cliente.

No Render há um web service e um worker. O worker recebe apenas URL e chave operacional, publica a TV em grupos e remove contatos vencidos. Os limites HTTP ficam em memória por instância; a cota de coleta é compartilhada no PostgreSQL. O proxy deve fornecer uma cadeia X-Forwarded-For controlada: a configuração preparada considera um hop, com leitura pela direita. Validar esse ingresso na hospedagem antes do uso; um proxy adicional exige rever a confiança. IP é convertido em HMAC, sem registro do IP bruto nos logs da aplicação.

Os logs registram identificador de requisição, rota, status e duração, sem corpo, senha, telefone ou tokens. Segredos, migrations, código do backend, testes e configuração de deploy não são servidos ao navegador. HTTPS é terminado no ingresso do provedor; o Node atende pela porta interna.

Antes do uso com dados reais, homologar permissões com contas dos cinco perfis, SMTP/recuperação de senha, duas origens de rede, limites/carga, manutenção, backups e restauração. A instituição deve aprovar o aviso, finalidade e retenção. Os testes locais não substituem essa homologação. Não foram inspecionados nem alterados serviços remotos nesta preparação.
