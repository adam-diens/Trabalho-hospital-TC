const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { ApiError } = require('./errors.cjs');
const { createSupabase } = require('./supabase.cjs');
const { createSecurity, securityHeaders } = require('./security.cjs');
const { matchRoutes, mapRpc, exportFields } = require('./routes.cjs');
const v = require('./validation.cjs');
const { openapi } = require('./openapi.cjs');

const projectRoot = path.resolve(__dirname, '..');
const exportColumns = ['id', 'setor', 'criado_em', 'data_local', 'turno', 'canal', 'metrica', 'nota', 'questionario_versao', 'tipo', 'etapas'];
function exportRows(data) {
  if (!Array.isArray(data)) throw new ApiError(502, 'UPSTREAM_INVALID', 'Exportação inválida.');
  return data.map(row => Object.fromEntries(exportColumns.map(key => [key, row[key] ?? null])));
}
function csvCell(value) {
  let text = typeof value === 'object' && value !== null ? JSON.stringify(value) : String(value ?? '');
  if (/^[\s\u0000-\u001f]*[=+\-@]/.test(text) || /^[\t\r\n]/.test(text)) text = "'" + text;
  return '"' + text.replace(/"/g, '""') + '"';
}
function sendJson(response, status, data, headers = {}) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', ...headers });
  response.end(JSON.stringify(data));
}
function readBody(request, maxBytes) {
  if (request.headers['content-encoding'] && request.headers['content-encoding'] !== 'identity') {
    request.resume(); throw new ApiError(415, 'UNSUPPORTED_ENCODING', 'Corpo comprimido não é aceito.');
  }
  if (!/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(request.headers['content-type'] || '')) {
    request.resume(); throw new ApiError(415, 'JSON_REQUIRED', 'Envie o corpo como application/json.');
  }
  if (Number(request.headers['content-length']) > maxBytes) {
    request.resume(); throw new ApiError(413, 'BODY_TOO_LARGE', 'Requisição maior que o limite permitido.');
  }
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    const cleanup = () => { request.off('data', onData); request.off('end', onEnd); request.off('error', onError); request.off('aborted', onAbort); };
    function onError() { cleanup(); reject(new ApiError(400, 'BODY_INTERRUPTED', 'Envio interrompido.')); }
    function onAbort() { onError(); }
    function onData(chunk) {
      size += chunk.length;
      if (size > maxBytes) {
        cleanup(); request.resume(); reject(new ApiError(413, 'BODY_TOO_LARGE', 'Requisição maior que o limite permitido.'));
      } else chunks.push(chunk);
    }
    function onEnd() {
      cleanup();
      try { resolve(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks)))); }
      catch { reject(new ApiError(400, 'INVALID_JSON', 'JSON inválido ou corpo vazio.')); }
    }
    request.on('data', onData); request.on('end', onEnd); request.on('error', onError); request.on('aborted', onAbort);
  });
}
function semantics(route, data) {
  if (data.inicio && data.fim) v.period(data, route.rpc === 'ep_listar_escalas' ? 93 : 366);
  if (route.action === 'pesquisa') {
    const comment = data.comentario?.trim();
    if (Boolean(data.tipo) !== Boolean(comment)) throw new ApiError(400, 'MANIFESTATION_INVALID', 'Informe tipo e comentário juntos.');
    const digits = data.telefone?.replace(/\D/g, '');
    if (data.telefone && (!/^[1-9][0-9]{9,10}$/.test(digits) || data.consentimento !== true)) {
      throw new ApiError(400, 'CONSENT_REQUIRED', 'Informe telefone com DDD e consentimento explícito para retorno.');
    }
    if (data.consentimento === true && !digits) throw new ApiError(400, 'PHONE_REQUIRED', 'Consentimento de retorno exige telefone.');
  }
  if (route.rpc === 'ep_publicar_questionario') {
    if (data.limite_ouvidoria >= (data.metrica === 'rostos_5' ? 5 : 10)) throw new ApiError(400, 'INVALID_THRESHOLD', 'Limiar de Ouvidoria fora da escala.');
    const keys = (data.etapas || []).map(e => e.chave);
    if (keys.includes('geral') || new Set(keys).size !== keys.length) throw new ApiError(400, 'DUPLICATE_STAGE', 'Use chaves únicas nas etapas, reservando geral para a pergunta obrigatória.');
  }
  if (route.rpc === 'ep_definir_perfil' && ((data.papel === 'admin_setor' && !data.setor) || (data.papel !== 'admin_setor' && data.setor))) {
    throw new ApiError(400, 'INVALID_ROLE_SECTOR', 'Somente o administrador de setor deve ter um setor atribuído.');
  }
  if(route.rpc==='ep_decidir_solicitacao' && (data.decisao==='aprovar'
    ? (!data.papel || data.motivo!==undefined || (data.papel==='admin_setor'?!data.setor:!!data.setor))
    : (data.papel!==undefined || data.setor!==undefined || !data.motivo?.trim() || data.motivo.trim().length<3))) {
    throw new ApiError(400,'INVALID_APPROVAL','Escolha o perfil e o setor na aprovação, ou informe somente o motivo da rejeição.');
  }
}
function createApplication(config, { fetchImpl = fetch, logger = record => process.stdout.write(JSON.stringify(record) + '\n') } = {}) {
  const db = createSupabase(config, fetchImpl);
  const security = createSecurity(config);
  const activeStreams = new Map();
  const activeExports = new Set();
  async function identity(request, access) {
    const header = request.headers.authorization || '';
    if (!/^Bearer [^\s]{1,8192}$/i.test(header)) throw new ApiError(401, 'AUTH_REQUIRED', 'Entre com sua conta institucional.');
    const token = header.slice(7);
    if (token === config.secretKey || token === config.publishableKey) throw new ApiError(401, 'INVALID_SESSION', 'Use a sessão de um usuário institucional.');
    const user = await db.auth('user', { token, method: 'GET', authAction: 'user' });
    if (!user?.id || user.is_anonymous || (user.role && user.role !== 'authenticated')) throw new ApiError(401, 'INVALID_SESSION', 'Sessão institucional inválida.');
    let profile;
    if (access) {
      profile = await db.rpc('ep_meu_perfil', {}, { token });
      if (!profile || profile.user_id !== user.id || !access.includes(profile.papel) || (profile.papel === 'admin_setor' && !profile.setor_id)) {
        throw new ApiError(403, 'FORBIDDEN', 'Sua conta não possui o perfil necessário para esta operação.');
      }
    }
    return { token, user, profile };
  }
  async function stream(request, response, route, data, actor) {
    const id = actor.user.id;
    const count = activeStreams.get(id) || 0;
    if (count >= 3) throw new ApiError(429, 'STREAM_LIMIT', 'Limite de painéis simultâneos atingido.', { 'Retry-After': '30' });
    activeStreams.set(id, count + 1);
    let closed = false, timer;
    const finish = () => {
      if (closed) return; closed = true; clearTimeout(timer); clearTimeout(deadline);
      const current = activeStreams.get(id) || 1;
      if (current <= 1) activeStreams.delete(id); else activeStreams.set(id, current - 1);
      response.end();
    };
    const deadline = setTimeout(finish, config.streamMaxMs);
    response.once('close', finish);
    response.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-store', 'X-Accel-Buffering': 'no' });
    response.write('retry: 15000\n\n');
    async function tick() {
      if (closed) return;
      try {
        const current = await identity(request, route.access);
        const result = await db.rpc('ep_painel', mapRpc({ fields: { inicio: 'p_inicio', fim: 'p_fim', setor: 'p_setor', turno: 'p_turno', equipe: 'p_equipe' } }, data), { token: current.token });
        if (closed) return;
        if (!response.write(`event: painel\ndata: ${JSON.stringify(result)}\n\n`)) { finish(); return; }
        timer = setTimeout(tick, config.streamIntervalMs);
      } catch (error) {
        if (!closed) response.write(`event: erro\ndata: ${JSON.stringify({ code: error.code || 'INTERNAL_ERROR', message: error instanceof ApiError ? error.message : 'Atualização indisponível.' })}\n\n`);
        finish();
      }
    }
    await tick();
  }
  async function action(route, data, params, request, response, actor) {
    const token = actor?.token;
    if (actor?.profile?.papel === 'admin_setor' && data.setor && data.setor !== actor.profile.setor_id) throw new ApiError(403, 'SECTOR_DENIED', 'Seu perfil só pode operar o próprio setor.');
    if (route.rpc) {
      let result = await db.rpc(route.rpc, mapRpc(route, data), { token });
      if (route.rpc === 'ep_exportar') result = exportRows(result);
      if (Array.isArray(result) && result.length) {
        const cursor = route.rpc === 'ep_listar_manifestacoes' ? result.at(-1).protocolo :
          route.rpc === 'ep_auditoria' ? result.at(-1).id : ['ep_listar_perfis','ep_listar_solicitacoes'].includes(route.rpc) ? result.at(-1).user_id : result.at(-1).id;
        if (cursor !== undefined) response.setHeader('X-Next-Cursor', String(cursor));
      }
      return result;
    }
    switch (route.action) {
      case 'formulario':
        v.validate(params.slug, v.string(2, 40, { pattern: '^[a-z][a-z0-9_-]{1,39}$' }), 'setor');
        return db.rpc('ep_formulario', { p_setor: params.slug });
      case 'pesquisa': {
        const origem = security.originHash(request, true);
        return db.rpc('ep_enviar_pesquisa', {
          p_chave_envio: data.chave_envio, p_questionario: data.questionario_id, p_nota: data.nota,
          p_canal: data.canal, p_origem_hash: origem, p_privacidade_versao: data.privacidade_versao,
          p_etapas: data.etapas || {}, p_tipo: data.tipo ?? null, p_comentario: data.comentario ?? null,
          p_telefone: data.telefone ?? null, p_consentimento: data.consentimento ?? false,
        }, { operational: true });
      }
      case 'me': return actor.profile;
      case 'signin': case 'refresh': {
        const signin = route.action === 'signin';
        const session = await db.auth(`token?grant_type=${signin ? 'password' : 'refresh_token'}`, {
          authAction: signin ? 'signin' : 'refresh',
          body: signin ? { email: data.email.trim(), password: data.senha } : { refresh_token: data.refresh_token },
        });
        if (!session?.access_token || !session.refresh_token || !session.user?.id) throw new ApiError(502, 'UPSTREAM_INVALID', 'Sessão inválida retornada pelo serviço.');
        let profile;
        try {profile = await db.rpc('ep_meu_perfil', {}, { token: session.access_token });}
        catch(error){if(error.status===403)throw new ApiError(403,'ACCESS_NOT_APPROVED','Sua conta ainda não tem acesso aprovado ou foi desativada. Aguarde a análise do Super Admin.');throw error;}
        if (!profile || profile.user_id !== session.user.id) throw new ApiError(403, 'FORBIDDEN', 'Conta sem perfil institucional ativo.');
        return { access_token: session.access_token, refresh_token: session.refresh_token,
          expires_at: session.expires_at, expires_in: session.expires_in, token_type: 'bearer', perfil: profile };
      }
      case 'signup':
        if (!config.allowSignup) throw new ApiError(403, 'SIGNUP_DISABLED', 'Cadastro público desabilitado. Solicite uma conta ao administrador.');
        await db.auth('signup', { authAction: 'signup', body: { email: data.email.trim(), password: data.senha, data: { name: data.nome.trim() } } });
        response.statusCode = 202;
        return { message: 'Se o cadastro for elegível, confirme seu e-mail quando solicitado e aguarde a análise do Super Admin. Criar a conta não libera acesso à gestão.' };
      case 'recover':
        if (!config.authRedirectUrl) throw new ApiError(503, 'RECOVERY_NOT_CONFIGURED', 'Recuperação de senha não configurada.');
        try { await db.auth('recover?redirect_to=' + encodeURIComponent(config.authRedirectUrl), { authAction: 'recover', body: { email: data.email.trim() } }); }
        catch (error) { if (!(error instanceof ApiError) || error.status >= 500 || error.status === 429) throw error; }
        response.statusCode = 202;
        return { message: 'Se houver uma conta elegível, as instruções de recuperação serão enviadas ao e-mail.' };
      case 'logout':
        await db.auth('logout?scope=local', { token, authAction: 'logout' });
        return { message: 'Sessão encerrada. Remova os tokens armazenados neste dispositivo.' };
      case 'password':
        await db.auth('user', { token, method: 'PUT', authAction: 'password', body: { password: data.senha, ...(data.nonce ? { nonce: data.nonce } : {}) } });
        return { message: 'Senha atualizada.' };
      case 'manifestacao': {
        v.validate(params.id, v.uuid, 'id');
        const result = await db.rpc('ep_detalhar_manifestacao', { p_id: params.id }, { token });
        if (result && !['super_admin', 'ouvidoria'].includes(actor.profile.papel)) {
          result.telefone = null; result.consentimento_em = null; result.interacoes = [];
        }
        return result;
      }
      case 'atender':
        v.validate(params.id, v.uuid, 'id');
        return { revisao: await db.rpc('ep_atender_manifestacao', { p_id: params.id, p_revisao: data.revisao, p_situacao: data.situacao, p_relato: data.relato }, { token }) };
      case 'csv': {
        if (activeExports.size >= 2 || activeExports.has(actor.user.id)) throw new ApiError(429, 'EXPORT_BUSY', 'Há uma exportação em andamento. Aguarde antes de iniciar outra.', { 'Retry-After': '30' });
        activeExports.add(actor.user.id);
        let released = false;
        const release = () => { if (!released) { released = true; activeExports.delete(actor.user.id); } };
        response.once('finish', release); response.once('close', release);
        const rows = []; let cursor;
        for (;;) {
          if (response.destroyed) throw new ApiError(499, 'CLIENT_CLOSED', 'Conexão encerrada.');
          const page = exportRows(await db.rpc('ep_exportar', {
            ...mapRpc({ fields: exportFields }, data), p_limite: 500, ...(cursor ? { p_depois: cursor } : {}),
          }, { token }));
          if (!page.length) break;
          if (rows.length + page.length > config.maxExportRows) throw new ApiError(422, 'EXPORT_TOO_LARGE', 'Reduza o período ou use a exportação JSON paginada.');
          const next = page.at(-1).id;
          if (!next || next === cursor) throw new ApiError(502, 'UPSTREAM_INVALID', 'Cursor de exportação inválido.');
          rows.push(...page); cursor = next;
          if (page.length < 500) break;
        }
        const csv = '\ufeff' + [exportColumns.join(';'), ...rows.map(row => exportColumns.map(key => csvCell(row[key])).join(';'))].join('\r\n');
        response.writeHead(200, { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="respostas-${data.inicio}-${data.fim}.csv"` });
        response.end(csv); return;
      }
      case 'qrcodes': case 'qr-svg': {
        if (!config.publicOrigin) throw new ApiError(503, 'PUBLIC_ORIGIN_REQUIRED', 'Configure o endereço público para gerar os links.');
        const sectors = await db.rpc('ep_setores');
        const allowed = actor.profile.papel === 'admin_setor' ? sectors.filter(s => s.id === actor.profile.setor_id) : sectors;
        if (route.action === 'qr-svg') {
          const canal = params.canal;
          v.validate(canal, v.enumeration(['celular', 'tablet']), 'canal');
          const sector = allowed.find(s => s.slug === params.slug);
          if (!sector) throw new ApiError(403, 'SECTOR_DENIED', 'Setor não autorizado.');
          const QRCode = require('qrcode');
          const url = `${config.publicOrigin}/?${new URLSearchParams({ setor: sector.slug, modo: canal })}`;
          const svg = await QRCode.toString(url, { type: 'svg', width: 280, margin: 4, errorCorrectionLevel: 'M' });
          response.writeHead(200, { 'Content-Type': 'image/svg+xml; charset=utf-8', 'Content-Disposition': `inline; filename="pesquisa-${sector.slug}-${canal}.svg"` });
          response.end(svg); return;
        }
        return allowed.flatMap(sector => ['celular', 'tablet'].map(canal => ({
          setor_id: sector.id, setor: sector.nome, canal, url: `${config.publicOrigin}/?${new URLSearchParams({ setor: sector.slug, modo: canal })}`,
        })));
      }
      case 'stream': await stream(request, response, route, data, actor); return;
      default: throw new ApiError(404, 'NOT_FOUND', 'Rota não encontrada.');
    }
  }
  const server = http.createServer(async (request, response) => {
    request.on('error', () => {}); // Conexões interrompidas não devem derrubar o processo.
    const requestId = crypto.randomUUID(); const start = Date.now();
    securityHeaders(response, config.production); response.setHeader('X-Request-Id', requestId);
    let routeName = 'unknown';
    response.once('finish', () => logger({ request_id: requestId, method: request.method, route: routeName, status: response.statusCode, duration_ms: Date.now() - start }));
    try {
      if (request.url.length > 4096) throw new ApiError(414, 'URL_TOO_LONG', 'Endereço muito longo.');
      const url = new URL(request.url, 'http://localhost');
      if (url.pathname === '/api/health' && request.method === 'GET') {
        routeName = '/api/health'; return sendJson(response, 200, { status: 'ok', service: 'fhdod-api', version: '2.0.0' });
      }
      if (url.pathname.startsWith('/api/')) {
        security.checkOrigin(request, response);
        security.limit(request, 'api', config.readLimit, 60000);
        if (url.pathname === '/api/ready' && request.method === 'GET') {
          routeName = '/api/ready';
          if (!config.secretKey || !config.originSecret || !config.publicOrigin) throw new ApiError(503, 'NOT_CONFIGURED', 'Configuração operacional incompleta.');
          await db.rpc('ep_setores'); return sendJson(response, 200, { status: 'ready' });
        }
        if (url.pathname === '/api/openapi.json' && request.method === 'GET') { routeName = '/api/openapi.json'; return sendJson(response, 200, openapi); }
        const candidates = matchRoutes(url.pathname);
        if (!candidates.length) throw new ApiError(url.pathname.startsWith('/api/rest/') || url.pathname.startsWith('/api/auth/v1/') ? 410 : 404,
          'NOT_FOUND', 'Rota indisponível. Use o contrato /api/v2.');
        const allowed = [...new Set(candidates.map(c => c.route.method))];
        if (request.method === 'OPTIONS') {
          const method = request.headers['access-control-request-method'];
          const headers = (request.headers['access-control-request-headers'] || '').toLowerCase().split(',').map(s => s.trim()).filter(Boolean);
          if ((method && !allowed.includes(method)) || headers.some(h => !['authorization', 'content-type'].includes(h))) throw new ApiError(403, 'CORS_DENIED', 'Preflight não autorizado.');
          response.writeHead(204, { 'Access-Control-Allow-Methods': allowed.join(', '), 'Access-Control-Allow-Headers': 'Authorization, Content-Type' }); response.end(); return;
        }
        const selected = candidates.find(c => c.route.method === request.method);
        if (!selected) throw new ApiError(405, 'METHOD_NOT_ALLOWED', 'Método não permitido.', { Allow: allowed.join(', ') });
        const { route, params } = selected; routeName = route.path;
        if (route.path.includes('/auth/')) security.limit(request, 'auth', config.authLimit, 600000);
        if (route.action === 'pesquisa') security.limit(request, 'survey', config.surveyLimit, 600000);
        const query = v.queryValues(url.searchParams, route.query);
        const data = route.body ? v.validate(await readBody(request, config.maxBodyBytes), route.body) : query;
        if (!route.body && (Number(request.headers['content-length']) > 0 || request.headers['transfer-encoding'])) {
          request.resume(); throw new ApiError(400, 'BODY_NOT_ALLOWED', 'Esta rota recebe parâmetros na consulta, sem corpo.');
        }
        semantics(route, data);
        const actor = route.access || route.authenticated ? await identity(request, route.access) : null;
        const result = await action(route, data, params, request, response, actor);
        if (!response.headersSent) sendJson(response, response.statusCode || 200, result ?? { ok: true });
        return;
      }
      // Allowlist pública. Nunca servir .git, .env, backend, SQLs, testes ou backups.
      if (!['GET', 'HEAD'].includes(request.method)) throw new ApiError(405, 'METHOD_NOT_ALLOWED', 'Método não permitido.', { Allow: 'GET, HEAD' });
      let pathname;
      try { pathname = decodeURIComponent(url.pathname); } catch { throw new ApiError(400, 'BAD_PATH', 'Endereço inválido.'); }
      const publicFiles = { '/': 'index.html', '/index.html': 'index.html', '/app.js': 'app.js', '/styles.css': 'styles.css', '/tablet.css': 'tablet.css' };
      let relative = publicFiles[pathname];
      if (!relative && /^\/assets\/js\/(?:api|ui|patient|management|admin)\.js$/.test(pathname)) relative = pathname.slice(1);
      if (!relative && /^\/assets\/(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_-]+\.(?:png|jpg|jpeg|svg|webp|ico)$/.test(pathname)) relative = pathname.slice(1);
      if (!relative) throw new ApiError(404, 'NOT_FOUND', 'Arquivo não encontrado.');
      const file = await fs.realpath(path.join(projectRoot, relative)).catch(() => null);
      const allowedRoot = relative.startsWith('assets/') ? await fs.realpath(path.join(projectRoot, 'assets')) : projectRoot;
      if (!file || (relative.startsWith('assets/') ? !file.startsWith(allowedRoot + path.sep) : file !== path.join(projectRoot, relative))) throw new ApiError(404, 'NOT_FOUND', 'Arquivo não encontrado.');
      const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.ico': 'image/x-icon' };
      routeName = relative.startsWith('assets/') ? '/assets/*' : pathname;
      response.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data: blob:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
      const content = await fs.readFile(file);
      response.writeHead(200, { 'Content-Type': types[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Content-Length': content.length });
      response.end(request.method === 'HEAD' ? undefined : content);
    } catch (error) {
      if (response.headersSent) { if (!response.writableEnded) response.end(); return; }
      const known = error instanceof ApiError;
      request.resume();
      sendJson(response, known ? error.status : 500, { error: { code: known ? error.code : 'INTERNAL_ERROR',
        message: known ? error.message : 'Não foi possível concluir a operação.', request_id: requestId } }, known ? error.headers : {});
    }
  });
  server.requestTimeout = 15000; server.headersTimeout = 10000; server.keepAliveTimeout = 5000; server.maxHeadersCount = 100;
  return server;
}
module.exports = { createApplication, csvCell, semantics };
