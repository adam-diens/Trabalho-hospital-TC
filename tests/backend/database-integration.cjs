// Ponte de teste: simula Auth/gateway, mas executa as RPCs reais com roles no PostgreSQL.
// Não é código de produção e nunca consulta um Supabase remoto.
const { spawnSync } = require('node:child_process');
const assert = require('node:assert/strict');
const { createApplication } = require('../../backend/app.cjs');
const { readConfig } = require('../../backend/config.cjs');

async function databaseIntegration({ psql, args }) {
  function sql(statement) {
    const result = spawnSync(psql, [...args, '-v', 'VERBOSITY=verbose', '-c', statement], {
      encoding: 'utf8', windowsHide: true, env: { ...process.env, PGCLIENTENCODING: 'UTF8' }, timeout: 15000,
    });
    if (result.error) throw result.error;
    if (result.status !== 0) throw Object.assign(new Error(result.stderr), { sqlstate: result.stderr.match(/ERROR:\s+([A-Z0-9]{5}):/)?.[1] || 'XX000' });
    return result.stdout.trim().split(/\r?\n/).at(-1);
  }
  const config = readConfig({ SUPABASE_URL: 'http://postgres.test', SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_fixture', SUPABASE_SECRET_KEY: 'sb_secret_fixture',
    ORIGIN_HMAC_SECRET: 'b'.repeat(64), PUBLIC_ORIGIN: 'https://hospital.example', PORT: '0', READ_LIMIT_PER_MINUTE: '10000' });
  const users = {
    super_admin: '00000000-0000-0000-0000-000000000001', admin_setor: '00000000-0000-0000-0000-000000000002',
    gestao: '00000000-0000-0000-0000-000000000003', ouvidoria: '00000000-0000-0000-0000-000000000004',
    visualizador: '00000000-0000-0000-0000-000000000005', sem_perfil: '00000000-0000-0000-0000-000000000006',
  };
  function literal(value) {
    if (value === null) return 'null';
    if (typeof value === 'boolean' || typeof value === 'number') return String(value);
    const text = typeof value === 'object' ? JSON.stringify(value) : value;
    return "'" + text.replace(/'/g, "''") + "'" + (typeof value === 'object' ? '::jsonb' : '');
  }
  const bridge = async (urlString, options) => {
    const url = new URL(urlString);
    const token = options.headers.Authorization?.replace('Bearer ', '');
    if (url.pathname === '/auth/v1/user') {
      return new Response(JSON.stringify(users[token] ? { id: users[token], role: 'authenticated' } : {}), { status: users[token] ? 200 : 401 });
    }
    const name = url.pathname.split('/').at(-1);
    assert.match(name, /^ep_[a-z_]+$/);
    const body = JSON.parse(options.body || '{}');
    for (const field of Object.keys(body)) assert.match(field, /^p_[a-z_]+$/);
    const role = options.headers.apikey === config.secretKey ? 'service_role' : token ? 'authenticated' : 'anon';
    const invocation = `public.${name}(${Object.entries(body).map(([field, value]) => `${field} => ${literal(value)}`).join(',')})`;
    try {
      const result = sql(`begin; set local role ${role}; select set_config('request.jwt.claim.sub',${literal(users[token] || '')},true); select coalesce(to_jsonb(${invocation}),'null'::jsonb); commit;`);
      return new Response(result);
    } catch (error) { return new Response(JSON.stringify({ code: error.sqlstate, message: error.message }), { status: 400 }); }
  };
  // Reinicia somente limites da fixture descartável, nunca dados de produção.
  sql('update hospital.configuracao set limite_origem_10min=15,limite_setor_10min=300; delete from hospital.limites_coleta;');
  const server = createApplication(config, { fetchImpl: bridge, logger: () => {} });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  let checks = 0;
  async function request(route, { role, body, method = 'GET', status = 200 } = {}) {
    const response = await fetch(base + '/api/v2' + route, { method,
      headers: { ...(role ? { Authorization: `Bearer ${role}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}) });
    const text = await response.text();
    assert.equal(response.status, status, route + ': ' + text); checks++;
    return response.headers.get('content-type').includes('application/json') ? JSON.parse(text) : text;
  }
  try {
    const sectors = await request('/setores'); const pa = sectors.find(s => s.slug === 'pa').id;
    const form = await request('/setores/pa/formulario');
    const crypto = require('node:crypto');
    const key = crypto.randomUUID();
    const payload = { chave_envio: key, questionario_id: form.questionario_id, nota: 10, canal: 'celular', privacidade_versao: form.privacidade_versao,
      etapas: { recepcao: 10, triagem: 5 }, tipo: 'reclamacao', comentario: "Teste de integracao d'agua sem dados reais.", telefone: '51987654321', consentimento: true };
    const receipt = await request('/pesquisas', { method: 'POST', body: payload });
    assert.equal(receipt.recebida, true); assert.ok(receipt.protocolo);
    assert.deepEqual(await request('/pesquisas', { method: 'POST', body: payload }), receipt);
    assert.equal(sql(`select count(*) from hospital.respostas where chave_envio='${key}'`), '1');
    await request('/pesquisas', { method: 'POST', body: { ...payload, nota: 9 }, status: 400 });
    const today = sql("select (now() at time zone 'America/Sao_Paulo')::date");
    const filter = `inicio=${today}&fim=${today}`;
    for (const role of ['super_admin', 'admin_setor', 'gestao', 'ouvidoria', 'visualizador']) await request('/painel?' + filter, { role });
    await request('/painel?' + filter, { status: 401 });
    await request('/painel?' + filter, { role: 'sem_perfil', status: 403 });
    const list = await request('/manifestacoes', { role: 'ouvidoria' });
    const item = list.find(row => row.protocolo === receipt.protocolo); assert.ok(item);
    assert.equal((await request('/manifestacoes/' + item.id, { role: 'ouvidoria' })).telefone, '51987654321');
    assert.equal((await request('/manifestacoes/' + item.id, { role: 'gestao' })).telefone, null);
    await request('/manifestacoes', { role: 'visualizador', status: 403 });
    const result = await request(`/manifestacoes/${item.id}/atendimentos`, { role: 'ouvidoria', method: 'POST', body: { revisao: 1, situacao: 'encerrada', relato: 'Atendimento registrado em homologacao.' } });
    assert.equal(result.revisao, 2);
    await request(`/manifestacoes/${item.id}/atendimentos`, { role: 'ouvidoria', method: 'POST', body: { revisao: 1, situacao: 'encerrada', relato: 'Repeticao com revisao antiga.' }, status: 409 });
    const csv = await request('/exportacoes.csv?' + filter + '&setor=' + pa, { role: 'gestao' });
    assert.ok(!csv.includes('51987654321')); assert.ok(!csv.includes("d'agua"));
    const e = await request('/equipes', { method: 'PUT', role: 'admin_setor', body: { setor: pa, nome: 'Equipe API' } });
    await request('/escalas', { method: 'PUT', role: 'admin_setor', body: { setor: pa, equipe: e, data: today, turno: 'manha' } });
    await request('/escalas?' + filter, { role: 'gestao' });
    await request('/questionarios?setor=' + pa, { role: 'admin_setor' });
    await request('/configuracao', { role: 'super_admin' });
    await request('/configuracao', { role: 'admin_setor', status: 403 });
    await request('/auditoria', { role: 'super_admin' });
    await request('/qrcodes', { role: 'admin_setor' });
    console.log(`OK: ${checks} operações HTTP da API v2 integradas às RPCs reais do PostgreSQL (Auth/gateway simulados).`);
  } finally {
    server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
  }
}
module.exports = { databaseIntegration };
