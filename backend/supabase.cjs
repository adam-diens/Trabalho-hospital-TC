const { ApiError } = require('./errors.cjs');
function createSupabase(config, fetchImpl = fetch) {
  async function request(path, { body, token, operational = false, method = 'POST', authAction } = {}) {
    const key = operational ? config.secretKey : config.publishableKey;
    if (!config.supabaseUrl || !key) throw new ApiError(503, 'NOT_CONFIGURED', 'Serviço de dados não configurado.');
    const headers = { apikey: key, Accept: 'application/json', 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    // Chaves sb_secret_* não são JWTs. O gateway lê apikey; JWT legado precisa também de Bearer.
    else if (key.split('.').length === 3) headers.Authorization = `Bearer ${key}`;
    let response, text, data;
    const signal = AbortSignal.timeout(config.upstreamTimeoutMs);
    try {
      response = await fetchImpl(config.supabaseUrl + path, {
        method, headers, signal, redirect: 'error', ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      if (Number(response.headers.get('content-length')) > config.maxUpstreamBytes) {
        await response.body?.cancel(); throw new ApiError(502, 'UPSTREAM_TOO_LARGE', 'Resposta do serviço de dados excedeu o limite.');
      }
      const chunks = []; let size = 0;
      if (response.body) for await (const chunk of response.body) {
        size += chunk.length;
        if (size > config.maxUpstreamBytes) throw new ApiError(502, 'UPSTREAM_TOO_LARGE', 'Resposta do serviço de dados excedeu o limite.');
        chunks.push(chunk);
      }
      text = Buffer.concat(chunks).toString('utf8');
    } catch (error) {
      if (error instanceof ApiError) throw error;
      const timeout = signal.aborted || error.name === 'TimeoutError';
      throw new ApiError(timeout ? 504 : 502, timeout ? 'UPSTREAM_TIMEOUT' : 'UPSTREAM_UNAVAILABLE',
        timeout ? 'O serviço demorou para responder. Tente novamente.' : 'Não foi possível comunicar com o serviço de dados.');
    }
    try { data = text ? JSON.parse(text) : null; } catch { throw new ApiError(502, 'UPSTREAM_INVALID', 'Resposta inválida do serviço de dados.'); }
    if (response.ok) return data;
    if (response.status === 429) throw new ApiError(429, 'RATE_LIMITED', 'Muitas tentativas. Aguarde para tentar novamente.', { 'Retry-After': '60' });
    const code = data?.code;
    // Interpreta SQLSTATE antes do HTTP: estados de negócio podem chegar como 500.
    if (code === '55000') throw new ApiError(503, 'COLLECTION_DISABLED', 'A pesquisa está temporariamente indisponível.');
    // Cadastro repetido recebe a mesma confirmação genérica de um cadastro novo.
    if (authAction === 'signup' && ['user_already_exists', 'email_exists'].includes(code)) return null;
    if (code === '42501' || response.status === 403) throw new ApiError(403, 'FORBIDDEN', 'Seu perfil não permite esta operação.');
    if (code === '40001') throw new ApiError(409, 'VERSION_CONFLICT', 'O registro foi atualizado. Recarregue antes de continuar.');
    if (code === 'P0001' && path.endsWith('/ep_enviar_pesquisa')) throw new ApiError(429, 'RATE_LIMITED', 'Limite temporário de respostas atingido.', { 'Retry-After': '600' });
    if (code === '22023' || code === '22P02') throw new ApiError(400, 'INVALID_OPERATION',
      path.endsWith('/ep_enviar_pesquisa') ? 'Envio inválido ou formulário desatualizado. Confira os dados e recarregue a pesquisa se necessário.' : 'Dados ou estado inválidos para esta operação.');
    if (['23514', '23502', '23503', '23505'].includes(code)) throw new ApiError(409, 'DATA_CONFLICT', 'Os dados conflitam com as regras ou registros existentes.');
    if (['PGRST202', 'PGRST204', '42P01', '42883'].includes(code)) throw new ApiError(503, 'DATABASE_NOT_READY', 'A versão do banco ou o cache da API precisa ser atualizado.');
    if (response.status >= 500) throw new ApiError(502, 'UPSTREAM_UNAVAILABLE', 'Serviço de dados temporariamente indisponível.');
    if (response.status === 401 && !token && !authAction) throw new ApiError(503, 'UPSTREAM_CREDENTIALS', 'Credencial do serviço de dados indisponível.');
    if (response.status === 401 || ['signin', 'refresh', 'user'].includes(authAction)) throw new ApiError(401, 'INVALID_SESSION',
      authAction === 'signin' ? 'E-mail ou senha inválidos, ou conta ainda não confirmada.' : 'Sessão inválida ou expirada.');
    if (authAction) throw new ApiError(400, 'AUTH_REJECTED', 'Não foi possível concluir a operação de autenticação.');
    throw new ApiError(502, 'UPSTREAM_REJECTED', 'O serviço de dados não pôde concluir a operação.');
  }
  return {
    rpc: (name, body = {}, options = {}) => request(`/rest/v1/rpc/${name}`, { body, ...options }),
    auth: (path, options = {}) => request(`/auth/v1/${path}`, options),
  };
}
module.exports = { createSupabase };
