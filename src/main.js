import { createClient } from '@supabase/supabase-js';
import './style.css';
const FACE=[['😠','Péssimo'],['🙁','Ruim'],['😐','Regular'],['🙂','Bom'],['😍','Ótimo']];
const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const $=id=>document.getElementById(id),A=$('app');
const CFG={URL:import.meta.env.VITE_SUPABASE_URL,KEY:import.meta.env.VITE_SUPABASE_ANON_KEY};
// aceita só chave anon (eyJ...) ou publishable; recusa connection string/senha do banco
const ok=!!(CFG.URL&&CFG.KEY&&/^(eyJ|sb_publishable_)/.test(CFG.KEY));
const devId=()=>{try{let d=localStorage.getItem('dev');if(!d){d=crypto.randomUUID();localStorage.setItem('dev',d)}return d}catch(e){return null}};
const db=ok?createClient(CFG.URL,CFG.KEY):null;
async function rpc(n,a){const{data,error}=await db.rpc(n,a||{});if(error)throw error;return data}
const fail=e=>alert('Não foi possível concluir: '+(e.message||e));
let st={},timer=null,SETORES=[];
function nav(){const h=location.hash;[['#/','Início'],['#/pesquisa/pa','Pesquisa'],['#/painel','Painel da gestão'],['#/tv','TV Wall']];
 $('nav').innerHTML=[['#/','Início'],['#/pesquisa/','Pesquisa'],['#/painel','Painel da gestão'],['#/tv','TV Wall']].map(x=>`<a href="${x[0]==='#/pesquisa/'?'#/pesquisa/pa':x[0]}" class="${x[0]==='#/'?h==='#/'||!h:h.startsWith(x[0])?'on':''}">${x[1]}</a>`).join('')}
async function route(){nav();clearInterval(timer);const h=location.hash||'#/';
 if(!ok){A.innerHTML='<div class="wrap"><h1>Falta configurar</h1><p>Crie o arquivo <b>.env</b> (copie de <b>.env.example</b>) com a URL e a chave <b>anon public</b> do Supabase. Nunca use a senha do banco aqui.</p></div>';return}
 try{if(h.startsWith('#/pesquisa/'))await survey(h.split('/')[2]);else if(h==='#/painel')await panel();else if(h==='#/tv'){await tv();timer=setInterval(()=>tv().catch(()=>{}),10000)}else await home()}
 catch(e){A.innerHTML=`<div class="wrap"><h1>Ops</h1><p>${esc(e.message||e)}</p></div>`}}
async function home(){const{data}=await db.from('setores').select('slug,nome').eq('ativo',true).order('id');
 A.innerHTML=`<div class="wrap"><h1>Experiência do Paciente</h1><p class="mu">Cada setor tem sua pesquisa (URL e QR Code próprios).</p>${(data||[]).map(s=>`<a class="btn" href="#/pesquisa/${esc(s.slug)}">Pesquisa: ${esc(s.nome)}</a>`).join('')}<a class="btn sec" href="#/painel">Painel da gestão</a><a class="btn sec" href="#/tv">TV Wall</a></div>`}
/* ===== PESQUISA ===== */
async function survey(slug){
 if(st.slug!==slug){const{data:s}=await db.from('setores').select('id,slug,nome,limite_ouvidoria').eq('slug',slug).eq('ativo',true).single();if(!s){location.hash='#/';return}
  const{data:p}=await db.from('perguntas').select('etapa,texto,obrigatoria,ordem').or(`setor_id.eq.${s.id},setor_id.is.null`).order('ordem');
  st={slug,s,obrig:(p.find(x=>x.obrigatoria)||{texto:'Como foi sua experiência no hospital?'}).texto,jor:p.filter(x=>!x.obrigatoria),step:'P1',q:0}}
 drawS()}
