const v = require('./validation.cjs');
const roles = ['super_admin', 'admin_setor', 'gestao', 'ouvidoria', 'visualizador'];
const managers = ['super_admin', 'admin_setor'];
const observers = ['super_admin', 'admin_setor', 'gestao', 'ouvidoria'];
const exporters = ['super_admin', 'admin_setor', 'gestao'];
const metrics = v.enumeration(['rostos_5', 'nota_10']);
const shift = v.enumeration(['manha', 'tarde', 'noite']);
const empty = v.object({});
const slug = v.string(2, 40, { pattern: '^[a-z][a-z0-9_-]{1,39}$' });
const email = v.string(3, 254, { pattern: '^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$' });
const password = v.string(12, 128);
const filters = { inicio: v.date, fim: v.date, setor: v.uuid, turno: shift, equipe: v.uuid };
const period = v.object(filters, ['inicio', 'fim']);
const stage = v.object({ chave: v.string(1, 50, { pattern: '^[a-z][a-z0-9_]{0,49}$' }), texto: v.string(8, 300), metrica: metrics }, ['chave', 'texto', 'metrica']);
const definitions = [];
function add(method, path, summary, options = {}) {
  definitions.push({ method, path: '/api/v2' + path, summary, query: empty, ...options });
}
function rpc(method, path, summary, name, fields, access, body, query = empty, options = {}) {
  add(method, path, summary, { rpc: name, fields, access, body, query, ...options });
}
add('GET', '/setores', 'Listar setores ativos', { rpc: 'ep_setores' });
add('GET', '/setores/:slug/formulario', 'Consultar formulário e aviso de privacidade publicados', { action: 'formulario' });
add('GET', '/tv', 'Consultar indicadores públicos agregados', { rpc: 'ep_tv' });
add('POST', '/pesquisas', 'Enviar pesquisa completa em uma transação', {
  action: 'pesquisa', body: v.object({
    chave_envio: v.uuid, questionario_id: v.uuid, nota: v.integer(1, 10), canal: v.enumeration(['celular', 'tablet']),
    privacidade_versao: v.string(1, 80),
    etapas: v.object({}, [], { additionalProperties: v.integer(1, 10), maxProperties: 20, propertyNames: { pattern: '^[a-z][a-z0-9_]{0,49}$' } }),
    tipo: v.nullable(v.enumeration(['elogio', 'reclamacao', 'sugestao'])), comentario: v.nullable(v.string(1, 2000)),
    telefone: v.nullable(v.string(10, 25, { pattern: '^[0-9()+ .-]+$' })), consentimento: v.boolean,
  }, ['chave_envio', 'questionario_id', 'nota', 'canal', 'privacidade_versao']),
});
add('POST', '/auth/entrar', 'Autenticar conta institucional', { action: 'signin', body: v.object({ email, senha: v.string(1, 128) }, ['email', 'senha']) });
add('POST', '/auth/renovar', 'Renovar sessão', { action: 'refresh', body: v.object({ refresh_token: v.string(1, 4096) }, ['refresh_token']) });
add('POST', '/auth/cadastrar', 'Solicitar cadastro, sem conceder perfil', { action: 'signup', body: v.object({ email, senha: password, nome: v.string(2, 120) }, ['email', 'senha', 'nome']) });
add('POST', '/auth/recuperar-senha', 'Solicitar recuperação de senha sem revelar contas', { action: 'recover', body: v.object({ email }, ['email']) });
add('POST', '/auth/sair', 'Encerrar a sessão atual', { action: 'logout', authenticated: true, body: empty });
add('PUT', '/auth/senha', 'Alterar senha usando sessão válida ou sessão de recuperação', { action: 'password', authenticated: true, body: v.object({ senha: password, nonce: v.string(1, 256) }, ['senha']) });
add('GET', '/me', 'Consultar perfil ativo da própria conta', { action: 'me', access: roles });
rpc('GET', '/admin/setores', 'Listar também setores inativos para administração', 'ep_listar_setores', {}, ['super_admin']);
rpc('GET', '/configuracao', 'Consultar configuração e aviso vigentes', 'ep_configuracao', {}, ['super_admin']);
rpc('GET', '/questionarios', 'Consultar versão de questionário mesmo com coleta desabilitada', 'ep_questionario',
  { setor: 'p_setor', versao: 'p_versao' }, managers, undefined, v.object({ setor: v.uuid, versao: v.integer(1, 2147483647) }, ['setor']));
