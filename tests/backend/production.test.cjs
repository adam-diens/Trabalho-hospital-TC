const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {loadEnv,readConfig}=require('../../backend/config.cjs');
const {createSecurity,clientIp}=require('../../backend/security.cjs');
const {createApplication}=require('../../backend/app.cjs');
const {startWorker}=require('../../backend/worker.cjs');
const {checkDeployment}=require('../../scripts/check-deploy.cjs');

const env={NODE_ENV:'production',RENDER:'true',RENDER_EXTERNAL_URL:'https://fhdod.onrender.com',PORT:'10000',
  SUPABASE_URL:'https://supabase.example.invalid',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_fixture',SUPABASE_SECRET_KEY:'sb_secret_fixture',ORIGIN_HMAC_SECRET:'x'.repeat(64)};

test('Render deriva URLs confiáveis, respeita domínio próprio e valida configuração de produção',()=>{
  const config=readConfig(env);
  assert.equal(config.host,'0.0.0.0');assert.equal(config.port,10000);assert.equal(config.trustedProxyHops,1);
  assert.equal(config.publicOrigin,env.RENDER_EXTERNAL_URL);assert.equal(config.authRedirectUrl,env.RENDER_EXTERNAL_URL+'/?fluxo=recuperar-senha');
  const custom=readConfig({...env,PUBLIC_ORIGIN:'https://pesquisa.hospital.example'});
  assert.equal(custom.authRedirectUrl,'https://pesquisa.hospital.example/?fluxo=recuperar-senha');
  for(const invalid of [{PUBLIC_ORIGIN:'https://localhost'},{PUBLIC_ORIGIN:'http://localhost:5173'},
    {PUBLIC_ORIGIN:'https://hospital.example/path'},{AUTH_REDIRECT_URL:'https://outra.example'},
    {HOST:'127.0.0.1'},{PORT:'0'},{ALLOW_SIGNUP:'yes'},{TRUST_PROXY_HOPS:'99'},
    {TRUSTED_PROXY_IPS:'127.0.0.1'},{SUPABASE_SECRET_KEY:''},{ORIGIN_HMAC_SECRET:''},
    {SUPABASE_SECRET_KEY:'sb_publishable_fixture'},{SUPABASE_PUBLISHABLE_KEY:'sb_secret_fixture'}])assert.throws(()=>readConfig({...env,...invalid}));
  assert.throws(()=>readConfig({...env,RENDER:'false'}),/Produção exige/);
  assert.equal(readConfig({NODE_ENV:'production',SUPABASE_URL:env.SUPABASE_URL,SUPABASE_SECRET_KEY:env.SUPABASE_SECRET_KEY},{worker:true}).secretKey,env.SUPABASE_SECRET_KEY);
  assert.throws(()=>readConfig({NODE_ENV:'production'},{worker:true}),/worker exige/);
  assert.equal(readConfig({}).trustedProxyHops,0);
});

test('produção ignora .env em disco; desenvolvimento preserva variáveis já definidas',()=>{
  const folder=fs.mkdtempSync(path.join(os.tmpdir(),'fhdod-env-'));
  try{const file=path.join(folder,'.env');fs.writeFileSync(file,'SUPABASE_SECRET_KEY=fixture_em_disco\nPORT=5173\n');
    const production={NODE_ENV:'production',PORT:'10000'};loadEnv(file,production);assert.deepEqual(production,{NODE_ENV:'production',PORT:'10000'});
    const development={PORT:'1234'};loadEnv(file,development);assert.equal(development.PORT,'1234');assert.equal(development.SUPABASE_SECRET_KEY,'fixture_em_disco');
  }finally{fs.unlinkSync(path.join(folder,'.env'));fs.rmdirSync(folder);}
});

test('proxy controlado não aceita prefixo falsificado e separa limites de visitantes',()=>{
  const config=readConfig(env),security=createSecurity(config);
  const req=ip=>({socket:{remoteAddress:'10.0.0.2'},headers:{'x-forwarded-for':ip}});
  const a=req('203.0.113.1'),b=req('203.0.113.2'),forged=req('198.51.100.99, 203.0.113.1');
  assert.equal(clientIp(forged,[],1),'203.0.113.1');
  assert.equal(security.originHash(a),security.originHash(forged));assert.notEqual(security.originHash(a),security.originHash(b));
  security.limit(a,'survey',1,60000);security.limit(b,'survey',1,60000);
  assert.throws(()=>security.limit(forged,'survey',1,60000),e=>e.status===429);
  assert.equal(clientIp(forged),'10.0.0.2');
  assert.throws(()=>clientIp(req('invalid'),[],1),e=>e.status===400);
  assert.throws(()=>clientIp(a,[],2),e=>e.status===400);
});

test('produção serve frontend e API protegidos; QR usa domínio público, sem Host do cliente',async()=>{
  const config=readConfig(env);
  const userId='11111111-1111-4111-8111-111111111111';
  const server=createApplication(config,{logger:()=>{},fetchImpl:async(url)=>{
    const name=new URL(url).pathname.split('/').at(-1);
    const data=name==='user'?{id:userId,role:'authenticated'}:name==='ep_meu_perfil'?{user_id:userId,papel:'super_admin'}:
      name==='ep_tv'?{metricas:[]}:name==='ep_setores'?[{id:userId,slug:'pa',nome:'Pronto Atendimento'}]:null;
    return new Response(JSON.stringify(data));
  }});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const local='http://127.0.0.1:'+server.address().port;
  try{
    const result=await checkDeployment(config.publicOrigin,(url,options)=>fetch(url.replace(config.publicOrigin,local),options));
    assert.equal(result.status,'ok');assert.equal(result.checks,20);
    const response=await fetch(local+'/api/v2/qrcodes',{headers:{Authorization:'Bearer token-fixture',Host:'host-forjado.invalid'}});
    const codes=await response.json();assert.equal(response.status,200);assert.equal(codes[0].url,config.publicOrigin+'/?setor=pa&modo=celular');
    assert.ok(codes.every(c=>!c.url.includes('localhost')&&!c.url.includes('host-forjado')));
    const svg=await fetch(local+'/api/v2/qrcodes/pa/celular',{headers:{Authorization:'Bearer token-fixture'}});
    assert.match(await svg.text(),/<svg/);assert.equal(svg.headers.get('content-type'),'image/svg+xml; charset=utf-8');
    const error=await fetch(local+'/api/v2/painel?inicio=2026-11-01&fim=2026-11-06');
    assert.equal(error.status,401);assert.ok(!(await error.text()).includes(config.secretKey));
  }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
});

test('worker mantém expurgo após falha na TV, evita sobreposição e encerra a tarefa em andamento',async()=>{
  const calls=[],logs=[];
  const worker=startWorker({}, {intervalMs:3600000,run:async(_c,task)=>{calls.push(task);if(task==='tv')throw new Error('SECRET_UPSTREAM');return {contatos_expurgados:0};},log:r=>logs.push(r)});
  try{await worker.ready;assert.deepEqual(calls,['tv','expurgar']);await worker.tick();assert.deepEqual(calls,['tv','expurgar','tv']);assert.ok(!JSON.stringify(logs).includes('SECRET_UPSTREAM'));}
  finally{await worker.stop();}
  let release;const pending=new Promise(resolve=>{release=resolve;});let count=0;
  const waiting=startWorker({}, {intervalMs:3600000,log:()=>{},run:async()=>{count++;await pending;return {};}});
  try{const same=waiting.tick();let stopped=false;const closing=waiting.stop().then(()=>{stopped=true;});await Promise.resolve();assert.equal(stopped,false);assert.equal(count,1);release();await closing;await same;await waiting.tick();assert.equal(count,1);}
  finally{release();await waiting.stop();}
});