function faces(a){return `<div class="faces">${FACE.map((f,i)=>`<button class="face" data-a="${a}" data-v="${i+1}"><span>${f[0]}</span><small>${f[1]}</small></button>`).join('')}</div>`}
function drawS(){const bar=p=>`<div class="bar"><i style="width:${p}%"></i></div>`;let h=`<div class="wrap"><span class="tag">${esc(st.s.nome)}</span>`,x=st.step;
 if(x==='P1')h+=`<h1>Como foi seu atendimento?</h1><p>Leva menos de 1 minuto. Só a primeira pergunta é obrigatória.</p><button class="btn" data-a="go" data-v="P2">Começar</button>`;
 if(x==='P2')h+=bar(20)+`<h2>${esc(st.obrig)}</h2>`+faces('nota');
 if(x==='P2b')h+=`<h2>Sentimos muito.</h2><p>Quer que a Ouvidoria entre em contato com você?</p><button class="btn" data-a="retorno">Sim, quero</button><button class="btn sec" data-a="go" data-v="P3">Prefiro não</button>`;
 if(x==='P3'){if(!st.jor.length){st.step='P4';return drawS()}h+=bar(30+st.q/st.jor.length*40)+`<h2>${esc(st.jor[st.q].etapa)}</h2><p class="mu">Como foi?</p>`+faces('jor')+`<button class="skip" data-a="jor" data-v="0">pular</button>`}
 if(x==='P4')h+=bar(80)+`<h2>Quer deixar um comentário?</h2><p class="mu">Não escreva nome, CPF, telefone ou dados de saúde.</p><select id="tp"><option value="elogio">Elogio</option><option value="reclamacao">Reclamação</option><option value="sugestao">Sugestão</option></select><textarea id="tx" rows="4" maxlength="1000" placeholder="Escreva aqui (opcional)"></textarea><button class="btn" data-a="com">${st.ret?'Continuar':'Enviar'}</button><button class="skip" data-a="com" data-s="1">pular</button>`;
 if(x==='P5')h+=bar(90)+`<h2>Seu contato para retorno</h2><p class="mu">Opcional. Só a Ouvidoria vê seu telefone.</p><input id="tel" type="tel" inputmode="tel" placeholder="(51) 90000-0000"><textarea id="ob" rows="2" maxlength="500" placeholder="Observação (opcional)"></textarea><button class="btn" data-a="lgpd">Enviar</button><button class="btn sec" data-a="fim">Enviar sem me identificar</button>`;
 if(x==='P6')h+=`<h1>Obrigado! 💙</h1><p>Sua opinião ajuda a melhorar o atendimento.</p>${st.prot?`<div class="card">Seu protocolo:<br><b style="font-size:28px">${esc(st.prot)}</b></div>`:''}<button class="btn sec" data-a="novo">Nova resposta</button>`;
 h+='</div>';if(st.modal)h+=`<div class="ov"><div class="card"><h2>Uso do seu telefone</h2><p>Autorizo o hospital a usar meu telefone apenas para o retorno da Ouvidoria, conforme a LGPD. <a href="#" data-a="doc" style="color:var(--pr)">Ler o documento do hospital</a></p><button class="btn" data-a="aceito">Aceito</button><button class="btn sec" data-a="fim">Cancelar (enviar sem telefone)</button></div></div>`;A.innerHTML=h}
async function actS(a,v,t){
 if(a==='doc'){alert('O hospital insere aqui o documento oficial de privacidade.');return}
 if(a==='go')st.step=v;
 else if(a==='nota'){const n=+v;st.id=await rpc('registrar_resposta',{p_setor:st.slug,p_nota:n,p_dispositivo:devId()});st.q=0;st.ret=false;st.prot=null;st.step=n<=st.s.limite_ouvidoria?'P2b':'P3'}
 else if(a==='retorno'){st.ret=true;st.step='P3'}
 else if(a==='jor'){const e=st.jor[st.q].etapa;if(+v)await rpc('complementar_resposta',{p_id:st.id,p_jornada:{[e]:+v}});st.q++;if(st.q>=st.jor.length)st.step='P4'}
 else if(a==='com'){if(!t.dataset.s){const tx=$('tx').value.trim();if(tx)await rpc('complementar_resposta',{p_id:st.id,p_tipo:$('tp').value,p_comentario:tx})}st.step=st.ret?'P5':'P6'}
 else if(a==='lgpd'){if($('tel').value.replace(/\D/g,'').length<10){alert('Digite o telefone com DDD.');return}st.tel=$('tel').value;st.ob=$('ob').value;st.modal=true}
 else if(a==='aceito'){st.prot=await rpc('registrar_contato',{p_id:st.id,p_telefone:st.tel,p_obs:st.ob,p_aceite:true});st.modal=false;st.step='P6'}
 else if(a==='fim'){st.modal=false;st.step='P6'}
 else if(a==='novo'){st.step='P2';st.id=null}
 drawS()}