rpc('GET', '/painel', 'Consultar indicadores por período, setor, turno e equipe', 'ep_painel',
  { inicio: 'p_inicio', fim: 'p_fim', setor: 'p_setor', turno: 'p_turno', equipe: 'p_equipe' }, roles, undefined, period);
add('GET', '/painel/stream', 'Receber indicadores atualizados por SSE', { action: 'stream', access: roles, query: period });
rpc('GET', '/manifestacoes', 'Listar manifestações com paginação por protocolo', 'ep_listar_manifestacoes',
  { setor: 'p_setor', situacao: 'p_situacao', limite: 'p_limite', antes: 'p_antes' }, observers, undefined,
  v.object({ setor: v.uuid, situacao: v.enumeration(['aberta', 'em_atendimento', 'encerrada']), limite: v.integer(1, 100), antes: v.integer(1, Number.MAX_SAFE_INTEGER) }));
add('GET', '/manifestacoes/:id', 'Consultar manifestação; contato somente para Ouvidoria e Super Admin', { action: 'manifestacao', access: observers });
add('POST', '/manifestacoes/:id/atendimentos', 'Registrar atendimento ou encerrar manifestação com controle de revisão', {
  action: 'atender', access: ['super_admin', 'ouvidoria'], body: v.object({ revisao: v.integer(1, 2147483647), situacao: v.enumeration(['em_atendimento', 'encerrada']), relato: v.string(3, 4000) }, ['revisao', 'situacao', 'relato']),
});
const exportQuery = v.object({ ...filters, limite: v.integer(1, 1000), depois: v.uuid }, ['inicio', 'fim']);
const exportFields = { inicio: 'p_inicio', fim: 'p_fim', setor: 'p_setor', turno: 'p_turno', equipe: 'p_equipe', limite: 'p_limite', depois: 'p_depois' };
rpc('GET', '/exportacoes', 'Exportar página analítica sem contato nem texto livre', 'ep_exportar', exportFields, exporters, undefined, exportQuery);
add('GET', '/exportacoes.csv', 'Baixar CSV compatível com Excel com todos os filtros', { action: 'csv', access: exporters, query: period });
add('GET', '/qrcodes', 'Obter links por setor e dispositivo para geração de QR Codes', { action: 'qrcodes', access: roles });
add('GET', '/qrcodes/:slug/:canal', 'Gerar QR Code SVG no próprio servidor', { action: 'qr-svg', access: roles });
rpc('PUT', '/setores', 'Cadastrar setor ou atualizar nome e estado pelo slug', 'ep_salvar_setor',
  { slug: 'p_slug', nome: 'p_nome', ativo: 'p_ativo' }, ['super_admin'], v.object({ slug, nome: v.string(2, 120), ativo: v.boolean }, ['slug', 'nome']));
rpc('POST', '/questionarios', 'Publicar nova versão com escalas por pergunta', 'ep_publicar_questionario',
  { setor: 'p_setor', metrica: 'p_metrica', limite_ouvidoria: 'p_limite', pergunta_geral: 'p_pergunta_geral', etapas: 'p_etapas' }, managers,
  v.object({ setor: v.uuid, metrica: metrics, limite_ouvidoria: v.integer(1, 9), pergunta_geral: v.string(8, 300), etapas: { type: 'array', items: stage, maxItems: 20 } }, ['setor', 'metrica', 'limite_ouvidoria', 'pergunta_geral']));
rpc('GET', '/equipes', 'Listar equipes permitidas', 'ep_listar_equipes', { setor: 'p_setor', limite: 'p_limite', depois: 'p_depois' }, observers, undefined,
  v.object({ setor: v.uuid, limite: v.integer(1, 200), depois: v.uuid }));
rpc('PUT', '/equipes', 'Cadastrar equipe ou atualizar estado pelo nome e setor', 'ep_salvar_equipe',
  { setor: 'p_setor', nome: 'p_nome', ativa: 'p_ativa' }, managers, v.object({ setor: v.uuid, nome: v.string(2, 120), ativa: v.boolean }, ['setor', 'nome']));
