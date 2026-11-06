const fs = require('node:fs');
const path = require('node:path');

function loadEnv(file = path.resolve(__dirname, '../.env'), target = process.env) {
  // Em hospedagem, os segredos vêm exclusivamente das variáveis do provedor.
  if(target.NODE_ENV==='production')return;
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!match || match[1] in target) continue;
    target[match[1]] = match[2].replace(/^(['"])(.*)\1$/, '$2');
  }
}
function readConfig(env = process.env, { worker = false } = {}) {
  const production = env.NODE_ENV === 'production';
  const render = env.RENDER === 'true';
  function integer(key, fallback, min, max) {
    const n = Number(env[key] ?? fallback);
    if (!Number.isInteger(n) || n < min || n > max) throw new Error(`Configuração inválida: ${key}`);
    return n;
  }
  function url(key, originOnly = false, fallback = '') {
    const input = env[key]?.trim() || fallback;
    if (!input) return '';
    let value;
    try { value = new URL(input); } catch { throw new Error(`URL inválida: ${key}`); }
    if (!['https:', 'http:'].includes(value.protocol) || value.username || value.password || value.hash ||
        (originOnly && (value.pathname !== '/' || value.search)) || (production && (value.protocol !== 'https:' ||
          ['localhost','127.0.0.1','[::1]','0.0.0.0'].includes(value.hostname)))) {
      throw new Error(`URL inválida: ${key}`);
    }
    return originOnly ? value.origin : value.href;
  }
  const publicOrigin=url('PUBLIC_ORIGIN',true,production&&render?env.RENDER_EXTERNAL_URL||'':'');
  const authRedirectUrl=url('AUTH_REDIRECT_URL',false,publicOrigin?publicOrigin+'/?fluxo=recuperar-senha':'');
  if(production && publicOrigin && authRedirectUrl && new URL(authRedirectUrl).origin!==publicOrigin) {
    throw new Error('AUTH_REDIRECT_URL deve usar a mesma origem de PUBLIC_ORIGIN.');
  }
  if(env.ALLOW_SIGNUP!==undefined && !['true','false'].includes(env.ALLOW_SIGNUP))throw new Error('ALLOW_SIGNUP deve ser true ou false.');
  const config = {
    production, host: env.HOST || (production?'0.0.0.0':'127.0.0.1'), port: integer('PORT', 5173, production?1:0, 65535),
    supabaseUrl: url('SUPABASE_URL', true), publishableKey: env.SUPABASE_PUBLISHABLE_KEY || '',
    secretKey: env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY || '',
    originSecret: env.ORIGIN_HMAC_SECRET || '', publicOrigin,
    authRedirectUrl, allowSignup: env.ALLOW_SIGNUP !== 'false',
    upstreamTimeoutMs: integer('UPSTREAM_TIMEOUT_MS', 8000, 100, 30000),
    maxBodyBytes: integer('MAX_BODY_BYTES', 32768, 1024, 262144),
    maxUpstreamBytes: integer('MAX_UPSTREAM_BYTES', 8388608, 1024, 33554432),
    readLimit: integer('READ_LIMIT_PER_MINUTE', 120, 1, 10000),
    authLimit: integer('AUTH_LIMIT_PER_10_MINUTES', 15, 1, 1000),
    surveyLimit: integer('SURVEY_LIMIT_PER_10_MINUTES', 60, 1, 1000),
    maxExportRows: integer('MAX_EXPORT_ROWS', 10000, 100, 50000),
    streamIntervalMs: integer('STREAM_INTERVAL_MS', 15000, 100, 60000),
    streamMaxMs: integer('STREAM_MAX_MS', 300000, 500, 600000),
    trustedProxies: (env.TRUSTED_PROXY_IPS || '').split(',').map(s => s.trim()).filter(Boolean),
    trustedProxyHops: integer('TRUST_PROXY_HOPS', production&&render?1:0, 0, 10),
    corsOrigins: (env.CORS_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean),
  };
  if(production&&render&&!worker&&config.host!=='0.0.0.0')throw new Error('Render exige HOST=0.0.0.0.');
  if(config.trustedProxyHops && config.trustedProxies.length)throw new Error('Use TRUST_PROXY_HOPS ou TRUSTED_PROXY_IPS, não ambos.');
  if(config.trustedProxies.some(ip=>!require('node:net').isIP(ip)))throw new Error('TRUSTED_PROXY_IPS deve conter IPs exatos válidos.');
  if(config.publishableKey.startsWith('sb_secret_')||config.secretKey.startsWith('sb_publishable_')||
    (config.publishableKey&&config.publishableKey===config.secretKey))throw new Error('Confira os tipos das chaves pública e operacional do Supabase.');
  for (const origin of config.corsOrigins) {
    const parsed = new URL(origin);
    if (parsed.origin !== origin || !['https:', 'http:'].includes(parsed.protocol) || (production && parsed.protocol !== 'https:')) {
      throw new Error('CORS_ORIGINS deve conter origens exatas, sem caminhos ou curingas.');
    }
  }
  if (config.originSecret && Buffer.byteLength(config.originSecret) < 32) throw new Error('ORIGIN_HMAC_SECRET exige pelo menos 32 bytes.');
  if (production && (!config.supabaseUrl || !config.secretKey || (!worker && (!config.publishableKey || !config.originSecret || !config.publicOrigin)))) {
    throw new Error(worker?'Produção do worker exige SUPABASE_URL e SUPABASE_SECRET_KEY.':'Produção exige Supabase, chave operacional, ORIGIN_HMAC_SECRET e PUBLIC_ORIGIN (ou URL externa do Render) configurados.');
  }
  return config;
}
module.exports = { loadEnv, readConfig };
