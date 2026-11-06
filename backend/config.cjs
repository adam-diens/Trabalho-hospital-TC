const fs = require('node:fs');
const path = require('node:path');

function loadEnv(file = path.resolve(__dirname, '../.env'), target = process.env) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!match || match[1] in target) continue;
    target[match[1]] = match[2].replace(/^(['"])(.*)\1$/, '$2');
  }
}
function readConfig(env = process.env) {
  const production = env.NODE_ENV === 'production';
  function integer(key, fallback, min, max) {
    const n = Number(env[key] ?? fallback);
    if (!Number.isInteger(n) || n < min || n > max) throw new Error(`Configuração inválida: ${key}`);
    return n;
  }
  function url(key, originOnly = false) {
    if (!env[key]) return '';
    let value;
    try { value = new URL(env[key]); } catch { throw new Error(`URL inválida: ${key}`); }
    if (!['https:', 'http:'].includes(value.protocol) || value.username || value.password || value.hash ||
        (originOnly && (value.pathname !== '/' || value.search)) || (production && value.protocol !== 'https:')) {
      throw new Error(`URL inválida: ${key}`);
    }
    return originOnly ? value.origin : value.href;
  }
  const config = {
    production, host: env.HOST || '127.0.0.1', port: integer('PORT', 5173, 0, 65535),
    supabaseUrl: url('SUPABASE_URL', true), publishableKey: env.SUPABASE_PUBLISHABLE_KEY || '',
    secretKey: env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY || '',
    originSecret: env.ORIGIN_HMAC_SECRET || '', publicOrigin: url('PUBLIC_ORIGIN', true),
    authRedirectUrl: url('AUTH_REDIRECT_URL'), allowSignup: env.ALLOW_SIGNUP !== 'false',
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
    corsOrigins: (env.CORS_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean),
  };
  for (const origin of config.corsOrigins) {
    const parsed = new URL(origin);
    if (parsed.origin !== origin || !['https:', 'http:'].includes(parsed.protocol) || (production && parsed.protocol !== 'https:')) {
      throw new Error('CORS_ORIGINS deve conter origens exatas, sem caminhos ou curingas.');
    }
  }
  if (config.originSecret && Buffer.byteLength(config.originSecret) < 32) throw new Error('ORIGIN_HMAC_SECRET exige pelo menos 32 bytes.');
  if (production && (!config.supabaseUrl || !config.publishableKey || !config.secretKey || !config.originSecret || !config.publicOrigin)) {
    throw new Error('Produção exige Supabase, chave operacional, ORIGIN_HMAC_SECRET e PUBLIC_ORIGIN configurados.');
  }
  return config;
}
module.exports = { loadEnv, readConfig };
