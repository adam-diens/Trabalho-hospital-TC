import { request, session, saveSession, updateProfile, reloadSession } from './assets/js/api.js';
import { $, h, icon, brand, roles, bindForm, feedback, notice, toast, focusHeading } from './assets/js/ui.js';
import { mountPatient } from './assets/js/patient.js';
import { mountDashboard, mountManifestations, mountQrs, mountWall } from './assets/js/management.js';
import { mountAdmin } from './assets/js/admin.js';

const root=$('#app');
$('.skip-link').addEventListener('click',event=>{event.preventDefault();$('#main-content')?.focus();});
let generation=0,dispose=()=>{},recoveryToken=null,authMessage='';
const store={profile:null,sectors:[]};
try{localStorage.removeItem('fhdod.session');}catch{}

function context(){
  dispose();const controller=new AbortController();const n=++generation;const callbacks=[];
  dispose=()=>{controller.abort();callbacks.forEach(fn=>{try{fn();}catch{}});};
  return{signal:controller.signal,alive:()=>n===generation&&!controller.signal.aborted,cleanup:fn=>callbacks.push(fn)};
}
function navigate(hash){if(location.hash==='#'+hash)route();else location.hash=hash;}
function callback(){
  const fragment=new URLSearchParams(location.hash.slice(1));
  if(!fragment.has('access_token')&&!fragment.has('error_description'))return;
  const type=fragment.get('type'),token=fragment.get('access_token');
  if(type==='recovery'&&token){recoveryToken=token;saveSession(null);history.replaceState(null,'',location.pathname+location.search+'#senha');}
  else{authMessage=fragment.get('error_description')?'O link não está mais disponível. Solicite um novo e-mail.':'E-mail confirmado. Entre com sua conta institucional.';history.replaceState(null,'',location.pathname+location.search+'#login');}
}
async function logout(){
  const token=session()?.access_token;saveSession(null);store.profile=null;store.sectors=[];root.replaceChildren();navigate('login');
  if(token)try{await request('/auth/sair',{method:'POST',body:{},token});}catch(error){toast('Você saiu deste dispositivo. Não foi possível confirmar a saída no servidor.');}
}
window.addEventListener('fhdod:unauthorized',()=>{saveSession(null);store.profile=null;store.sectors=[];authMessage='Sua sessão expirou ou o acesso foi atualizado. Entre novamente.';navigate('login');});
window.addEventListener('hashchange',()=>{callback();route();});
window.addEventListener('pagehide',()=>dispose());
window.addEventListener('pageshow',event=>{if(event.persisted){reloadSession();root.replaceChildren();route();}});
root.addEventListener('click',event=>{if(event.target.closest('[data-logout]'))logout();});

