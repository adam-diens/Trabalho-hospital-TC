const { definitions } = require('./routes.cjs');
const json = schema => ({ 'application/json': { schema } });
const errorSchema = { type: 'object', required: ['error'], properties: { error: { type: 'object', required: ['code', 'message', 'request_id'], properties: {
  code: { type: 'string' }, message: { type: 'string' }, request_id: { type: 'string', format: 'uuid' },
} } } };
const openapi = {
  openapi: '3.1.0', info: { title: 'FHDOD — API de Experiência do Paciente', version: '2.0.0',
    description: 'API própria sobre o banco v2. JWT institucional para gestão; coleta anônima pelo backend. Nenhuma tabela ou credencial operacional exposta. O frontend anterior ainda precisa ser adaptado.' },
  servers: [{ url: '/' }], paths: {}, components: { securitySchemes: { UserSession: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } }, schemas: { Error: errorSchema }, responses: {} },
};
const errors = { 400: 'Entrada inválida', 401: 'Sessão inválida', 403: 'Perfil, setor ou origem sem autorização', 409: 'Conflito de revisão ou integridade', 413: 'Corpo excede o limite', 415: 'Tipo de conteúdo inválido', 422: 'Exportação excede o limite', 429: 'Limite de tentativas', 502: 'Serviço de dados indisponível', 503: 'Configuração incompleta ou coleta desabilitada', 504: 'Timeout do serviço de dados' };
for (const [status, description] of Object.entries(errors)) openapi.components.responses['Error' + status] = { description, content: json({ $ref: '#/components/schemas/Error' }) };
for (const route of definitions) {
  const path = route.path.replace(/:([a-z_]+)/g, '{$1}');
  const parameters = [];
  for (const match of route.path.matchAll(/:([a-z_]+)/g)) parameters.push({ name: match[1], in: 'path', required: true,
    schema: match[1] === 'id' ? { type: 'string', format: 'uuid' } : { type: 'string', pattern: '^[a-z][a-z0-9_-]{1,39}$' } });
  for (const [name, schema] of Object.entries(route.query.properties)) parameters.push({ name, in: 'query', required: route.query.required.includes(name), schema });
  const resultSchema = route.action === 'pesquisa' ? {
    type: 'object', required: ['recebida', 'protocolo'], properties: { recebida: { const: true }, protocolo: { type: ['integer', 'null'] } },
  } : route.action === 'atender' ? { type: 'object', properties: { revisao: { type: 'integer' } } } : {};
  const success = route.action === 'stream' ? { description: 'Fluxo SSE: eventos painel e erro. Usar fetch com Authorization; não colocar token na URL. Reconectar ao encerrar após cinco minutos.',
    content: { 'text/event-stream': { schema: { type: 'string' } } } } : route.action === 'csv' ? {
    description: 'CSV UTF-8 com BOM, separador ponto e vírgula e defesa contra fórmulas; sem contato ou texto livre.', content: { 'text/csv': { schema: { type: 'string' } } },
  } : { description: 'Operação concluída. Listas usam X-Next-Cursor para continuação; listas vazias encerram a paginação.', content: json(resultSchema) };
  const responses = { 200: success };
  if (['signup', 'recover'].includes(route.action)) { delete responses[200]; responses[202] = success; }
  for (const status of Object.keys(errors)) responses[status] = { $ref: '#/components/responses/Error' + status };
  (openapi.paths[path] ||= {})[route.method.toLowerCase()] = {
    summary: route.summary, operationId: route.method.toLowerCase() + route.path.replace(/[^a-zA-Z0-9]/g, '_'),
    security: route.access || route.authenticated ? [{ UserSession: [] }] : [],
    ...(route.access ? { 'x-roles': route.access } : {}),
    ...(parameters.length ? { parameters } : {}),
    ...(route.body ? { requestBody: { required: true, content: json(route.body) } } : {}), responses,
  };
}
for (const [path, summary] of [['/api/health', 'Verificar processo vivo, sem consultar o banco'], ['/api/ready', 'Verificar configuração e conectividade pública com o banco']]) {
  openapi.paths[path] = { get: { summary, security: [], responses: { 200: { description: 'Disponível' }, 503: { description: 'Configuração incompleta' } } } };
}
module.exports = { openapi };
