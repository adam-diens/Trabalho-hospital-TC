const { createSupabase } = require('./supabase.cjs');
async function runMaintenance(config, task = 'tudo', fetchImpl = fetch) {
  if (!['tv', 'expurgar', 'tudo'].includes(task)) throw new Error('Tarefa inválida. Use tv, expurgar ou tudo.');
  if (!config.secretKey) throw new Error('Configure SUPABASE_SECRET_KEY para executar a manutenção.');
  const db = createSupabase(config, fetchImpl);
  const result = {};
  if (task === 'tv' || task === 'tudo') result.tv = await db.rpc('ep_publicar_tv', {}, { operational: true });
  if (task === 'expurgar' || task === 'tudo') result.contatos_expurgados = await db.rpc('ep_expurgar_contatos', {}, { operational: true });
  return result;
}
module.exports = { runMaintenance };
