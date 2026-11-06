const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { createApplication, csvCell } = require('../../backend/app.cjs');
const { readConfig } = require('../../backend/config.cjs');
const { createSupabase } = require('../../backend/supabase.cjs');
const { clientIp, createSecurity } = require('../../backend/security.cjs');
const { runMaintenance } = require('../../backend/maintenance.cjs');
const { openapi } = require('../../backend/openapi.cjs');
const { definitions } = require('../../backend/routes.cjs');

const PA = '11111111-1111-4111-8111-111111111111';
const RX = '22222222-2222-4222-8222-222222222222';
const Q = '33333333-3333-4333-8333-333333333333';
const MID = '44444444-4444-4444-8444-444444444444';
const UID = '55555555-5555-4555-8555-555555555555';
const roles = ['super_admin', 'admin_setor', 'gestao', 'ouvidoria', 'visualizador'];
const validSurvey = () => ({ chave_envio: crypto.randomUUID(), questionario_id: Q, nota: 5, canal: 'celular', privacidade_versao: 'v1' });
const calls = [], logs = [];
let upstream, app, base, config, failure, emptyProfile = false, exportPage, signupBody;
function profile(role) { return { user_id: UID, nome: 'Pessoa fictícia', papel: role, setor_id: role === 'admin_setor' ? PA : null }; }
before(async () => {
  upstream = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://mock');
    let raw = ''; for await (const chunk of req) raw += chunk;
    const body = raw ? JSON.parse(raw) : null;
    calls.push({ path: url.pathname, search: url.search, method: req.method, headers: req.headers, body });
    const name = url.pathname.split('/').at(-1);
    const token = req.headers.authorization?.replace('Bearer ', '');
    const role = token?.replace('token-', '');
    let result = null;
    if (failure && failure.name === name) {
      if (failure.delay) { await new Promise(resolve => setTimeout(resolve, failure.delay)); }
      res.writeHead(failure.status || 400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ code: failure.code, message: 'SEGREDO_DO_UPSTREAM_telefone_email_SQL' })); return;
    }
    if (name === 'user') {
      if (!roles.includes(role) && role !== 'sem_perfil') { res.writeHead(401); res.end('{}'); return; }
      result = { id: UID, role: 'authenticated' };
    } else if (name === 'token') {
      const nextRole = body.refresh_token === 'refresh-valido' ? 'gestao' : body.email?.split('@')[0];
      if (!roles.includes(nextRole) && nextRole !== 'sem_perfil') { res.writeHead(400); res.end('{}'); return; }
      result = { access_token: `token-${nextRole}`, refresh_token: 'refresh-valido', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, user: { id: UID } };
    } else if (name === 'signup') { signupBody = body; result = { id: UID }; }
    else if (name === 'recover' || name === 'logout') result = null;
    else if (name === 'ep_meu_perfil') {
      if (role === 'sem_perfil' || emptyProfile) { res.writeHead(403); res.end(JSON.stringify({ code: '42501' })); return; }
      result = profile(role);
    } else if (name === 'ep_setores' || name === 'ep_listar_setores') result = [{ id: PA, slug: 'pa', nome: 'Pronto Atendimento' }, { id: RX, slug: 'rx', nome: 'Raio-X' }];
    else if (name === 'ep_formulario') result = { questionario_id: Q, versao: 1, metrica: 'rostos_5', privacidade_versao: 'v1', perguntas: [{ chave: 'geral', obrigatoria: true, metrica: 'rostos_5' }] };
    else if (name === 'ep_enviar_pesquisa') result = { recebida: true, protocolo: body.p_tipo || body.p_telefone ? 123 : null };
    else if (name === 'ep_painel') result = { respostas: 10, por_metrica: [{ metrica: 'rostos_5', n: 10, media: 4 }], por_equipe: [] };
    else if (name === 'ep_tv') result = { periodo_dias: 30, metricas: [] };
    else if (name === 'ep_detalhar_manifestacao') result = { id: MID, comentario: 'Relato fictício.', telefone: '51999999999', consentimento_em: '2026-11-06', interacoes: [{ relato: 'Privado' }] };
    else if (name === 'ep_atender_manifestacao') result = 2;
    else if (name === 'ep_exportar') result = exportPage ? exportPage(body) : [{ id: MID, setor: 'pa', data_local: '2026-11-06', metrica: 'rostos_5', nota: 5, telefone: 'NUNCA_EXPORTAR', comentario: 'NUNCA_EXPORTAR' }];
    else if (name === 'ep_listar_manifestacoes') result = [{ id: MID, protocolo: 123, situacao: 'aberta' }];
    else if (name === 'ep_configuracao') result = { coleta_habilitada: false, privacidade_versao: 'rascunho' };
    else if (name === 'ep_questionario') result = { id: Q, versao: body.p_versao || 1 };
    else if (['ep_salvar_setor', 'ep_salvar_equipe', 'ep_salvar_escala', 'ep_publicar_questionario'].includes(name)) result = Q;
    else if (name==='ep_listar_solicitacoes') result=[{user_id:PA,nome:'Nova Pessoa',email:'nova@example.invalid',situacao:'pendente'}];
    else if (name==='ep_decidir_solicitacao') result={situacao:body.p_decisao==='aprovar'?'aprovada':'rejeitada'};
    else if (['ep_listar_equipes', 'ep_listar_escalas', 'ep_listar_perfis', 'ep_auditoria'].includes(name)) result = [];
    else if (['ep_publicar_tv', 'ep_expurgar_contatos'].includes(name)) result = 1;
    res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(result));
  });
  await new Promise(resolve => upstream.listen(0, '127.0.0.1', resolve));
  config = readConfig({ SUPABASE_URL: `http://127.0.0.1:${upstream.address().port}`, SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test',
    SUPABASE_SECRET_KEY: 'sb_secret_only_backend', ORIGIN_HMAC_SECRET: 'a'.repeat(64), PUBLIC_ORIGIN: 'https://hospital.example',
    AUTH_REDIRECT_URL: 'https://hospital.example/recuperar', ALLOW_SIGNUP: 'true', PORT: '0', READ_LIMIT_PER_MINUTE: '10000', AUTH_LIMIT_PER_10_MINUTES: '1000',
    STREAM_INTERVAL_MS: '100', STREAM_MAX_MS: '2000',
  });
  app = createApplication(config, { logger: row => logs.push(row) });
  await new Promise(resolve => app.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${app.address().port}`;
});
after(async () => {
  app.closeAllConnections(); upstream.closeAllConnections();
  await Promise.all([new Promise(resolve => app.close(resolve)), new Promise(resolve => upstream.close(resolve))]);
});
async function request(url, { method = 'GET', body, role, headers = {} } = {}) {
  const response = await fetch(base + url, { method, headers: { ...(role ? { Authorization: `Bearer token-${role}` } : {}),
    ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...headers }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
  const text = await response.text();
  return { status: response.status, headers: response.headers, data: response.headers.get('content-type')?.includes('application/json') ? JSON.parse(text) : text };
}
const lastCall = name => calls.filter(c => c.path.endsWith('/' + name)).at(-1);

test('health, readiness e documentação usam a API v2 sem vazar configuração', async () => {
  assert.equal((await request('/api/health')).data.version, '2.0.0');
  assert.equal((await request('/api/ready')).status, 200);
  const spec = await request('/api/openapi.json'); assert.equal(spec.data.info.version, '2.0.0');
  assert.equal(Object.keys(spec.data.paths).length, new Set(definitions.map(r => r.path)).size + 2);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../backend/openapi.yaml'), 'utf8')), openapi);
});
test('arquivos públicos funcionam; fontes internas, Git, SQL e backups são bloqueados', async () => {
  for (const url of ['/', '/app.js', '/styles.css', '/assets/fhdod-logo-crop.jpg']) assert.equal((await request(url)).status, 200, url);
  for (const url of ['/.env', '/.git/config', '/backend/server.cjs', '/tests/database/run.cjs', '/supabase/migrations/202611060001_core.sql', '/output/database/instalar.sql', '/README.md', '/assets/../.env', '/assets/%2e%2e%2f.env']) {
    assert.equal((await request(url)).status, 404, url);
  }
  assert.equal((await request('/app.js')).headers.get('x-content-type-options'), 'nosniff');
});
test('catálogo, formulário e TV são públicos e usam chave pública', async () => {
  assert.equal((await request('/api/v2/setores')).data.length, 2);
  assert.equal((await request('/api/v2/setores/pa/formulario')).data.questionario_id, Q);
  assert.deepEqual(lastCall('ep_formulario').body, { p_setor: 'pa' });
  assert.equal((await request('/api/v2/tv')).status, 200);
  assert.equal(lastCall('ep_tv').headers.apikey, config.publishableKey);
  assert.equal(lastCall('ep_tv').headers.authorization, undefined);
});
test('métodos, rotas arbitrárias e RPCs legadas não são encaminhados', async () => {
  assert.equal((await request('/api/v2/setores', { method: 'DELETE' })).status, 405);
  assert.equal((await request('/api/v2/rpc/ep_expurgar_contatos', { method: 'POST', body: {} })).status, 404);
  assert.equal((await request('/api/rest/v1/perfis')).status, 410);
  assert.equal((await request('/api/auth/v1/token', { method: 'POST', body: {} })).status, 410);
});
test('coleta é atômica e a origem é derivada no servidor; nunca herda o Bearer do paciente', async () => {
  const body = { ...validSurvey(), etapas: { recepcao: 4 }, tipo: 'elogio', comentario: 'Atendimento acolhedor.', telefone: '51987654321', consentimento: true };
  const result = await request('/api/v2/pesquisas', { method: 'POST', body, role: 'gestao', headers: { 'X-Forwarded-For': '1.2.3.4' } });
  assert.equal(result.status, 200); assert.equal(result.data.protocolo, 123);
  const call = lastCall('ep_enviar_pesquisa');
  assert.equal(call.headers.apikey, config.secretKey); assert.equal(call.headers.authorization, undefined);
  assert.match(call.body.p_origem_hash, /^[a-f0-9]{64}$/);
  assert.equal(call.body.p_origem_hash, crypto.createHmac('sha256', config.originSecret).update('127.0.0.1').digest('hex'));
  assert.equal(call.body.p_chave_envio, body.chave_envio);
  assert.equal(call.body.p_consentimento, true);
  assert.equal(call.body.p_etapas.recepcao, 4);
  assert.equal((await request('/api/v2/pesquisas', { method: 'POST', body: validSurvey() })).data.protocolo, null);
});
test('payloads inválidos são rejeitados antes de qualquer gravação no Supabase', async () => {
  const count = calls.filter(c => c.path.endsWith('/ep_enviar_pesquisa')).length;
  const invalid = [
    { ...validSurvey(), p_origem_hash: 'forjado' }, { ...validSurvey(), nota: '5' }, { ...validSurvey(), nota: 0 },
    { ...validSurvey(), nota: 1.5 }, { ...validSurvey(), etapas: { geral: 11 } }, { ...validSurvey(), tipo: 'outro', comentario: 'Texto' },
    { ...validSurvey(), telefone: '51987654321' }, { ...validSurvey(), consentimento: true },
    { ...validSurvey(), tipo: 'elogio' }, { ...validSurvey(), comentario: 'Sem tipo' },
    { ...validSurvey(), etapas: [] }, { ...validSurvey(), chave_envio: 'invalid' },
    { ...validSurvey(), comentario: 'a'.repeat(2001), tipo: 'elogio' },
  ];
  for (const body of invalid) assert.equal((await request('/api/v2/pesquisas', { method: 'POST', body })).status, 400, JSON.stringify(body));
  assert.equal(calls.filter(c => c.path.endsWith('/ep_enviar_pesquisa')).length, count);
  const bad = await fetch(base + '/api/v2/pesquisas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{' });
  assert.equal(bad.status, 400); await bad.text();
  const proto = await fetch(base + '/api/v2/auth/entrar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"email":"x@y.z","senha":"senha","__proto__":{"papel":"super_admin"}}' });
  assert.equal(proto.status, 400); await proto.text();
});
test('JSON obrigatório, limite de tamanho e queries estritas', async () => {
  assert.equal((await fetch(base + '/api/v2/pesquisas', { method: 'POST', body: '{}' })).status, 415);
  const tooBig = await fetch(base + '/api/v2/pesquisas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dado: 'x'.repeat(40000) }) });
  assert.equal(tooBig.status, 413); await tooBig.text();
  assert.equal((await request('/api/v2/setores?select=*')).status, 400);
  assert.equal((await request('/api/v2/painel?inicio=2026-11-01&inicio=2026-11-02&fim=2026-11-06', { role: 'gestao' })).status, 400);
  assert.equal((await request('/api/v2/painel?inicio=2026-02-30&fim=2026-03-01', { role: 'gestao' })).status, 400);
  assert.equal((await request('/api/v2/painel?inicio=2026-11-06&fim=2026-11-01', { role: 'gestao' })).status, 400);
});
test('os cinco perfis entram no painel; conta sem perfil, JWT inválido e anon são negados', async () => {
  const url = '/api/v2/painel?inicio=2026-11-01&fim=2026-11-06';
  for (const role of roles) {
    assert.equal((await request('/api/v2/me', { role })).data.papel, role);
    assert.equal((await request(url, { role })).status, 200, role);
    assert.equal(lastCall('ep_painel').headers.apikey, config.publishableKey);
    assert.equal(lastCall('ep_painel').headers.authorization, `Bearer token-${role}`);
  }
  assert.equal((await request(url)).status, 401);
  assert.equal((await request(url, { role: 'forjado' })).status, 401);
  assert.equal((await request(url, { role: 'sem_perfil' })).status, 403);
  assert.equal((await request(url, { headers: { Authorization: `Bearer ${config.secretKey}` } })).status, 401);
});
test('perfil revogado é verificado novamente, sem cache de autorização', async () => {
  assert.equal((await request('/api/v2/me', { role: 'gestao' })).status, 200);
  emptyProfile = true;
  try { assert.equal((await request('/api/v2/me', { role: 'gestao' })).status, 403); }
  finally { emptyProfile = false; }
});
test('admin de setor não consulta ou altera outro setor', async () => {
  assert.equal((await request(`/api/v2/painel?inicio=2026-11-01&fim=2026-11-06&setor=${RX}`, { role: 'admin_setor' })).status, 403);
  assert.equal((await request('/api/v2/equipes', { method: 'PUT', role: 'admin_setor', body: { setor: RX, nome: 'Equipe indevida' } })).status, 403);
  assert.equal((await request(`/api/v2/painel?inicio=2026-11-01&fim=2026-11-06&setor=${PA}`, { role: 'admin_setor' })).status, 200);
});
test('Ouvidoria recebe contato; gestão e admin têm contato e histórico interno removidos', async () => {
  for (const role of ['super_admin', 'ouvidoria']) assert.equal((await request(`/api/v2/manifestacoes/${MID}`, { role })).data.telefone, '51999999999');
  for (const role of ['gestao', 'admin_setor']) {
    const result = await request(`/api/v2/manifestacoes/${MID}`, { role });
    assert.equal(result.data.telefone, null); assert.deepEqual(result.data.interacoes, []);
  }
  assert.equal((await request('/api/v2/manifestacoes', { role: 'visualizador' })).status, 403);
  assert.equal((await request('/api/v2/manifestacoes?limite=101', { role: 'ouvidoria' })).status, 400);
  assert.equal((await request('/api/v2/manifestacoes?limite=2&antes=999', { role: 'ouvidoria' })).headers.get('x-next-cursor'), '123');
});
test('atendimento usa revisão e é exclusivo da Ouvidoria e Super Admin', async () => {
  const body = { revisao: 1, situacao: 'encerrada', relato: 'Atendimento concluído.' };
  assert.equal((await request(`/api/v2/manifestacoes/${MID}/atendimentos`, { method: 'POST', role: 'ouvidoria', body })).data.revisao, 2);
  assert.equal(lastCall('ep_atender_manifestacao').body.p_revisao, 1);
  assert.equal((await request(`/api/v2/manifestacoes/${MID}/atendimentos`, { method: 'POST', role: 'gestao', body })).status, 403);
  failure = { name: 'ep_atender_manifestacao', code: '40001' };
  try { assert.equal((await request(`/api/v2/manifestacoes/${MID}/atendimentos`, { method: 'POST', role: 'ouvidoria', body })).status, 409); }
  finally { failure = null; }
});
test('questionários aceitam escalas por etapa e versões; valida chaves e limiar', async () => {
  const body = { setor: PA, metrica: 'nota_10', limite_ouvidoria: 4, pergunta_geral: 'Como foi sua experiência?', etapas: [
    { chave: 'recepcao', texto: 'Como foi sua recepção?', metrica: 'rostos_5' }, { chave: 'triagem', texto: 'Como foi sua triagem?', metrica: 'nota_10' },
  ] };
  assert.equal((await request('/api/v2/questionarios', { method: 'POST', role: 'admin_setor', body })).status, 200);
  assert.equal(lastCall('ep_publicar_questionario').body.p_etapas[1].metrica, 'nota_10');
  assert.equal((await request('/api/v2/questionarios', { method: 'POST', role: 'gestao', body })).status, 403);
  assert.equal((await request('/api/v2/questionarios', { method: 'POST', role: 'super_admin', body: { ...body, metrica: 'rostos_5', limite_ouvidoria: 5 } })).status, 400);
  assert.equal((await request('/api/v2/questionarios', { method: 'POST', role: 'super_admin', body: { ...body, etapas: [body.etapas[0], body.etapas[0]] } })).status, 400);
  assert.equal((await request(`/api/v2/questionarios?setor=${PA}&versao=1`, { role: 'admin_setor' })).status, 200);
});
test('cadastros administrativos, perfis e configuração têm permissões corretas', async () => {
  for (const role of ['admin_setor', 'gestao', 'ouvidoria', 'visualizador']) {
    for (const url of ['/api/v2/perfis', '/api/v2/configuracao', '/api/v2/auditoria', '/api/v2/admin/setores']) assert.equal((await request(url, { role })).status, 403, role + url);
  }
  assert.equal((await request('/api/v2/admin/setores', { role: 'super_admin' })).status, 200);
  assert.equal((await request('/api/v2/configuracao', { role: 'super_admin' })).data.coleta_habilitada, false);
  assert.equal((await request('/api/v2/setores', { method: 'PUT', role: 'super_admin', body: { slug: 'novo', nome: 'Novo setor', ativo: false } })).status, 200);
  const user = { usuario: UID, nome: 'Pessoa fictícia', papel: 'admin_setor', setor: PA };
  assert.equal((await request('/api/v2/perfis', { method: 'PUT', role: 'super_admin', body: user })).status, 200);
  assert.equal((await request('/api/v2/perfis', { method: 'PUT', role: 'super_admin', body: { ...user, setor: null } })).status, 400);
});
test('equipes e escala mensal têm filtros e validação', async () => {
  assert.equal((await request('/api/v2/equipes', { method: 'PUT', role: 'admin_setor', body: { setor: PA, nome: 'Equipe A' } })).status, 200);
  assert.equal((await request(`/api/v2/equipes?setor=${PA}`, { role: 'admin_setor' })).status, 200);
  const body = { setor: PA, equipe: Q, data: '2026-11-06', turno: 'tarde' };
  assert.equal((await request('/api/v2/escalas', { method: 'PUT', role: 'admin_setor', body })).status, 200);
  assert.equal((await request('/api/v2/escalas?inicio=2026-11-01&fim=2026-11-30', { role: 'gestao' })).status, 200);
  assert.equal((await request('/api/v2/escalas?inicio=2026-01-01&fim=2026-12-31', { role: 'gestao' })).status, 400);
});
test('exportação JSON e CSV aplicam todos os filtros e removem contato/texto livre', async () => {
  const query = `inicio=2026-11-01&fim=2026-11-06&setor=${PA}&turno=tarde&equipe=${Q}`;
  const json = await request('/api/v2/exportacoes?' + query, { role: 'gestao' });
  assert.equal(json.status, 200); assert.equal(json.data[0].telefone, undefined); assert.equal(json.data[0].comentario, undefined);
  assert.equal(lastCall('ep_exportar').body.p_turno, 'tarde'); assert.equal(lastCall('ep_exportar').body.p_equipe, Q);
  const csv = await request('/api/v2/exportacoes.csv?' + query, { role: 'gestao' });
  assert.equal(csv.status, 200); assert.match(csv.headers.get('content-type'), /text\/csv/); assert.ok(!csv.data.includes('NUNCA_EXPORTAR'));
  assert.match(csv.headers.get('content-disposition'), /2026-11-01-2026-11-06/);
  assert.equal((await request('/api/v2/exportacoes?' + query, { role: 'visualizador' })).status, 403);
  assert.equal((await request('/api/v2/exportacoes?' + query, { role: 'ouvidoria' })).status, 403);
  for (const value of ['=1+1', '+cmd', '-cmd', '@SUM(A1)', '\t=1', '  =2']) assert.ok(csvCell(value).startsWith('"\''), value);
  assert.equal(csvCell('texto "normal"'), '"texto ""normal"""');
});
test('CSV percorre páginas mantendo os filtros, sem exceder limite total', async () => {
  exportPage = body => body.p_depois ? [{ id: Q, setor: 'pa', nota: 5 }] : Array.from({ length: 500 }, (_, i) => ({ id: i === 499 ? MID : `linha-${i}`, setor: 'pa', nota: 5 }));
  try {
    const result = await request('/api/v2/exportacoes.csv?inicio=2026-11-01&fim=2026-11-06&turno=manha', { role: 'super_admin' });
    assert.equal(result.status, 200); assert.equal(result.data.split('\r\n').length, 502);
    assert.equal(lastCall('ep_exportar').body.p_depois, MID); assert.equal(lastCall('ep_exportar').body.p_turno, 'manha');
  } finally { exportPage = null; }
});
test('links de QR usam origem configurada, não Host do cliente, e respeitam setor', async () => {
  const result = await request('/api/v2/qrcodes', { role: 'gestao', headers: { Host: 'evil.example' } });
  assert.equal(result.data.length, 4); assert.ok(result.data.every(row => row.url.startsWith(config.publicOrigin)));
  const sector = await request('/api/v2/qrcodes', { role: 'admin_setor' });
  assert.equal(sector.data.length, 2); assert.ok(sector.data.every(row => row.setor_id === PA));
  const image=await request('/api/v2/qrcodes/pa/tablet',{role:'admin_setor'});
  assert.equal(image.status,200);assert.match(image.headers.get('content-type'),/image\/svg\+xml/);assert.ok(image.data.includes('<svg'));
  assert.equal((await request('/api/v2/qrcodes/rx/tablet',{role:'admin_setor'})).status,403);
  assert.equal((await request('/api/v2/qrcodes/pa/invalido',{role:'gestao'})).status,400);
});
test('login, refresh, cadastro sem perfil, recuperação e logout usam Auth sem credencial operacional', async () => {
  const session = await request('/api/v2/auth/entrar', { method: 'POST', body: { email: 'gestao@example.invalid', senha: 'senha' } });
  assert.equal(session.status, 200); assert.equal(session.data.perfil.papel, 'gestao'); assert.equal(session.data.user, undefined);
  assert.equal((await request('/api/v2/auth/entrar', { method: 'POST', body: { email: 'sem_perfil@example.invalid', senha: 'senha' } })).status, 403);
  assert.equal((await request('/api/v2/auth/renovar', { method: 'POST', body: { refresh_token: 'refresh-valido' } })).status, 200);
  const signup = await request('/api/v2/auth/cadastrar', { method: 'POST', body: { email: 'nova@example.invalid', senha: 'senha-longa-de-teste', nome: 'Nova Pessoa' } });
  assert.equal(signup.status, 202); assert.deepEqual(signupBody.data, { name: 'Nova Pessoa' });
  failure = { name: 'signup', code: 'user_already_exists' };
  try {
    const repeated = await request('/api/v2/auth/cadastrar', { method: 'POST', body: { email: 'nova@example.invalid', senha: 'senha-longa-de-teste', nome: 'Nova Pessoa' } });
    assert.equal(repeated.status, 202); assert.deepEqual(repeated.data, signup.data);
  } finally { failure = null; }
  assert.equal((await request('/api/v2/auth/cadastrar', { method: 'POST', body: { email: 'nova@example.invalid', senha: 'senha-longa-de-teste', nome: 'Nova Pessoa', papel: 'super_admin' } })).status, 400);
  assert.equal((await request('/api/v2/auth/recuperar-senha', { method: 'POST', body: { email: 'nova@example.invalid' } })).status, 202);
  assert.ok(lastCall('recover').search.includes(encodeURIComponent(config.authRedirectUrl)));
  assert.equal((await request('/api/v2/auth/sair', { method: 'POST', role: 'gestao', body: {} })).status, 200);
  assert.equal(lastCall('logout').search, '?scope=local');
  assert.equal((await request('/api/v2/auth/senha', { method: 'PUT', role: 'gestao', body: { senha: 'nova-senha-de-teste', nonce: 'codigo-confirmado' } })).status, 200);
  assert.equal(lastCall('user').method, 'PUT'); assert.equal(lastCall('user').body.password, 'nova-senha-de-teste');
  assert.ok(calls.filter(c => c.path.startsWith('/auth/')).every(c => c.headers.apikey === config.publishableKey));
});
test('CORS aceita só origens configuradas e preflights conhecidos', async () => {
  assert.equal((await request('/api/v2/setores', { headers: { Origin: 'https://evil.example' } })).status, 403);
  assert.equal((await request('/api/v2/setores', { headers: { Origin: config.publicOrigin } })).headers.get('access-control-allow-origin'), config.publicOrigin);
  assert.equal((await request('/api/v2/pesquisas', { method: 'OPTIONS', headers: { Origin: config.publicOrigin, 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'content-type' } })).status, 204);
  assert.equal((await request('/api/v2/pesquisas', { method: 'OPTIONS', headers: { Origin: config.publicOrigin, 'Access-Control-Request-Headers': 'x-admin-secret' } })).status, 403);
});
test('erros SQL são traduzidos e não vazam mensagens internas', async () => {
  const cases = [['55000', 503, 'ep_formulario', '/api/v2/setores/pa/formulario'], ['PGRST202', 503, 'ep_tv', '/api/v2/tv'],
    ['23505', 409, 'ep_salvar_setor', '/api/v2/setores'], ['22023', 400, 'ep_formulario', '/api/v2/setores/pa/formulario']];
  for (const [code, status, name, url] of cases) {
    failure = { name, code };
    try {
      const result = await request(url, name === 'ep_salvar_setor' ? { method: 'PUT', role: 'super_admin', body: { slug: 'novo', nome: 'Novo setor' } } : {});
      assert.equal(result.status, status); assert.ok(!JSON.stringify(result.data).includes('SEGREDO_DO_UPSTREAM')); assert.ok(result.data.error.request_id);
    } finally { failure = null; }
  }
  failure = { name: 'ep_formulario', code: '55000', status: 500 };
  try {
    const result = await request('/api/v2/setores/pa/formulario');
    assert.equal(result.status, 503);
    assert.equal(result.data.error.code, 'COLLECTION_DISABLED');
    assert.ok(!JSON.stringify(result.data).includes('SEGREDO_DO_UPSTREAM'));
  } finally { failure = null; }
  failure = { name: 'ep_enviar_pesquisa', code: 'P0001' };
  try { const result = await request('/api/v2/pesquisas', { method: 'POST', body: validSurvey() }); assert.equal(result.status, 429); assert.equal(result.headers.get('retry-after'), '600'); }
  finally { failure = null; }
});
test('SSE envia agregados e revalida perfil antes das atualizações', async () => {
  const response = await fetch(base + '/api/v2/painel/stream?inicio=2026-11-01&fim=2026-11-06', { headers: { Authorization: 'Bearer token-gestao' } });
  assert.equal(response.status, 200); assert.match(response.headers.get('content-type'), /text\/event-stream/);
  const reader = response.body.getReader(); let text = '';
  while (!text.includes('event: painel')) { const value = await reader.read(); text += new TextDecoder().decode(value.value); }
  assert.ok(text.includes('"respostas":10'));
  emptyProfile = true;
  try { while (!text.includes('event: erro')) { const value = await reader.read(); if (value.done) break; text += new TextDecoder().decode(value.value); } assert.ok(text.includes('event: erro')); }
  finally { emptyProfile = false; await reader.cancel(); }
});
test('jobs usam apenas RPCs operacionais e não têm endpoints públicos', async () => {
  const result = await runMaintenance(config);
  assert.equal(result.tv, 1); assert.equal(result.contatos_expurgados, 1);
  assert.equal(lastCall('ep_expurgar_contatos').headers.apikey, config.secretKey);
  assert.equal((await request('/api/v2/maintenance', { method: 'POST', role: 'super_admin', body: {} })).status, 404);
});
test('timeout, erro de rede, chave JWT legada e credencial ausente são tratados', async () => {
  const timeoutDb = createSupabase({ ...config, upstreamTimeoutMs: 20 }, async (_url, options) => {
    await new Promise((resolve, reject) => { options.signal.addEventListener('abort', () => reject(options.signal.reason), { once: true }); setTimeout(resolve, 100); });
    return new Response('{}');
  });
  await assert.rejects(timeoutDb.rpc('ep_setores'), e => e.status === 504);
  const unavailable = createSupabase(config, async () => { throw new Error('secret internal'); });
  await assert.rejects(unavailable.rpc('ep_setores'), e => e.status === 502 && !e.message.includes('secret'));
  const missing = createSupabase({ ...config, secretKey: '' });
  await assert.rejects(missing.rpc('ep_enviar_pesquisa', {}, { operational: true }), e => e.status === 503);
  let received;
  const jwtKey = 'header.payload.signature';
  const legacy = createSupabase({ ...config, secretKey: jwtKey }, async (_url, options) => { received = options.headers; return new Response('{}'); });
  await legacy.rpc('ep_publicar_tv', {}, { operational: true });
  assert.equal(received.Authorization, `Bearer ${jwtKey}`);
});
test('rate limit, IP de proxy e HMAC não confiam em identificador do navegador', () => {
  const req = { socket: { remoteAddress: '127.0.0.1' }, headers: { 'x-forwarded-for': '8.8.8.8, 10.0.0.1' } };
  assert.equal(clientIp(req), '127.0.0.1');
  assert.equal(clientIp(req, ['127.0.0.1', '10.0.0.1']), '8.8.8.8');
  const security = createSecurity(config);
  security.limit(req, 'test', 1, 60000);
  assert.throws(() => security.limit(req, 'test', 1, 60000), e => e.status === 429 && Boolean(e.headers['Retry-After']));
  const missing = createSecurity({ ...config, originSecret: '' });
  assert.throws(() => missing.originHash(req, true), e => e.status === 503);
});
test('produção exige configuração completa e logs não contêm credenciais ou dados pessoais', () => {
  assert.throws(() => readConfig({ NODE_ENV: 'production' }), /Produção exige/);
  assert.throws(() => readConfig({ ORIGIN_HMAC_SECRET: 'curto' }), /32 bytes/);
  assert.throws(() => readConfig({ MAX_BODY_BYTES: 'zero' }), /MAX_BODY_BYTES/);
  assert.throws(() => readConfig({ CORS_ORIGINS: '*' }));
  const output = JSON.stringify(logs);
  for (const text of [config.secretKey, config.publishableKey, 'senha-longa-de-teste', '51987654321', '51999999999', 'token-gestao', 'refresh-valido', 'Atendimento acolhedor']) assert.ok(!output.includes(text), text);
  assert.ok(logs.every(row => row.request_id && typeof row.status === 'number'));
});
test('CSV recusa exportação acima do limite antes de iniciar o download', async () => {
  const previous = config.maxExportRows; config.maxExportRows = 1;
  exportPage = () => [{ id: MID, setor: 'pa' }, { id: Q, setor: 'rx' }];
  try {
    const result = await request('/api/v2/exportacoes.csv?inicio=2026-11-01&fim=2026-11-06', { role: 'super_admin' });
    assert.equal(result.status, 422); assert.equal(result.data.error.code, 'EXPORT_TOO_LARGE');
  } finally { exportPage = null; config.maxExportRows = previous; }
});
test('resposta grande do upstream é interrompida sem expor conteúdo', async () => {
  const db = createSupabase({ ...config, maxUpstreamBytes: 1024 }, async () => new Response('x'.repeat(2000)));
  await assert.rejects(db.rpc('ep_setores'), e => e.status === 502 && e.code === 'UPSTREAM_TOO_LARGE');
});

test('somente superadmin analisa solicitações e aprovação nunca concede superadmin',async()=>{
  const approve={usuario:PA,decisao:'aprovar',papel:'visualizador'};
  assert.equal((await request('/api/v2/solicitacoes')).status,401);
  for(const role of roles.filter(r=>r!=='super_admin')){
    assert.equal((await request('/api/v2/solicitacoes',{role})).status,403);
    assert.equal((await request('/api/v2/solicitacoes',{method:'PUT',role,body:approve})).status,403);
  }
  const list=await request('/api/v2/solicitacoes?situacao=pendente&limite=50',{role:'super_admin'});
  assert.equal(list.status,200);assert.equal(list.headers.get('x-next-cursor'),PA);
  assert.equal(list.data[0].email,'nova@example.invalid');
  assert.equal((await request('/api/v2/solicitacoes',{method:'PUT',role:'super_admin',body:approve})).status,200);
  assert.equal(lastCall('ep_decidir_solicitacao').body.p_papel,'visualizador');
  for(const body of [{...approve,papel:'super_admin'},{...approve,papel:'admin_setor'},
    {...approve,setor:PA},{usuario:PA,decisao:'aprovar'},{...approve,motivo:'indevido'},
    {usuario:PA,decisao:'rejeitar'},{...approve,decisao:'rejeitar',motivo:'Não autorizado'}]){
    const previous=calls.length;
    assert.equal((await request('/api/v2/solicitacoes',{method:'PUT',role:'super_admin',body})).status,400);
    assert.ok(!calls.slice(previous).some(c=>c.path.endsWith('/ep_decidir_solicitacao')));
  }
  assert.equal((await request('/api/v2/solicitacoes',{method:'PUT',role:'super_admin',body:{usuario:PA,decisao:'rejeitar',motivo:'Vínculo não confirmado'}})).data.situacao,'rejeitada');
  failure={name:'ep_decidir_solicitacao',code:'40001',status:500};
  try{const result=await request('/api/v2/solicitacoes',{method:'PUT',role:'super_admin',body:approve});assert.equal(result.status,409);assert.equal(result.data.error.code,'VERSION_CONFLICT');}
  finally{failure=null;}
  assert.equal((await request('/api/v2/auth/cadastrar',{method:'POST',body:{email:'nova@example.invalid',nome:'Nova Pessoa',senha:'senha-longa-de-teste',papel:'super_admin'}})).status,400);
  failure={name:'ep_meu_perfil',code:'42501',status:403};
  try{const result=await request('/api/v2/auth/entrar',{method:'POST',body:{email:'gestao@example.invalid',senha:'senha-longa-de-teste'}});assert.equal(result.status,403);assert.equal(result.data.error.code,'ACCESS_NOT_APPROVED');assert.ok(!result.data.access_token);}
  finally{failure=null;}
  const previous=config.allowSignup;config.allowSignup=false;
  try{assert.equal((await request('/api/v2/auth/cadastrar',{method:'POST',body:{email:'nova@example.invalid',nome:'Nova Pessoa',senha:'senha-longa-de-teste'}})).data.error.code,'SIGNUP_DISABLED');}
  finally{config.allowSignup=previous;}
});
