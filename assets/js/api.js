const KEY = 'fhdod.session.v2';
let current = null, epoch = 0, refreshing = null;
try { const saved = JSON.parse(sessionStorage.getItem(KEY) || 'null'); if (saved?.access_token && saved?.refresh_token && saved?.perfil) current = saved; } catch {}
export function session() { return current; }
export function reloadSession() {let value=null;try{const stored=JSON.parse(sessionStorage.getItem(KEY)||'null');if(stored?.access_token&&stored?.refresh_token&&stored?.perfil)value=stored;}catch{}saveSession(value);}
export function saveSession(value) {
  epoch++; current = value ? { ...value, expires_at: value.expires_at || Math.floor(Date.now() / 1000) + Number(value.expires_in || 3600) } : null;
  try { if (current) sessionStorage.setItem(KEY, JSON.stringify(current)); else sessionStorage.removeItem(KEY); } catch {}
}
export function updateProfile(perfil) { if (current) { current = { ...current, perfil }; try { sessionStorage.setItem(KEY, JSON.stringify(current)); } catch {} } }
export class ApiError extends Error { constructor(status, code, message) { super(message); this.status = status; this.code = code; } }
async function refresh() {
  if (refreshing) return refreshing;
  const savedEpoch = epoch, token = current?.refresh_token;
  if (!token) throw new ApiError(401, 'AUTH_REQUIRED', 'Entre novamente com sua conta.');
  refreshing = (async () => {
    try {
      let response;
      try{response=await fetch('/api/v2/auth/renovar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refresh_token: token }), signal: AbortSignal.timeout(12000) });}
      catch{throw new ApiError(0,'NETWORK_ERROR','Não foi possível renovar a sessão agora. Verifique a conexão e tente novamente.');}
      const data = await response.json().catch(()=>({}));
      if (savedEpoch !== epoch) throw new DOMException('Sessão alterada', 'AbortError');
      if (!response.ok) {
        if([401,403].includes(response.status)){saveSession(null);window.dispatchEvent(new Event('fhdod:unauthorized'));}
        throw new ApiError(response.status,data.error?.code,data.error?.message||'Não foi possível renovar a sessão agora. Tente novamente.');
      }
      if(!data.access_token||!data.refresh_token||!data.perfil)throw new ApiError(502,'INVALID_SESSION_RESPONSE','Não foi possível confirmar a renovação da sessão. Tente novamente.');
      current = { ...data, expires_at: data.expires_at || Math.floor(Date.now() / 1000) + Number(data.expires_in || 3600) };
      try { sessionStorage.setItem(KEY, JSON.stringify(current)); } catch {}
    } finally { refreshing = null; }
  })();
  return refreshing;
}
export async function request(path, { method = 'GET', body, auth = false, signal, blob = false, page = false, token, stream = false } = {}) {
  if (auth && !token && current?.expires_at < Date.now() / 1000 + 30) await refresh();
  const savedEpoch = epoch;
  const headers = { Accept: stream ? 'text/event-stream' : 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (auth || token) {
    const access = token || current?.access_token;
    if (!access) throw new ApiError(401, 'AUTH_REQUIRED', 'Entre com sua conta institucional.');
    headers.Authorization = `Bearer ${access}`;
  }
  const combined = signal ? AbortSignal.any([signal, AbortSignal.timeout(stream ? 330000 : 20000)]) : AbortSignal.timeout(20000);
  let response;
  try { response = await fetch('/api/v2' + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), signal: combined }); }
  catch (error) {
    if (signal?.aborted) throw error;
    throw new ApiError(0, 'NETWORK_ERROR', 'Não foi possível confirmar a operação. Verifique a conexão e tente novamente.');
  }
  if (auth && !token && savedEpoch !== epoch) { await response.body?.cancel(); throw new DOMException('Sessão alterada', 'AbortError'); }
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    if(auth&&!token&&savedEpoch!==epoch)throw new DOMException('Sessão alterada','AbortError');
    if(auth&&response.status===401&&current?.access_token&&headers.Authorization!==`Bearer ${current.access_token}`)throw new ApiError(409,'SESSION_REFRESHED','Sua sessão foi renovada. Tente esta ação novamente.');
    if (auth && response.status === 401) { saveSession(null); window.dispatchEvent(new Event('fhdod:unauthorized')); }
    throw new ApiError(response.status, data.error?.code, data.error?.message || 'Não foi possível concluir a operação.');
  }
  if (stream) return response;
  if (blob) {const result=await response.blob();if(auth&&!token&&savedEpoch!==epoch)throw new DOMException('Sessão alterada','AbortError');return result;}
  const data = await response.json();
  if(auth&&!token&&savedEpoch!==epoch)throw new DOMException('Sessão alterada','AbortError');
  return page ? { data, cursor: response.headers.get('X-Next-Cursor') } : data;
}
export const query = values => new URLSearchParams(Object.entries(values).filter(([, v]) => v !== '' && v !== undefined && v !== null)).toString();
export async function listAll(path, filters = {}, { signal, limit = 200 } = {}) {
  const rows=[];let cursor=null;
  for(;;){const page=await request(path+'?'+query({...filters,limite:limit,depois:cursor}),{auth:true,signal,page:true});rows.push(...page.data);
    if(page.data.length<limit||!page.cursor)return rows;
    if(page.cursor===cursor||rows.length>=5000)throw new Error('A lista é muito extensa. Consulte um setor específico.');
    cursor=page.cursor;
  }
}
