const { loadEnv, readConfig } = require('./config.cjs');
const { runMaintenance } = require('./maintenance.cjs');
function startWorker(config, { run = runMaintenance, log = record => console.log(JSON.stringify(record)),
  intervalMs = 15 * 60000, purgeIntervalMs = 86400000 } = {}) {
  let stopped = false, timer, current = null, lastPurge = null;
  async function task(name) {
    try { const result=await run(config,name);log({task:name,status:'ok',result});return true; }
    catch(error){log({task:name,status:'error',code:error.code||'MAINTENANCE_ERROR',message:'Manutenção indisponível; verificar configuração ou serviço.'});return false;}
  }
  function tick() {
    if(stopped||current)return current||Promise.resolve();
    current=(async()=>{
      await task('tv');
      // Falha na publicação não deve impedir o expurgo de contatos.
      if(!stopped&&(lastPurge===null||Date.now()-lastPurge>=purgeIntervalMs)) {
        if(await task('expurgar'))lastPurge=Date.now();
      }
    })().finally(()=>{current=null;});
    return current;
  }
  timer=setInterval(tick,intervalMs);
  const ready=tick();
  return {ready,tick,stop:async()=>{stopped=true;clearInterval(timer);await current;}};
}
async function main() {
  loadEnv();const config=readConfig(process.env,{worker:true});
  if(!process.argv.includes('--watch')) {
    console.log(JSON.stringify(await runMaintenance(config,process.argv[2]||'tudo')));return;
  }
  if(!config.secretKey||!config.supabaseUrl)throw new Error('Worker exige configuração operacional do Supabase.');
  const worker=startWorker(config);
  for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>{worker.stop().catch(()=>{process.exitCode=1;});});
  await worker.ready;
}
if(require.main===module)main().catch(error=>{console.error(error.code||error.message);process.exitCode=1;});
module.exports={startWorker};