function authShell(){
  root.innerHTML=`<main class="auth-layout" id="main-content" tabindex="-1"><aside class="auth-story">${brand('Pesquisa de satisfação')}<div class="story-copy"><div class="auth-emblem">${icon('heart')}</div><p class="eyebrow">Gestão da experiência do paciente</p><h2>Escutar também é transformar.</h2><p class="muted">Respostas que orientam decisões e ajudam a melhorar o cuidado, todos os dias.</p></div><p class="row" style="font-size:13px">${icon('shield')}Acesso restrito. Cada perfil vê apenas o que precisa.</p></aside><section class="auth-content"><div class="auth-box" id="auth-box"></div></section></main>`;
  return $('#auth-box',root);
}
function mountAuth(ctx,mode){
  const box=authShell();
  const resetting=mode==='senha';const signup=mode==='cadastro-conta';const recover=mode==='recuperar';
  const heading=resetting?'Defina sua nova senha':signup?'Criar minha conta':recover?'Recuperar minha senha':'Bem-vindo à gestão';
  box.innerHTML=`<h1>${heading}</h1><p class="muted">${resetting?'Escolha uma senha com pelo menos 12 caracteres.':signup?'Preencha seus dados. O Super Admin analisará sua solicitação e definirá sua função antes de liberar o acesso.':recover?'Enviaremos as orientações para o e-mail da conta elegível.':'Entre com sua conta institucional.'}</p>${authMessage?notice(authMessage):''}${resetting&&!recoveryToken&&!session()?notice('Abra o link de recuperação enviado ao seu e-mail ou entre com sua conta para alterar a senha.',true):''}<form id="auth-form"><div class="stack">${signup?'<label class="field">Nome completo<input name="nome" autocomplete="name" minlength="2" maxlength="120" required></label>':''}${!resetting?'<label class="field">E-mail institucional<input name="email" type="email" autocomplete="username" maxlength="254" placeholder="seu.email@hospital.org" required></label>':''}${!recover?`<label class="field">${resetting?'Nova senha':'Senha'}<input name="senha" type="password" autocomplete="${signup||resetting?'new-password':'current-password'}" minlength="${signup||resetting?12:1}" maxlength="128" required></label>`:''}${resetting?'<label class="field">Confirme a senha<input name="confirmacao" type="password" autocomplete="new-password" minlength="12" maxlength="128" required></label><label class="field">Código de confirmação (se solicitado)<input name="nonce" autocomplete="one-time-code" maxlength="256"><small>Preencha somente se o serviço de autenticação exigir confirmação adicional.</small></label>':''}${!signup&&!recover&&!resetting?'<a href="#recuperar" style="text-align:right;font-size:13px">Esqueci minha senha</a>':''}<button class="button full" type="submit" ${resetting&&!recoveryToken&&!session()?'disabled data-locked="true"':''}>${resetting?'Salvar nova senha':signup?'Enviar solicitação de conta':recover?'Enviar orientações':'Entrar'}</button><p class="form-feedback" role="alert"></p></div></form>${!signup&&!recover&&!resetting?`<div class="role-explanation"><b>Seu perfil é definido pela conta autenticada</b><p>O acesso é concedido pela administração do hospital.</p><dl><dt>Super Admin</dt><dd>Configuração institucional e permissões.</dd><dt>Admin de Setor</dt><dd>Cadastro e acompanhamento do próprio setor.</dd><dt>Gestão</dt><dd>Indicadores e comparações agregadas.</dd><dt>Ouvidoria</dt><dd>Manifestações e contatos autorizados.</dd><dt>Visualizador</dt><dd>Consulta de indicadores, sem edição.</dd></dl></div><a href="#cadastro-conta" class="text-button">Criar conta da equipe</a>`:'<a href="#login" class="text-button">Voltar para entrar</a>'}<div style="margin-top:20px"><a href="#pesquisa" class="text-button">Voltar à pesquisa</a></div>`;
  authMessage='';const form=$('#auth-form',box);
  bindForm(form,async values=>{
    if(resetting){
      if(values.get('senha')!==values.get('confirmacao'))throw new Error('As senhas precisam ser iguais.');
      const token=recoveryToken;
      await request('/auth/senha',{method:'PUT',auth:!token,token,body:{senha:values.get('senha'),...(values.get('nonce')?{nonce:values.get('nonce')}:{})},signal:ctx.signal});
      if(!ctx.alive())return;recoveryToken=null;saveSession(null);authMessage='Senha atualizada. Entre novamente com a nova senha.';navigate('login');
    }else if(recover){
      const data=await request('/auth/recuperar-senha',{method:'POST',body:{email:values.get('email')},signal:ctx.signal});if(ctx.alive())feedback(form,data.message,false);
    }else if(signup){
      const data=await request('/auth/cadastrar',{method:'POST',body:{email:values.get('email'),senha:values.get('senha'),nome:values.get('nome').trim()},signal:ctx.signal});if(ctx.alive()){form.reset();feedback(form,data.message,false);}
    }else{
      const data=await request('/auth/entrar',{method:'POST',body:{email:values.get('email'),senha:values.get('senha')},signal:ctx.signal});if(ctx.alive()){form.reset();saveSession(data);navigate('painel');}
    }
  });focusHeading(box);
}
function shell(view,profile){
  const canRead=['super_admin','admin_setor','gestao','ouvidoria'].includes(profile.papel);
  const canEdit=['super_admin','admin_setor'].includes(profile.papel);
  const nav=[['painel','Visão da gestão','dashboard'],...(canRead?[['ouvidoria','Ouvidoria','message']]:[]),...(canEdit?[['cadastro','Cadastro','settings']]:[]),['qrcodes','QR Codes','qr'],['tv','TV Wall','tv'],['pesquisa','Pesquisa','heart']];
  const title=nav.find(([id])=>id===view)?.[1]||'Cadastro';
  root.innerHTML=`<div class="management-layout"><aside class="sidebar">${brand('Pesquisa de satisfação')}<div><p class="nav-label">Área de gestão</p><nav aria-label="Gestão">${nav.map(([id,text,glyph])=>`<a href="#${id==='cadastro'?'cadastro/perguntas':id}" class="${view===id?'active':''}" ${view===id?'aria-current="page"':''}>${icon(glyph)}${h(text)}</a>`).join('')}</nav></div><div class="sidebar-bottom"><div class="sidebar-note">${icon('shield')}Escutar com cuidado.<br>Proteger cada resposta.</div><button class="button subtle logout-button" data-logout>${icon('logout')} Sair da conta</button></div></aside><div class="workspace"><header class="workspace-header"><span>FHDOD / ${h(title)}</span><div class="header-user"><span class="user-name">${h(profile.nome)}</span><span class="pill">${h(roles[profile.papel]||'Equipe')}</span><a class="text-button" href="#senha" aria-label="Alterar minha senha">${icon('user')}</a><button class="button subtle" data-logout style="padding:6px;min-height:40px">Sair</button></div></header><main id="main-content" class="workspace-content" tabindex="-1"><p class="loading">Carregando…</p></main></div></div>`;
  return $('#main-content',root);
}
async function route(){
  const ctx=context();
  const fragment=location.hash.slice(1)||'pesquisa';const [view,tab]=fragment.split('/');
  try{
    if(['login','recuperar','senha','cadastro-conta'].includes(view)){mountAuth(ctx,view);return;}
    if(view==='tv'){await mountWall(root,ctx);return;}
    if(!['painel','ouvidoria','cadastro','qrcodes'].includes(view)){await mountPatient(root,ctx);return;}
    if(!session()){authMessage='Entre para acessar a área da equipe.';navigate('login');return;}
    root.innerHTML='<main id="main-content"><p class="loading">Verificando seu acesso…</p></main>';
    const profile=await request('/me',{auth:true,signal:ctx.signal});if(!ctx.alive())return;
    updateProfile(profile);store.profile=profile;
    const permitted=view!=='cadastro'||['super_admin','admin_setor'].includes(profile.papel);
    if(!permitted||(view==='ouvidoria'&&profile.papel==='visualizador')){toast('Seu perfil não permite acessar esta área.');navigate('painel');return;}
    store.sectors=await request('/setores',{signal:ctx.signal});if(!ctx.alive())return;
    const content=shell(view,profile);
    document.title=`FHDOD · ${view==='painel'?'Visão da gestão':view==='ouvidoria'?'Ouvidoria':view==='qrcodes'?'QR Codes':'Cadastro'}`;
    if(view==='painel')await mountDashboard(content,ctx,store);
    else if(view==='ouvidoria')await mountManifestations(content,ctx,store);
    else if(view==='cadastro')await mountAdmin(content,ctx,store,tab);
    else await mountQrs(content,ctx,store);
    if(ctx.alive()&&!content.contains(document.activeElement))focusHeading(content);
  }catch(error){
    if(!ctx.alive()||error.name==='AbortError')return;
    if(error.status===401||error.status===403){saveSession(null);authMessage=error.message;navigate('login');return;}
    root.innerHTML=`<main id="main-content" class="patient-main"><section class="patient-card"><h1>Não foi possível abrir esta página.</h1>${notice(error.message,true)}<a class="button secondary" href="#login">Acesso da equipe</a><a href="#pesquisa" class="text-button">Voltar à pesquisa</a></section></main>`;
  }
}
callback();route();