rpc('GET', '/escalas', 'Consultar escala por setor e intervalo de até 93 dias', 'ep_listar_escalas',
  { inicio: 'p_inicio', fim: 'p_fim', setor: 'p_setor' }, observers, undefined, v.object({ inicio: v.date, fim: v.date, setor: v.uuid }, ['inicio', 'fim']));
rpc('PUT', '/escalas', 'Definir equipe do setor, data e turno', 'ep_salvar_escala',
  { setor: 'p_setor', equipe: 'p_equipe', data: 'p_data', turno: 'p_turno' }, managers,
  v.object({ setor: v.uuid, equipe: v.uuid, data: v.date, turno: shift }, ['setor', 'equipe', 'data', 'turno']));
rpc('GET', '/perfis', 'Listar perfis institucionais', 'ep_listar_perfis', { limite: 'p_limite', depois: 'p_depois' }, ['super_admin'], undefined,
  v.object({ limite: v.integer(1, 100), depois: v.uuid }));
rpc('GET', '/solicitacoes', 'Consultar solicitações de acesso, somente Super Admin', 'ep_listar_solicitacoes',
  { situacao: 'p_situacao', limite: 'p_limite', depois: 'p_depois' }, ['super_admin'], undefined,
  v.object({ situacao: v.enumeration(['pendente','aprovada','rejeitada']), limite: v.integer(1,100), depois: v.uuid }));
rpc('PUT', '/solicitacoes', 'Aprovar com perfil inferior ou rejeitar solicitação', 'ep_decidir_solicitacao',
  { usuario:'p_usuario', decisao:'p_decisao', papel:'p_papel', setor:'p_setor', motivo:'p_motivo' }, ['super_admin'],
  v.object({ usuario:v.uuid, decisao:v.enumeration(['aprovar','rejeitar']), papel:v.enumeration(roles.filter(r=>r!=='super_admin')),
    setor:v.nullable(v.uuid), motivo:v.string(3,500) }, ['usuario','decisao']));
rpc('PUT', '/perfis', 'Conceder ou revogar um dos cinco perfis', 'ep_definir_perfil',
  { usuario: 'p_usuario', nome: 'p_nome', papel: 'p_papel', setor: 'p_setor', ativo: 'p_ativo' }, ['super_admin'],
  v.object({ usuario: v.uuid, nome: v.string(2, 120), papel: v.enumeration(roles), setor: v.nullable(v.uuid), ativo: v.boolean }, ['usuario', 'nome', 'papel']));
rpc('PUT', '/configuracao', 'Versionar aviso de privacidade e controlar a coleta e retenção', 'ep_configurar_operacao',
  { privacidade_versao: 'p_privacidade_versao', privacidade_texto: 'p_privacidade_texto', habilitada: 'p_habilitada', retencao_dias: 'p_retencao_dias' }, ['super_admin'],
  v.object({ privacidade_versao: v.string(1, 80), privacidade_texto: v.string(30, 10000), habilitada: v.boolean, retencao_dias: v.integer(1, 3650) }, ['privacidade_versao', 'privacidade_texto', 'habilitada']));
rpc('GET', '/auditoria', 'Consultar trilha administrativa paginada', 'ep_auditoria', { antes: 'p_antes', limite: 'p_limite' }, ['super_admin'], undefined,
  v.object({ antes: v.integer(1, Number.MAX_SAFE_INTEGER), limite: v.integer(1, 500) }));

function matchRoutes(pathname) {
  return definitions.flatMap(route => {
    const keys = [];
    const expression = route.path.split('/').map(part => {
      if (part.startsWith(':')) { keys.push(part.slice(1)); return '([^/]+)'; }
      return part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }).join('/');
    const found = pathname.match(new RegExp('^' + expression + '$'));
    if (!found) return [];
    const params = Object.fromEntries(keys.map((key, i) => [key, found[i + 1]]));
    return [{ route, params }];
  });
}
function mapRpc(route, data) {
  return Object.fromEntries(Object.entries(route.fields || {}).filter(([field]) => Object.hasOwn(data, field)).map(([field, target]) => [target, data[field]]));
}
module.exports = { definitions, roles, matchRoutes, mapRpc, exportFields };
