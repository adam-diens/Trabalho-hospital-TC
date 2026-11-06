const crypto = require('node:crypto');
const net = require('node:net');
const { ApiError } = require('./errors.cjs');

const normalizeIp = ip => ip?.startsWith('::ffff:') ? ip.slice(7) : ip;
function clientIp(request, trustedProxies = []) {
  const peer = normalizeIp(request.socket.remoteAddress);
  const trusted = new Set(trustedProxies.map(normalizeIp));
  if (!trusted.has(peer) || !request.headers['x-forwarded-for']) return peer;
  const chain = String(request.headers['x-forwarded-for']).split(',').map(s => normalizeIp(s.trim()));
  if (chain.length > 10 || chain.some(ip => !net.isIP(ip))) throw new ApiError(400, 'INVALID_PROXY_CHAIN', 'Origem de conexão inválida.');
  let current = peer;
  for (let i = chain.length - 1; i >= 0 && trusted.has(current); i--) current = chain[i];
  return current;
}
function createSecurity(config) {
  const fallback = crypto.randomBytes(32);
  const buckets = new Map();
  let lastCleanup = 0;
  function originHash(request, requireStable = false) {
    if (requireStable && !config.originSecret) throw new ApiError(503, 'COLLECTION_NOT_CONFIGURED', 'Coleta não configurada no servidor.');
    return crypto.createHmac('sha256', config.originSecret || fallback).update(clientIp(request, config.trustedProxies) || 'unknown').digest('hex');
  }
  function limit(request, category, count, windowMs) {
    const now = Date.now();
    if (now - lastCleanup > 60000) {
      for (const [key, entry] of buckets) if (entry.reset <= now) buckets.delete(key);
      lastCleanup = now;
    }
    const key = category + ':' + originHash(request);
    let entry = buckets.get(key);
    if (!entry || entry.reset <= now) {
      if (buckets.size >= 20000) throw new ApiError(503, 'SERVER_BUSY', 'Serviço ocupado. Tente novamente em instantes.');
      entry = { n: 0, reset: now + windowMs }; buckets.set(key, entry);
    }
    entry.n++;
    if (entry.n > count) throw new ApiError(429, 'RATE_LIMITED', 'Muitas tentativas. Aguarde antes de continuar.',
      { 'Retry-After': String(Math.ceil((entry.reset - now) / 1000)) });
  }
  function checkOrigin(request, response) {
    const origin = request.headers.origin;
    if (!origin) return;
    const allowed = new Set([config.publicOrigin, ...config.corsOrigins].filter(Boolean));
    if (!config.production && !config.publicOrigin) {
      // Somente loopback para desenvolvimento; não usar Host arbitrário como política CORS.
      for (const host of ['127.0.0.1', 'localhost', '[::1]']) allowed.add(`http://${host}:${config.port}`);
    }
    if (!allowed.has(origin)) throw new ApiError(403, 'ORIGIN_DENIED', 'Origem não autorizada.');
    response.setHeader('Access-Control-Allow-Origin', origin);
    response.setHeader('Vary', 'Origin');
    response.setHeader('Access-Control-Expose-Headers', 'X-Request-Id, X-Next-Cursor, Retry-After');
  }
  return { originHash, limit, checkOrigin };
}
function securityHeaders(response, production) {
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('X-Frame-Options', 'DENY');
  response.setHeader('Referrer-Policy', 'no-referrer');
  response.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  response.setHeader('Cache-Control', 'no-store');
  if (production) response.setHeader('Strict-Transport-Security', 'max-age=31536000');
}
module.exports = { createSecurity, clientIp, securityHeaders };