/* ===== PAINEL ===== */
async function panel(){const{data:{session}}=await db.auth.getSession();
 if(!session){A.innerHTML=`<div class="wrap"><h1>Entrar</h1><div class="card"><input id="em" type="email" placeholder="E-mail"><input id="pw" type="password" placeholder="Senha"><button class="btn" data-a="login">Entrar</button></div></div>`;return}
 const{data:pf}=await db.from('perfis').select('perfil,nome,setor_id').maybeSingle();
 if(!pf){A.innerHTML=`<div class="wrap"><h1>Sem perfil</h1><p>Peça ao Super Admin para definir seu perfil de acesso.</p><button class="btn sec" data-a="sair">Sair</button></div>`;return}
 const f=st.f||{};const p={p_setor:f.s||null,p_turno:f.t||null};
 const k=await rpc('painel_resumo',p);let man=[];if(pf.perfil!=='visualizador')man=await rpc('listar_manifestacoes',{p_setor:f.s||null});
 const{data:ss}=await db.from('setores').select('id,slug,nome').order('id');SETORES=ss||[];const K=k.kpis||{};
 const rows=(l,n)=>(l||[]).map(x=>`<div class="row"><span style="width:150px">${esc(x[n])}</span><div class="t"><i style="width:${(x.media||0)/5*100}%"></i></div><b>${x.media||'–'}</b><span class="mu">(${x.n})</span></div>`).join('')||'<p class="mu">Sem dados.</p>';
 const cad=pf.perfil==='super_admin'?`<div class="card"><h2>Cadastros (Super Admin)</h2><p class="mu">Setor</p><input id="cs" placeholder="Nome do setor"><input id="cl" placeholder="código na URL (ex.: uti)"><button class="btn sm" data-a="addsetor">Adicionar setor</button><p class="mu">Pergunta da jornada</p><select id="ps">${SETORES.map(s=>`<option value="${s.id}">${esc(s.nome)}</option>`).join('')}</select><input id="pe" placeholder="Etapa (ex.: Recepção)"><button class="btn sm" data-a="addperg">Adicionar pergunta</button><p class="mu">Perfil de usuário (crie o login antes em Authentication)</p><input id="ue" type="email" placeholder="E-mail do usuário"><input id="un" placeholder="Nome"><select id="up">${['super_admin','admin_setor','gestao','ouvidoria','visualizador'].map(x=>`<option>${x}</option>`).join('')}</select><select id="us"><option value="">Todos os setores</option>${SETORES.map(s=>`<option value="${s.slug}">${esc(s.nome)}</option>`).join('')}</select><button class="btn sm" data-a="perfil">Salvar perfil</button></div>`:'';
 A.innerHTML=`<div class="wrap wide"><h1>Painel da gestão</h1><p class="mu">${esc(pf.nome||'')} · ${esc(pf.perfil)} <button class="skip" data-a="sair">sair</button></p>
<div class="fil"><select data-f="s"><option value="">Todos os setores</option>${SETORES.map(s=>`<option value="${s.slug}" ${f.s===s.slug?'selected':''}>${esc(s.nome)}</option>`).join('')}</select><select data-f="t"><option value="">Todos os turnos</option>${['Manhã','Tarde','Noite'].map(t=>`<option ${f.t===t?'selected':''}>${t}</option>`).join('')}</select><button class="btn sm" data-a="csv">Exportar para Excel</button></div>
<div class="kpis" style="margin-top:12px"><div class="kpi"><small>Nota média (1–5)</small><b>${K.media||'–'}</b></div><div class="kpi"><small title="Estimado da escala 1–5: nota 5 = promotor, 1–3 = detrator">NPS estimado</small><b>${K.n?K.nps:'–'}</b></div><div class="kpi"><small>Satisfação (notas 4–5)</small><b>${K.n?K.sat+'%':'–'}</b></div><div class="kpi"><small>Respostas (30 dias)</small><b>${K.n||0}</b></div></div>
<div class="card"><h2>Por setor</h2>${rows(k.por_setor,'nome')}</div><div class="card"><h2>Por turno</h2>${rows(k.por_turno,'turno')}</div>
<div class="card"><h2>Por equipe</h2>${rows(k.por_equipe,'equipe')}<p class="mu">Só aparece com 5 respostas ou mais, sempre agregado.</p></div>
<div class="card"><h2>Elogios para o TV Wall</h2>${(k.elogios||[]).map(e=>`<div class="row"><span style="flex:1">${esc(e.comentario)}</span><button class="btn sm sec" data-a="pub" data-v="${e.id}" data-p="${e.publicavel?0:1}">${e.publicavel?'Tirar do TV':'Mostrar no TV'}</button></div>`).join('')||'<p class="mu">Nenhum elogio.</p>'}</div>
<div class="card"><h2>Manifestações (Ouvidoria)</h2>${man.length?man.map(r=>`<div style="border-top:1px solid var(--bd);padding:10px 0"><b>${esc(r.protocolo||'Sem protocolo')}</b> <span class="tag">${esc(r.setor)}</span> <span class="tag">${esc(r.turno)}</span> <span class="tag">${new Date(r.criado_em).toLocaleDateString('pt-BR')}</span> <span class="tag">nota ${r.nota}</span> ${r.fechado?'<span class="tag ok">fechado</span>':''}<br>${esc(r.comentario)||'<span class="mu">(sem comentário)</span>'}${r.telefone?`<br>📞 ${esc(r.telefone)} ${r.observacao?'— '+esc(r.observacao):''}`:''}${r.protocolo&&['super_admin','ouvidoria'].includes(pf.perfil)?`<br><label><input type="checkbox" style="width:auto;margin:0 6px 0 0" ${r.contatado?'checked':''} data-a="contato" data-v="${r.id}">Entrei em contato</label>${r.fechado?`<br><span class="mu">Relato: ${esc(r.relato)}</span>`:`<br><input id="rl${r.id}" placeholder="Relato do que aconteceu"><button class="btn sm" data-a="fechar" data-v="${r.id}">Fechar chamado</button>`}`:''}</div>`).join(''):'<p class="mu">Nenhuma manifestação.</p>'}</div>${cad}</div>`}
async function actP(a,v,t){
 if(a==='login'){const{error}=await db.auth.signInWithPassword({email:$('em').value,password:$('pw').value});if(error)return fail(error)}
 else if(a==='sair')await db.auth.signOut();
 else if(a==='contato'){await rpc('atualizar_manifestacao',{p_id:v,p_contatado:t.checked})}
 else if(a==='fechar'){await rpc('atualizar_manifestacao',{p_id:v,p_relato:$('rl'+v).value,p_fechar:true})}
 else if(a==='pub'){await rpc('marcar_publicavel',{p_id:v,p_valor:t.dataset.p==='1'})}
 else if(a==='addsetor'){const{error}=await db.from('setores').insert({nome:$('cs').value.trim(),slug:$('cl').value.trim().toLowerCase()});if(error)return fail(error)}
 else if(a==='addperg'){const{error}=await db.from('perguntas').insert({setor_id:+$('ps').value,etapa:$('pe').value.trim(),texto:'Como foi o atendimento: '+$('pe').value.trim()+'?',ordem:50});if(error)return fail(error)}
 else if(a==='perfil'){await rpc('definir_perfil',{p_email:$('ue').value,p_nome:$('un').value,p_perfil:$('up').value,p_setor:$('us').value||null});alert('Perfil salvo.')}
 else if(a==='csv'){const L=await rpc('exportar_respostas',{p_setor:(st.f||{}).s||null});const q=x=>'"'+String(x==null?'':x).replace(/"/g,'""')+'"';
  const c=['protocolo;setor;data_hora;turno;nota;nps;tipo;comentario;jornada'].concat(L.map(x=>[x.protocolo,x.setor,new Date(x.data_hora).toLocaleString('pt-BR'),x.turno,x.nota,x.nps,x.tipo,q(x.comentario),q(JSON.stringify(x.jornada))].map(y=>y==null?'':y).join(';'))).join('\n');
  const u=URL.createObjectURL(new Blob(['\ufeff'+c],{type:'text/csv'}));const l=document.createElement('a');l.href=u;l.download='respostas.csv';l.click();return}
 route()}
/* ===== TV ===== */
async function tv(){const k=await rpc('tv_resumo');
 A.innerHTML=`<div class="tv"><h2>Como estamos? Sua opinião importa 💙</h2><div class="big">${k.media||'–'}</div><p style="font-size:24px">nota média de 5</p><div class="kpis" style="max-width:700px;margin:0 auto"><div class="kpi"><b>${k.sat==null?'–':k.sat+'%'}</b><small>satisfação</small></div><div class="kpi"><b>${k.n}</b><small>respostas (30 dias)</small></div><div class="kpi"><b>${k.hoje}</b><small>respostas hoje</small></div></div>${(k.elogios||[]).map(x=>`<p style="font-size:22px">“${esc(x)}” <span class="mu">— elogio anônimo</span></p>`).join('')}</div>`}
document.addEventListener('click',async e=>{const t=e.target.closest('[data-a]');if(!t)return;const a=t.dataset.a,v=t.dataset.v;if(a==='doc')e.preventDefault();
 if(t.tagName==='INPUT'&&t.type==='checkbox'&&e.target!==t)return;
 if(location.hash.startsWith('#/pesquisa/')){if(st.busy)return;st.busy=true;A.style.opacity='.6';try{await actS(a,v,t)}catch(x){alert(/muitas|ocupado/.test(x.message||'')?x.message:'Não foi possível enviar sua resposta. Verifique a internet e toque de novo.')}finally{st.busy=false;A.style.opacity=''}}else{try{await actP(a,v,t)}catch(x){fail(x)}}});
document.addEventListener('change',e=>{const f=e.target.dataset&&e.target.dataset.f;if(f){st.f=st.f||{};st.f[f]=e.target.value;route()}});
window.addEventListener('hashchange',route);route();
