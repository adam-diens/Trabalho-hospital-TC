// Histórico da suíte do frontend v1. Fora de npm test enquanto app.js aguarda migração.
// Não executar contra a API v2: contém as rotas e o contrato anteriores.
// A suíte atual da API está em tests/backend; não grava no banco remoto.
const assert = require('node:assert/strict');
const http = require('node:http');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const calls = [];
const mock = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://mock');
  let raw = ''; for await (const chunk of req) raw += chunk;
  calls.push({ path: url.pathname, body: raw ? JSON.parse(raw) : null });
  const role = req.headers.authorization?.replace('Bearer ', '');
  let data = null;
  if (url.pathname === '/auth/v1/user') data = { id: 'test-user' };
  else if (url.pathname.endsWith('/perfis')) data = ['super_admin', 'admin_setor', 'gestao'].includes(role) ? [{ user_id: 'test-user', perfil: role }] : [];
  else if (url.pathname.endsWith('/setores')) data = [{ id: 1, slug: 'pa', nome: 'Pronto Atendimento' }];
  else if (url.pathname.endsWith('/perguntas')) data = [{ texto: 'Como foi seu atendimento?' }];
  else if (url.pathname.endsWith('/registrar_resposta')) data = 'response-id';
  else if (url.pathname.endsWith('/registrar_contato')) data = 'PROTOCOLO-TESTE';
  else if (url.pathname.endsWith('/painel_resumo')) data = { kpis: { n: 10 }, tendencia: [{ media: 4 }], distribuicao: [{ nota: 5, n: 10 }] };
  else if (url.pathname.endsWith('/listar_manifestacoes')) data = [];
  res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(data));
});
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function waitFor(fn) {
  for (let i = 0; i < 50; i++) { try { const result = await fn(); if (result) return result; } catch {} await pause(100); }
  throw new Error('Tempo excedido aguardando condição de teste.');
}

