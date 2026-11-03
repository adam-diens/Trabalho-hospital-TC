const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');
loadEnv(path.join(projectRoot, '.env'));

const supabaseUrl = String(process.env.SUPABASE_URL || '').replace(/\/$/, '');
const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY || '';
const port = Number(process.env.PORT || 5173);
const host = process.env.HOST || '127.0.0.1';
const mimeTypes = {
  '.css': 'text/css; charset=utf-8', '.html': 'text/html; charset=utf-8',
  '.jpg': 'image/jpeg', '.js': 'text/javascript; charset=utf-8', '.png': 'image/png',
  '.svg': 'image/svg+xml', '.yaml': 'text/yaml; charset=utf-8', '.yml': 'text/yaml; charset=utf-8',
};

function loadEnv(file) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match || match[1] in process.env) continue;
    const value = match[2].replace(/^(['"])(.*)\1$/, '$2');
    process.env[match[1]] = value;
  }
}

function sendJson(response, status, data) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  response.end(JSON.stringify(data));
}

function proxyPath(pathname) {
  if (/^\/api\/auth\/v1\/(?:token|signup)$/.test(pathname)) return pathname.slice(4);
  if (/^\/api\/rest\/v1\/(?:rpc\/[a-z_]+|[a-z_]+)$/.test(pathname)) return pathname.slice(4);
  return null;
}

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`);

  if (url.pathname === '/api/health') return sendJson(response, 200, { status: 'ok', service: 'fhdod-api' });

  const upstreamPath = proxyPath(url.pathname);
  if (url.pathname.startsWith('/api/')) {
    if (!upstreamPath) return sendJson(response, 404, { error: 'Rota da API não encontrada.' });
    if (!supabaseUrl || !publishableKey) return sendJson(response, 503, { error: 'API não configurada. Verifique SUPABASE_URL e SUPABASE_PUBLISHABLE_KEY no .env.' });
    const isAuth = /^\/api\/auth\/v1\/(?:token|signup)$/.test(url.pathname);
    const isRpc = url.pathname.startsWith('/api/rest/v1/rpc/');
    const allowedMethod = isAuth || isRpc ? 'POST' : 'GET';
    if (request.method !== allowedMethod) return sendJson(response, 405, { error: 'Método não permitido para esta rota.' });

    try {
      const chunks = [];
      for await (const chunk of request) chunks.push(chunk);
      const headers = { apikey: publishableKey, Accept: 'application/json' };
      if (request.headers.authorization) headers.Authorization = request.headers.authorization;
      if (request.headers['content-type']) headers['Content-Type'] = request.headers['content-type'];
      const upstream = await fetch(`${supabaseUrl}${upstreamPath}${url.search}`, {
        method: request.method, headers,
        ...(chunks.length && !['GET', 'HEAD'].includes(request.method) ? { body: Buffer.concat(chunks) } : {}),
      });
      const body = Buffer.from(await upstream.arrayBuffer());
      response.writeHead(upstream.status, {
        'Content-Type': upstream.headers.get('content-type') || 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
      });
      response.end(body);
    } catch (error) {
      const reason = error?.cause?.code || error?.cause?.message || error?.message || 'unknown error';
      process.stderr.write(`Supabase upstream request failed: ${reason}\n`);
      sendJson(response, 502, { error: 'Não foi possível comunicar com o serviço de dados.' });
    }
    return;
  }

  let pathname;
  try { pathname = decodeURIComponent(url.pathname); }
  catch { response.writeHead(400).end('Bad request'); return; }
  const filePath = path.resolve(projectRoot, `.${pathname}`);
  if (filePath !== projectRoot && !filePath.startsWith(`${projectRoot}${path.sep}`)) {
    response.writeHead(403).end('Forbidden'); return;
  }
  const target = pathname.endsWith('/') ? path.join(filePath, 'index.html') : filePath;
  if (path.basename(target).startsWith('.env') || target === path.join(projectRoot, 'supabase-config.js')) {
    response.writeHead(404).end('Not found'); return;
  }
  fs.readFile(target, (error, contents) => {
    if (error) { response.writeHead(error.code === 'ENOENT' ? 404 : 500).end('File not found'); return; }
    response.writeHead(200, { 'Content-Type': mimeTypes[path.extname(target)] || 'application/octet-stream' });
    response.end(contents);
  });
});

server.listen(port, host, () => process.stdout.write(`FHDOD app/API em http://${host}:${port}\n`));
