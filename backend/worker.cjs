const { loadEnv, readConfig } = require('./config.cjs');
const { runMaintenance } = require('./maintenance.cjs');
loadEnv();
const config = readConfig();
async function main() {
  if (!process.argv.includes('--watch')) {
    console.log(JSON.stringify(await runMaintenance(config, process.argv[2] || 'tudo'))); return;
  }
  // Agendamento separado do servidor HTTP; múltiplas réplicas web não multiplicam jobs.
  if (!config.secretKey || !config.supabaseUrl) throw new Error('Worker exige configuração operacional do Supabase.');
  let running = false, lastPurge = 0;
  async function tick() {
    if (running) return;
    running = true;
    try {
      console.log(JSON.stringify({ task: 'tv', result: await runMaintenance(config, 'tv') }));
      if (Date.now() - lastPurge >= 86400000) {
        console.log(JSON.stringify({ task: 'expurgar', result: await runMaintenance(config, 'expurgar') }));
        lastPurge = Date.now();
      }
    } catch (error) { console.error(JSON.stringify({ task: 'maintenance', code: error.code || 'MAINTENANCE_ERROR', message: 'Manutenção indisponível; verificar configuração ou serviço.' })); }
    finally { running = false; }
  }
  await tick();
  const timer = setInterval(tick, 15 * 60000);
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => { clearInterval(timer); });
}
main().catch(error => { console.error(error.code || error.message); process.exitCode = 1; });
