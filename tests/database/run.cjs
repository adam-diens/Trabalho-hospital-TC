// PostgreSQL real, cluster descartável. Nunca usa DATABASE_URL nem banco remoto.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const net = require('node:net');
const { spawnSync, spawn } = require('node:child_process');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');

const root = path.resolve(__dirname, '../..');
const isWin = process.platform === 'win32';
const ext = isWin ? '.exe' : '';
function findBin() {
  const candidates = [process.env.PG_BIN];
  if (isWin) {
    const base = 'C:/Program Files/PostgreSQL';
    if (fs.existsSync(base)) for (const version of fs.readdirSync(base).sort().reverse()) candidates.push(path.join(base, version, 'bin'));
  }
  for (const p of candidates.filter(Boolean)) if (fs.existsSync(path.join(p, `initdb${ext}`))) return p;
  const locate = spawnSync(isWin ? 'where.exe' : 'which', ['initdb'], { encoding: 'utf8' });
  if (locate.status === 0) return path.dirname(locate.stdout.trim().split(/\r?\n/)[0]);
  throw new Error('PostgreSQL 15+ não encontrado. Defina PG_BIN apontando para a pasta de initdb, pg_ctl e psql.');
}
function run(bin, name, args, options = {}) {
  const result = spawnSync(path.join(bin, name + ext), args, {
    encoding: 'utf8', timeout: 60000, windowsHide: true,
    env: { ...process.env, PGCLIENTENCODING: 'UTF8' }, ...options,
  });
  if (result.error || result.status !== 0) throw new Error(`${name}: ${result.error?.message || result.stderr || result.stdout}`);
  return result.stdout;
}
async function freePort() {
  const listener = net.createServer();
  await new Promise((resolve, reject) => { listener.once('error', reject); listener.listen(0, '127.0.0.1', resolve); });
  const port = listener.address().port;
  await new Promise(resolve => listener.close(resolve));
  return port;
}
(async () => {
  const bin = findBin();
  const parent = fs.realpathSync(os.tmpdir());
  const temp = fs.mkdtempSync(path.join(parent, 'fhdod-db-test-'));
  const data = path.join(temp, 'data');
  const port = await freePort();
  let started = false, passed = false;
  const sqlArgs = ['-X', '-q', '-A', '-t', '-v', 'ON_ERROR_STOP=1', '-h', '127.0.0.1', '-p', String(port), '-U', 'ep_test_owner', '-d', 'postgres'];
  function sqlFile(file) { return run(bin, 'psql', [...sqlArgs, '-f', file]); }
  function query(statement) { return run(bin, 'psql', [...sqlArgs, '-c', statement]).trim(); }
  function inDatabase(database, extra) { return run(bin, 'psql', [...sqlArgs.slice(0, -1), database, ...extra]).trim(); }
  function concurrentQuery(statement) {
    return new Promise((resolve, reject) => {
      const child = spawn(path.join(bin, 'psql' + ext), [...sqlArgs, '-c', statement], {
        windowsHide: true, env: { ...process.env, PGCLIENTENCODING: 'UTF8' }, stdio: ['ignore', 'pipe', 'pipe'],
      });
      let stdout = '', stderr = '';
      const timer = setTimeout(() => { child.kill(); reject(new Error('Timeout em teste de concorrência')); }, 15000);
      child.stdout.on('data', data => { stdout += data; });
      child.stderr.on('data', data => { stderr += data; });
      child.on('error', error => { clearTimeout(timer); reject(error); });
      child.on('close', code => { clearTimeout(timer); resolve({ code, stdout: stdout.trim(), stderr }); });
    });
  }
  try {
    run(bin, 'initdb', ['-D', data, '-A', 'trust', '--no-locale', '--encoding=UTF8', '-U', 'ep_test_owner']);
    started = true;
    run(bin, 'pg_ctl', ['-D', data, '-l', path.join(temp, 'postgres.log'), '-o', `-h 127.0.0.1 -p ${port} -F`, '-w', 'start'], { stdio: 'ignore' });
    sqlFile(path.join(__dirname, 'bootstrap.sql'));
    const dir = path.join(root, 'supabase/migrations');
    for (const file of fs.readdirSync(dir).filter(f => f.endsWith('.sql')).sort()) {
      sqlFile(path.join(dir, file)); console.log(`OK: migration ${file}`);
    }
    const checks = sqlFile(path.join(__dirname, 'contrato.sql')).split(/\r?\n/).filter(line => line.startsWith('OK:'));
    console.log(`OK: ${checks.length} verificações funcionais e de autorização em PostgreSQL real.`);
    const catalog = sqlFile(path.join(root, 'supabase/operacoes/verificar_instalacao.sql')).trim().split(/\r?\n/);
    if (catalog.some(line => !line.endsWith('|t'))) throw new Error(`Verificação do catálogo falhou:\n${catalog.join('\n')}`);
    console.log(`OK: ${catalog.length} verificações de catálogo, RLS, grants e search_path.`);
    const build = spawnSync(process.execPath, [path.join(root, 'scripts/build-database.cjs')], { cwd: root, encoding: 'utf8', windowsHide: true });
    assert.equal(build.status, 0, build.stderr);
    query('create database ep_bundle');
    inDatabase('ep_bundle', ['-f', path.join(__dirname, 'bootstrap.sql')]);
    inDatabase('ep_bundle', ['-f', path.join(root, 'output/database/instalar.sql')]);
    const bundleChecks = inDatabase('ep_bundle', ['-f', path.join(root, 'supabase/operacoes/verificar_instalacao.sql')]);
    assert.ok(bundleChecks.split(/\r?\n/).every(line => line.endsWith('|t')), bundleChecks);
    const fingerprint = `select md5(string_agg(item,E'\\n' order by item)) from (
      select n.nspname||'.'||p.proname||':'||pg_get_functiondef(p.oid)||':'||p.proacl::text item
        from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='hospital' or (n.nspname='public' and p.proname like 'ep_%')
      union all select table_schema||'.'||table_name||'.'||column_name||':'||data_type||':'||is_nullable
        from information_schema.columns where table_schema='hospital'
      union all select c.relname||':'||pg_get_constraintdef(k.oid) from pg_constraint k join pg_class c on c.oid=k.conrelid
        join pg_namespace n on n.oid=c.relnamespace where n.nspname='hospital'
      union all select indexname||':'||indexdef from pg_indexes where schemaname='hospital') x`;
    assert.equal(query(fingerprint), inDatabase('ep_bundle', ['-c', fingerprint]));
    console.log('OK: instalador único instala em outro banco limpo com o mesmo catálogo das migrations.');
    const qid = query("select q.id from hospital.questionarios q join hospital.setores s on s.id=q.setor_id where s.slug='rx' and q.publicado");
    assert.match(qid, /^[a-f0-9-]{36}$/);
    const key = randomUUID();
    const identical = `set role service_role; select public.ep_enviar_pesquisa('${key}','${qid}',4,'celular',repeat('9',64),'teste-v1','{}','sugestao','Teste concorrente sem identificacao.');`;
    const duplicates = await Promise.all(Array.from({ length: 8 }, () => concurrentQuery(identical)));
    assert.ok(duplicates.every(r => r.code === 0), duplicates.map(r => r.stderr).join('\n'));
    assert.equal(new Set(duplicates.map(r => r.stdout)).size, 1);
    assert.equal(query(`select count(*) from hospital.respostas where chave_envio='${key}'`), '1');
    console.log('OK: 8 envios concorrentes idênticos geram uma resposta e um protocolo.');
    query('update hospital.configuracao set limite_origem_10min=1 where id');
    const keys = Array.from({ length: 8 }, randomUUID);
    const limited = await Promise.all(keys.map(k => concurrentQuery(
      `set role service_role; select public.ep_enviar_pesquisa('${k}','${qid}',4,'tablet',repeat('8',64),'teste-v1');`)));
    assert.equal(limited.filter(r => r.code === 0).length, 1);
    assert.ok(limited.filter(r => r.code !== 0).every(r => /Limite temporário/.test(r.stderr)));
    assert.equal(query(`select count(*) from hospital.respostas where chave_envio in (${keys.map(k => `'${k}'`).join(',')})`), '1');
    console.log('OK: limite de origem resiste a 8 sessões concorrentes sem gravações parciais.');
    const { databaseIntegration } = require('../backend/database-integration.cjs');
    await databaseIntegration({ psql: path.join(bin, 'psql' + ext), args: sqlArgs });
    query('create table public.setores(id int)');
    assert.throws(() => sqlFile(path.join(dir, '202611060001_core.sql')), /Banco legado detectado/);
    console.log('OK: instalação recusa banco legado e não altera os schemas existentes.');
    passed = true;
  } finally {
    if (started) run(bin, 'pg_ctl', ['-D', data, '-m', 'immediate', '-w', 'stop'], { stdio: 'ignore' });
    // Só remove o diretório criado por esta execução, após conferir caminho absoluto.
    const actual = fs.realpathSync(temp);
    if (passed && path.dirname(actual).toLowerCase() === parent.toLowerCase() && path.basename(actual).startsWith('fhdod-db-test-')) {
      fs.rmSync(actual, { recursive: true });
    } else console.log(`Diagnóstico preservado em ${temp}`);
  }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