(async () => {
  await new Promise(resolve => mock.listen(0, '127.0.0.1', resolve));
  const appPort = 15173;
  const base = `http://127.0.0.1:${appPort}`;
  const server = spawn(process.execPath, ['backend/server.cjs'], { env: { ...process.env, PORT: String(appPort), HOST: '127.0.0.1', SUPABASE_URL: `http://127.0.0.1:${mock.address().port}`, SUPABASE_PUBLISHABLE_KEY: 'test-key' }, stdio: 'ignore' });
  let browser, socket, profile;
  try {
    await waitFor(async () => (await fetch(`${base}/api/health`)).ok);
    for (const [token, status] of [[null, 401], ['normal', 403], ['super_admin', 200], ['gestao', 200], ['admin_setor', 200]]) {
      const response = await fetch(`${base}/api/rest/v1/rpc/painel_resumo`, { method: 'POST', headers: token ? { Authorization: `Bearer ${token}` } : {}, body: '{}' });
      assert.equal(response.status, status, `Permissão da API para ${token}`);
    }
    assert.equal((await fetch(`${base}/api/rest/v1/rpc/funcao_desconhecida`, { method: 'POST' })).status, 404);
    console.log('OK: API bloqueia anônimos e contas comuns e permite perfis de gestão.');

    const executable = process.env.EDGE_BIN || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
    if (!fs.existsSync(executable)) throw new Error('Defina EDGE_BIN para executar os testes em navegador.');
    profile = fs.mkdtempSync(path.join(os.tmpdir(), 'fhdod-test-'));
    browser = spawn(executable, ['--headless=new', '--disable-gpu', '--no-first-run', '--remote-debugging-port=19222', `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' });
    const pages = await waitFor(async () => { const r = await fetch('http://127.0.0.1:19222/json', { signal: AbortSignal.timeout(500) }); const p = await r.json(); return p.find(x => x.type === 'page'); });
    socket = new WebSocket(pages.webSocketDebuggerUrl); await once(socket, 'open');
    let id = 0; const pending = new Map();
    socket.addEventListener('message', event => { const message = JSON.parse(event.data); if (pending.has(message.id)) { const { resolve, reject } = pending.get(message.id); pending.delete(message.id); message.error ? reject(message.error) : resolve(message.result); } });
    function cdp(method, params = {}) { return new Promise((resolve, reject) => { const n = ++id; pending.set(n, { resolve, reject }); socket.send(JSON.stringify({ id: n, method, params })); }); }
    async function evaluate(expression) { const result = await cdp('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }); if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails)); return result.result.value; }
    async function navigate(query = '') { await cdp('Page.navigate', { url: base + '/' + query }); await waitFor(() => evaluate('typeof state !== "undefined" && !!document.querySelector("#survey-sector")')); }
    const click = selector => evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);
    await navigate();
    assert.equal(await evaluate('document.querySelector("[data-action=survey-start]").disabled'), true);
    await evaluate('document.querySelector("#survey-sector").value="pa"; document.querySelector("#survey-sector").dispatchEvent(new Event("change"))');
    assert.equal(await evaluate('document.querySelector("[data-action=survey-start]").disabled'), false);
    await click('[data-action=survey-mode][data-value=quick]'); await click('[data-action=survey-start]');
    assert.deepEqual(await evaluate('[...document.querySelectorAll(".face")].map(x=>x.dataset.value)'), ['5','4','3','2','1']);
    await click('[data-action=survey-rating][data-value="1"]');
    await waitFor(() => evaluate('state.survey.step === "thanks"'));
    console.log('OK: primeiro setor habilita imediatamente; rostos 5→1; pesquisa rápida termina após uma nota.');

    await navigate('?setor=pa&modo=celular'); await click('[data-action=survey-start]'); await click('[data-action=survey-rating][data-value="1"]');
    await waitFor(() => evaluate('state.survey.step === "journey-rating"'));
    assert.equal(await evaluate('document.querySelectorAll(".number-rating").length'), 10);
    await click('[data-action=survey-stage-rating][data-value="10"]');
    await waitFor(() => evaluate('state.survey.etapaIndex === 1'));
    assert.equal(calls.find(x => x.path.endsWith('/complementar_resposta'))?.body.p_jornada.recepcao, 10);
    await evaluate('state.survey.step="contact"; renderSurvey(); document.querySelector("#survey-phone").value="51987654321"; document.querySelector("#survey-phone").dispatchEvent(new Event("input", {bubbles:true})); document.querySelector("#survey-note").value="Preservar esta observação"');
    assert.equal(await evaluate('document.querySelector("#survey-phone").value'), '(51) 98765-4321');
    await click('[data-action=contact-submit]');
    await waitFor(() => evaluate('!!document.querySelector("#survey-error").textContent'));
    assert.equal(await evaluate('document.querySelector("#survey-note").value'), 'Preservar esta observação');
    assert.equal(await evaluate('document.querySelector("[data-action=contact-submit]").disabled'), false);
    await evaluate('document.querySelector("#survey-consent").checked=true'); await click('[data-action=contact-submit]');
    await waitFor(() => evaluate('state.survey.step === "thanks"'));
    console.log('OK: escala 1–10 enviada; máscara de telefone; erro de consentimento preserva campos e permite reenviar.');

    for (const width of [320, 375, 768, 1024, 1440]) {
      await cdp('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: width < 600 });
      for (const step of ['welcome', 'rating', 'journey-rating', 'comment', 'contact']) {
        await evaluate(`state.survey.step=${JSON.stringify(step)}; state.survey.etapaIndex=0; renderSurvey()`);
        assert.equal(await evaluate('document.documentElement.scrollWidth <= innerWidth'), true, `Overflow em ${width}px, ${step}`);
      }
    }
    await evaluate('setView("dashboard")'); assert.equal(await evaluate('state.view'), 'patient');
    assert.equal(await evaluate('document.querySelector("[data-view=dashboard]").classList.contains("hidden")'), true);
    await evaluate('saveSession({access_token:"gestao", user:{id:"test-user"}}); state.profile={perfil:"gestao"}; syncNavigation(); setView("dashboard")');
    await waitFor(() => evaluate('document.querySelector("#kpis").textContent.includes("10")'));
    for (const width of [320, 768, 1440]) {
      await cdp('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: width < 600 });
      assert.equal(await evaluate('document.documentElement.scrollWidth <= innerWidth'), true, `Gestão em ${width}px`);
    }
    await evaluate('setView("qrs")');
    assert.equal(await evaluate('document.querySelectorAll(".qr-card").length'), 12);
    assert.equal(await evaluate('new Set([...document.querySelectorAll(".qr-card button")].map(x=>x.dataset.value)).size'), 12);
    await evaluate('signOut()'); assert.equal(await evaluate('document.querySelector("#kpis").innerHTML'), '');
    await navigate('?setor=pa&modo=tablet'); assert.equal(await evaluate('state.survey.mode'), 'quick');
    console.log('OK: layouts de 320 a 1440px; gestão protegida; 12 destinos QR distintos; logout limpa indicadores; tablet abre fluxo rápido.');
  } finally {
    socket?.close(); browser?.kill(); server.kill(); mock.close();
    // Perfil temporário é removido pelo SO; não remover diretórios recursivamente durante os testes.
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
