// Smoke test somente leitura, sem credenciais, submissões ou alterações no banco.
const assert=require('node:assert/strict');
async function checkDeployment(origin,fetchImpl=fetch) {
  const url=new URL(origin);
  if(url.protocol!=='https:'||url.username||url.password||url.pathname!=='/'||url.search||url.hash)throw new Error('Informe somente a origem HTTPS da hospedagem.');
  let checks=0;
  async function request(route,status=200,headers={}) {
    const response=await fetchImpl(url.origin+route,{headers,redirect:'error',signal:AbortSignal.timeout(15000)});
    assert.equal(response.status,status,`HTTP inesperado em ${route}`);
    assert.ok(response.headers.get('strict-transport-security'),'HSTS ausente em '+route);
    checks++;return response;
  }
  const html=await request('/');
  assert.ok(html.headers.get('content-security-policy')?.includes("script-src 'self'"),'CSP ausente');
  assert.match(await html.text(),/type="module"/);
  for(const route of ['/app.js','/styles.css','/tablet.css','/assets/js/api.js','/assets/js/ui.js','/assets/js/patient.js','/assets/js/management.js','/assets/js/admin.js'])await (await request(route)).arrayBuffer();
  assert.equal((await (await request('/api/health')).json()).status,'ok');
  assert.equal((await (await request('/api/ready')).json()).status,'ready');
  assert.ok(Array.isArray(await (await request('/api/v2/setores',200,{Origin:url.origin})).json()));
  assert.ok(Array.isArray((await (await request('/api/v2/tv')).json()).metricas));
  await (await request('/api/v2/setores',403,{Origin:'https://origem-nao-autorizada.invalid'})).arrayBuffer();
  for(const route of ['/.env','/.env.production.example','/backend/server.cjs','/supabase/migrations/202611060001_core.sql','/render.yaml','/package.json'])await (await request(route,404)).arrayBuffer();
  return {status:'ok',checks};
}
if(require.main===module)checkDeployment(process.argv[2]).then(result=>console.log(JSON.stringify(result)))
  .catch(()=>{console.error('Verificação de hospedagem falhou. Confira a URL, o serviço e as configurações; nenhum dado foi alterado.');process.exitCode=1;});
module.exports={checkDeployment};
