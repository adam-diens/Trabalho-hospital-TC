import { request, query, listAll, saveSession } from './api.js';
import { $, $$, h, icon, option, sectorOptions, shifts, types, statuses, metricName, metricMax, number, date, today, daysAgo, notice, empty, lineChart, bar, download, toast, bindForm, feedback } from './ui.js';

export async function mountDashboard(root, ctx, store) {
  const profile = store.profile;
  let teams = [], data = null, selectedMetric = 'rostos_5', revision = 0, activeController;
  const filters = { inicio: daysAgo(29), fim: today(), setor: profile.papel === 'admin_setor' ? profile.setor_id : '', turno: '', equipe: '' };
  root.innerHTML = `<div class="page-heading"><div><h1>Visão da gestão</h1><p>A experiência do paciente, em uma visão do hospital.</p></div>${['super_admin','admin_setor','gestao'].includes(profile.papel) ? `<button class="button" id="export-csv">${icon('download')} Exportar Excel</button>` : ''}</div><form id="dashboard-filters" class="filters"><label class="field">Setor<select name="setor" ${profile.papel === 'admin_setor' ? 'disabled' : ''}>${sectorOptions(store.sectors, filters.setor, profile.papel === 'admin_setor' ? null : 'Todos os setores')}</select></label><label class="field">Turno<select name="turno">${option('','Todos os turnos','')}${Object.entries(shifts).map(([k,v]) => option(k,v,'')).join('')}</select></label><div class="period-fields"><label class="field">De<input type="date" name="inicio" value="${filters.inicio}" required></label><label class="field">Até<input type="date" name="fim" value="${filters.fim}" required></label></div>${profile.papel !== 'visualizador' ? '<label class="field">Equipe<select name="equipe"><option value="">Todas as equipes</option></select></label>' : ''}<div class="filter-actions"><button class="button secondary" type="submit">Aplicar filtros</button></div><label class="field">Escala exibida<select id="metric-filter"><option value="rostos_5">Rostinhos de 1 a 5</option><option value="nota_10">Notas de 1 a 10</option></select></label><div class="live-status" id="dashboard-live" role="status">Conectando aos indicadores</div><p class="form-feedback" role="alert"></p></form><div id="dashboard-results"><p class="loading">Carregando os indicadores…</p></div>`;
  const form = $('#dashboard-filters', root);
  const results = $('#dashboard-results', root);
  ctx.cleanup(() => activeController?.abort());
  function teamSelect() {
    const select = form.elements.equipe;
    if (select) { const sector=form.elements.setor.value;select.innerHTML = option('', 'Todas as equipes', select.value) + teams.filter(t => !sector || t.setor_id === sector).map(t => option(t.id, t.nome, select.value)).join(''); }
  }
  if (profile.papel !== 'visualizador') {
    try { teams = await listAll('/equipes',{setor:filters.setor},{signal:ctx.signal}); if (ctx.alive()) teamSelect(); }
    catch (error) { if (ctx.alive() && error.name !== 'AbortError') feedback(form, error.message); }
  }
  function renderData(summary) {
    const chartOpen=$('details.chart-data',results)?.open;
    const chartFocused=document.activeElement?.matches('.chart-data summary')&&results.contains(document.activeElement);
    data = summary;
    const metrics = summary.por_metrica || [];
    const selected = metrics.find(m => m.metrica === selectedMetric);
    const max = metricMax(selectedMetric);
    const trend = (summary.tendencia || []).filter(r => r.metrica === selectedMetric);
    const stages = summary.etapas || [];
    const sectors = (summary.por_setor || []).filter(r => r.metrica === selectedMetric);
    const groups = (summary.por_equipe || []).filter(r => r.metrica === selectedMetric);
    results.innerHTML = `<div class="kpis"><article class="kpi"><small>Nota média · ${h(metricName(selectedMetric))}</small><strong>${h(number(selected?.media))}<span style="font-size:16px;font-weight:400"> / ${max}</span></strong><p>${h(number(selected?.n || 0,0))} respostas nesta escala</p></article><article class="kpi"><small>Total de respostas</small><strong>${h(number(summary.respostas || 0,0))}</strong><p>${h(date(filters.inicio))} a ${h(date(filters.fim))}</p></article><article class="kpi"><small>Satisfação · escala selecionada</small><strong>${selected?.satisfacao === null || selected?.satisfacao === undefined ? '—' : h(number(selected.satisfacao)) + '%'}</strong><p>Notas ${max === 5 ? '4 e 5' : '8 a 10'} · ${h(number(summary.manifestacoes || 0,0))} manifestações no total</p></article></div><div class="dashboard-grid"><article class="panel"><div class="panel-header"><h2>Evolução no tempo</h2><small>Média / ${max}</small></div>${lineChart(trend, selectedMetric)}</article><article class="panel"><div class="panel-header"><h2>Notas por etapa da jornada</h2><small>Etapas opcionais</small></div>${stages.length ? stages.map(r => bar(r.texto, r.media, metricMax(r.metrica), r.n, `Versão ${r.versao} · ${metricName(r.metrica)}`)).join('') : empty('Nenhuma etapa avaliada neste período.')}</article><article class="panel"><div class="panel-header"><h2>Resultados por setor</h2><small>Média / ${max}</small></div>${sectors.length ? sectors.map(r => bar(r.nome, r.media, max, r.n)).join('') : empty('Sem respostas nesta escala.')}</article><article class="panel"><div class="panel-header"><h2>Do hospital à equipe</h2><small>Setor · turno · equipe</small></div>${profile.papel === 'visualizador' ? empty('Seu perfil permite consultar os indicadores gerais.') : groups.length ? groups.map(r => bar(r.nome, r.media, max, r.n)).join('') : empty('Equipes são exibidas a partir de 5 respostas na mesma escala.')}<p class="footnote">${h(summary.equipes_aviso || 'A associação considera o horário da resposta e a escala. Não representa atribuição individual de responsabilidade.')}</p></article><article class="panel"><div class="panel-header"><h2>Distribuição das avaliações</h2><small>${h(metricName(selectedMetric))}</small></div>${Array.from({length:max},(_,i)=>max-i).map(n => { const row = (summary.distribuicao || []).find(r => r.metrica === selectedMetric && Number(r.nota) === n); const count = Number(row?.n || 0); return bar(`Nota ${n}`,count,Math.max(1,Number(selected?.n || 0)),undefined); }).join('')}</article><article class="panel"><div class="panel-header"><h2>Resultados por turno</h2><small>Média / ${max}</small></div>${(summary.por_turno || []).filter(r=>r.metrica===selectedMetric).map(r => bar(shifts[r.turno] || r.turno,r.media,max,r.n)).join('') || empty('Sem avaliações por turno neste período.')}<p class="footnote">As médias de escalas diferentes são apresentadas separadamente.</p></article></div><p class="footnote">Atualizado em ${h(date(summary.atualizado_em || new Date().toISOString(),true))}.</p>`;
    if(chartOpen&&$('details.chart-data',results))$('details.chart-data',results).open=true;
    if(chartFocused)$('.chart-data summary',results)?.focus({preventScroll:true});
  }
  $('#metric-filter', root).addEventListener('change', event => { selectedMetric = event.target.value; if (data) renderData(data); });
  form.elements.setor.addEventListener('change', () => { if(form.elements.equipe)form.elements.equipe.value='';teamSelect(); });
  bindForm(form, async values => {
    const start = values.get('inicio'), end = values.get('fim');
    const days = (new Date(end) - new Date(start)) / 86400000 + 1;
    if (days < 1 || days > 366) throw new Error('Escolha um período de até 366 dias em ordem crescente.');
    Object.assign(filters,{inicio:start,fim:end,setor:profile.papel==='admin_setor'?profile.setor_id:values.get('setor'),turno:values.get('turno'),equipe:values.get('equipe') || ''});
    await load();
  });
  async function stream(seq, signal) {
    const live = $('#dashboard-live', root);
    while (!signal.aborted && ctx.alive() && seq === revision) {
      try {
        const response = await request('/painel/stream?' + query(filters), { auth:true,signal,stream:true });
        if (!ctx.alive() || signal.aborted) { await response.body.cancel(); return; }
        live.textContent = 'Atualização automática ativa'; live.classList.add('connected');
        const reader = response.body.getReader(); const decoder = new TextDecoder(); let buffer = '';
        try {
          while (!signal.aborted) {
            const {done,value} = await reader.read(); if (done) break;
            buffer += decoder.decode(value,{stream:true});
            let end;
            while ((end = buffer.indexOf('\n\n')) >= 0) {
              const block = buffer.slice(0,end); buffer = buffer.slice(end+2);
              const event = block.split('\n').find(l=>l.startsWith('event:'))?.slice(6).trim();
              const text = block.split('\n').filter(l=>l.startsWith('data:')).map(l=>l.slice(5).trim()).join('\n');
              if (event === 'painel' && text && ctx.alive() && seq === revision) renderData(JSON.parse(text));
              if (event === 'erro') { const error = JSON.parse(text);if(['FORBIDDEN','INVALID_SESSION','AUTH_REQUIRED'].includes(error.code)){try{const active=await request('/me',{auth:true,signal});if(active.papel!==profile.papel||active.setor_id!==profile.setor_id){saveSession(null);window.dispatchEvent(new Event('fhdod:unauthorized'));}}catch(e){if([401,403].includes(e.status)){saveSession(null);window.dispatchEvent(new Event('fhdod:unauthorized'));}}}throw new Error(error.message || 'Atualização interrompida.'); }
            }
          }
        } finally { await reader.cancel().catch(()=>{}); }
      } catch (error) { if (signal.aborted || !ctx.alive()) return; live.textContent = 'Reconectando aos indicadores…'; live.classList.remove('connected'); }
      await new Promise(resolve => { const finish=()=>{clearTimeout(timer);signal.removeEventListener('abort',finish);resolve();};const timer=setTimeout(finish,15000);signal.addEventListener('abort',finish,{once:true}); });
    }
  }
  async function load() {
    activeController?.abort(); activeController = new AbortController(); const seq = ++revision;
    const signal = AbortSignal.any([ctx.signal, activeController.signal]);
    $('#dashboard-live', root).textContent = 'Atualizando os indicadores…';
    data=null;results.innerHTML='<p class="loading">Carregando os indicadores…</p>';
    let summary;
    try {summary=await request('/painel?' + query(filters), {auth:true,signal});}
    catch(error){if(ctx.alive()&&seq===revision&&!signal.aborted){results.innerHTML=notice(error.message,true);$('#dashboard-live',root).textContent='Indicadores indisponíveis';}throw error;}
    if (!ctx.alive() || seq !== revision) return;
    if (!(summary.por_metrica || []).some(r=>r.metrica===selectedMetric) && summary.por_metrica?.length) { selectedMetric=summary.por_metrica[0].metrica; $('#metric-filter',root).value=selectedMetric; }
    renderData(summary); stream(seq,signal);
  }
  $('#export-csv', root)?.addEventListener('click', async event => {
    const button = event.currentTarget; button.disabled = true;
    try { const blob = await request('/exportacoes.csv?' + query(filters), {auth:true,blob:true,signal:ctx.signal}); if(ctx.alive()) download(blob,`respostas-${filters.inicio}-${filters.fim}.csv`); }
    catch(error){if(ctx.alive()&&error.name!=='AbortError')toast(error.message);} finally{if(button.isConnected)button.disabled=false;}
  });
  try { await load(); } catch(error){if(ctx.alive()&&error.name!=='AbortError'){results.innerHTML=notice(error.message,true);$('#dashboard-live',root).textContent='Indicadores indisponíveis';}}
}

export async function mountManifestations(root, ctx, store) {
  const profile=store.profile;
  const canAttend=['ouvidoria','super_admin'].includes(profile.papel);
  let rows=[],cursor=null,selected=null,detail=null,draft='',listSeq=0,detailSeq=0;
  const filter={setor:profile.papel==='admin_setor'?profile.setor_id:'',situacao:''};
  root.innerHTML=`<div class="page-heading"><div><h1>Ouvidoria</h1><p>Acolha as manifestações e acompanhe cada retorno.</p></div><span class="pill">${canAttend?'Atendimento autorizado':'Consulta de manifestações'}</span></div><form id="manifest-filters" class="filters"><label class="field">Protocolo nos registros carregados<input name="protocolo" type="search" placeholder="Digite o número"></label><label class="field">Situação<select name="situacao">${option('','Todas as situações','')}${Object.entries(statuses).map(([k,v])=>option(k,v,'')).join('')}</select></label><label class="field">Setor<select name="setor" ${profile.papel==='admin_setor'?'disabled':''}>${sectorOptions(store.sectors,filter.setor,profile.papel==='admin_setor'?null:'Todos os setores')}</select></label><button class="button secondary" type="submit">Aplicar filtros</button><p class="form-feedback" role="alert"></p></form><div class="two-columns"><section><div class="row spread"><h2>Em acompanhamento</h2><small class="muted" id="queue-count"></small></div><div id="queue-list" class="queue-list"></div><button id="queue-more" class="button secondary full" style="margin-top:16px" hidden>Carregar mais</button></section><aside id="manifest-detail" class="panel detail-panel">${empty('Selecione uma manifestação para consultar os detalhes.')}</aside></div>`;
  const form=$('#manifest-filters',root),list=$('#queue-list',root),panel=$('#manifest-detail',root);
  function renderList(){
    const search=form.elements.protocolo.value.trim();const visible=rows.filter(r=>!search||String(r.protocolo).includes(search));
    $('#queue-count',root).textContent=`${visible.length} de ${rows.length} carregadas`;
    list.innerHTML=visible.length?visible.map(item=>`<button class="queue-card ${item.id===selected?'selected':''}" data-manifest="${h(item.id)}"><span class="row spread"><strong>Protocolo ${h(item.protocolo)}</strong><span class="pill ${item.tipo==='reclamacao'?'alert':'neutral'}">${h(types[item.tipo]||item.tipo)}</span></span><p>${h(item.setor)} · ${h(date(item.criado_em,true))}</p><span class="row spread"><small>${h(statuses[item.situacao])}</small><small>Nota ${h(item.nota)} / ${metricMax(item.metrica)}</small></span></button>`).join(''):empty(search?'Nenhum protocolo entre os registros carregados.':'Nenhuma manifestação encontrada.');
    $$('[data-manifest]',list).forEach(button=>button.addEventListener('click',()=>{selected=button.dataset.manifest;draft='';renderList();loadDetail();}));
  }
  async function loadList(append=false){
    const seq=++listSeq;if(!append)list.innerHTML='<p class="loading">Buscando manifestações…</p>';
    const page=await request('/manifestacoes?'+query({...filter,limite:50,antes:append?cursor:null}),{auth:true,signal:ctx.signal,page:true});
    if(!ctx.alive()||seq!==listSeq)return;
    rows=append?[...rows,...page.data.filter(r=>!rows.some(old=>old.id===r.id))]:page.data;cursor=page.cursor;
    $('#queue-more',root).hidden=page.data.length<50||!cursor;renderList();
  }
  function renderDetail(){
    const state=detail.situacao;
    panel.innerHTML=`<div class="row spread"><h2>Protocolo ${h(detail.protocolo)}</h2><span class="pill neutral">${h(statuses[state])}</span></div><p class="muted" style="font-size:12px">${h(types[detail.tipo])} · ${h(date(detail.criado_em,true))}</p><h3>Manifestação recebida</h3><div class="quote">${h(detail.comentario||'Solicitação de retorno sem comentário.')}</div>${canAttend?`<p class="notice" style="margin-top:16px">${detail.telefone?`Telefone autorizado: ${h(detail.telefone)}`:'Telefone não informado ou removido conforme a retenção.'}</p>`:''}${canAttend&&detail.interacoes?.length?`<h3 style="margin-top:22px">Histórico de atendimento</h3>${detail.interacoes.map(i=>`<div class="interaction">${h(i.relato)}<small>${h(statuses[i.situacao])} · ${h(date(i.criado_em,true))}</small></div>`).join('')}`:''}${canAttend&&state!=='encerrada'?`<form id="attendance-form" class="stack" style="margin-top:22px"><label class="field">Situação do atendimento<select name="situacao"><option value="em_atendimento">Em atendimento</option><option value="encerrada">Encerrar chamado</option></select></label><label class="field">Relato do atendimento (obrigatório)<textarea name="relato" minlength="3" maxlength="4000" required rows="4">${h(draft)}</textarea></label><button class="button full" type="submit">Salvar atendimento</button><p class="form-feedback" role="alert"></p><button class="text-button" id="refresh-detail" type="button" hidden>Atualizar chamado e manter meu relato</button></form>`:empty(state==='encerrada'?'Este atendimento foi encerrado.':'Seu perfil permite consultar a manifestação, sem registrar atendimento.')}`;
    const attend=$('#attendance-form',panel);
    if(attend)bindForm(attend,async values=>{
      const target=selected,revision=detail.revisao;
      try{
        await request(`/manifestacoes/${encodeURIComponent(target)}/atendimentos`,{method:'POST',auth:true,body:{revisao:revision,situacao:values.get('situacao'),relato:values.get('relato')},signal:ctx.signal});
        if(!ctx.alive())return;toast('Atendimento registrado.');if(selected===target&&attend.isConnected){draft='';await Promise.all([loadDetail(),loadList()]);}else await loadList();
      }catch(error){if(error.status===409&&selected===target&&attend.isConnected){draft=String(values.get('relato'));const btn=$('[type=submit]',attend);btn.dataset.locked='true';btn.disabled=true;$('#refresh-detail',attend).hidden=false;}throw error;}
    });
    $('#refresh-detail',panel)?.addEventListener('click',()=>loadDetail());
  }
  async function loadDetail(){
    const seq=++detailSeq;panel.innerHTML='<p class="loading">Carregando manifestação…</p>';
    try{const result=await request('/manifestacoes/'+encodeURIComponent(selected),{auth:true,signal:ctx.signal});if(!ctx.alive()||seq!==detailSeq)return;detail=result;renderDetail();}
    catch(error){if(ctx.alive()&&seq===detailSeq&&error.name!=='AbortError')panel.innerHTML=notice(error.message,true);}
  }
  form.elements.protocolo.addEventListener('input',renderList);
  bindForm(form,async values=>{filter.situacao=values.get('situacao');filter.setor=profile.papel==='admin_setor'?profile.setor_id:values.get('setor');selected=null;detail=null;detailSeq++;panel.innerHTML=empty('Selecione uma manifestação.');await loadList();});
  $('#queue-more',root).addEventListener('click',async event=>{const button=event.currentTarget;button.disabled=true;try{await loadList(true);}catch(error){if(ctx.alive())toast(error.message);}finally{if(button.isConnected)button.disabled=false;}});
  try{await loadList();}catch(error){if(ctx.alive()&&error.name!=='AbortError')list.innerHTML=notice(error.message,true);}
}

export async function mountQrs(root,ctx){
  root.innerHTML=`<div class="page-heading"><div><h1>QR Codes por setor</h1><p>Um acesso simples para cada experiência.</p></div><button class="button secondary no-print" id="print-qrs">Imprimir códigos</button></div><div class="notice no-print" style="margin-bottom:20px">Confira o endereço público do hospital antes de imprimir. Cada código abre o setor e o tipo de dispositivo indicados.</div><div id="qr-grid" class="qr-grid"><p class="loading">Preparando os códigos…</p></div>`;
  $('#print-qrs',root).disabled=true;$('#print-qrs',root).addEventListener('click',()=>window.print());
  const urls=[];ctx.cleanup(()=>urls.forEach(url=>URL.revokeObjectURL(url)));
  try{
    const codes=await request('/qrcodes',{auth:true,signal:ctx.signal});if(!ctx.alive())return;
    if(!codes.length){$('#qr-grid',root).innerHTML=empty('Nenhum setor ativo disponível para gerar QR Codes.');return;}
    $('#qr-grid',root).innerHTML=codes.map((c,i)=>`<article class="panel qr-card" data-qr="${i}"><h2>${h(c.setor)}</h2><span class="pill neutral">${c.canal==='tablet'?'Tablet':'Celular'}</span><div style="min-height:230px"><img alt="QR Code de ${h(c.setor)} para ${h(c.canal)}" hidden><p class="loading">Gerando QR Code…</p></div><p class="qr-url">${h(c.url)}</p><div class="row"><button class="button secondary copy-link">Copiar link</button><a class="button secondary qr-download" hidden>Baixar SVG</a></div></article>`).join('');
    // Sequencial para não disparar dezenas de verificações de perfil de uma vez.
    for(let i=0;i<codes.length&&ctx.alive();i++){
      const c=codes[i],card=$(`[data-qr="${i}"]`,root),url=new URL(c.url),slug=url.searchParams.get('setor');
      $('.copy-link',card).addEventListener('click',async()=>{try{await navigator.clipboard.writeText(c.url);toast('Link copiado.');}catch{toast('Não foi possível copiar. Selecione o endereço exibido no cartão.');}});
      try{
        const blob=await request(`/qrcodes/${encodeURIComponent(slug)}/${encodeURIComponent(c.canal)}`,{auth:true,blob:true,signal:ctx.signal});if(!ctx.alive())return;
        const local=URL.createObjectURL(blob);urls.push(local);const img=$('img',card);img.src=local;await img.decode();if(!ctx.alive())return;img.hidden=false;$('.loading',card).remove();const link=$('.qr-download',card);link.href=local;link.download=`pesquisa-${slug}-${c.canal}.svg`;link.hidden=false;
      }catch(error){if(ctx.alive()&&error.name!=='AbortError')$('.loading',card).outerHTML=notice(error.message,true);}
    }
    if(ctx.alive())$('#print-qrs',root).disabled=$$('.qr-card img:not([hidden])',root).length!==codes.length;
  }catch(error){if(ctx.alive()&&error.name!=='AbortError')$('#qr-grid',root).innerHTML=notice(error.message,true);}
}

export async function mountWall(root,ctx){
  let snapshot=null,metric='rostos_5',timer,seq=0;
  root.innerHTML=`<main class="wall" id="main-content" tabindex="-1"><header class="wall-header"><div id="wall-brand"></div><div class="wall-meta"><p class="eyebrow">A voz de quem recebe cuidado</p><span id="wall-updated">Buscando indicadores…</span><div class="row" style="justify-content:end;margin-top:10px"><label class="sr-only" for="wall-metric">Escala exibida</label><select id="wall-metric" style="width:auto"><option value="rostos_5">Rostinhos de 1 a 5</option><option value="nota_10">Notas de 1 a 10</option></select><a class="text-button" href="#pesquisa">Voltar à pesquisa</a></div></div></header><div id="wall-results"><p class="loading">Carregando indicadores públicos…</p></div><footer class="wall-thanks"><h2>Sua voz faz parte do nosso cuidado.</h2><p>Obrigado por compartilhar sua experiência com a FHDOD.</p><small class="muted">Painel público · Somente resultados agregados · Sem identificação individual</small></footer></main>`;
  const {brand,face}=await import('./ui.js');$('#wall-brand',root).innerHTML=brand('Pesquisa de satisfação');
  function render(){
    const row=snapshot.metricas?.find(r=>r.metrica===metric);
    const area=$('#wall-results',root);
    if(!row){area.innerHTML=`<section class="panel">${empty('Ainda não há um grupo de respostas publicado nesta escala. Novos resultados aparecem após a atualização dos indicadores agregados.')}</section>`;$('#wall-updated',root).textContent='Aguardando publicação de indicadores';return;}
    $('#wall-updated',root).textContent='Publicado em '+date(row.publicado_em,true);
    area.innerHTML=`<div class="wall-grid"><section class="wall-hero"><h1>Experiência dos pacientes</h1><div class="row spread"><div class="wall-value">${h(number(row.media))}<small> / ${metricMax(metric)}</small></div><div class="wall-face">${face(Math.max(1,Math.min(5,Math.round(Number(row.media)/metricMax(metric)*5))))}</div></div><p>${h(metricName(metric))} · Todo o hospital</p><div class="wall-count"><strong>${h(number(row.n,0))}</strong><span><b>respostas no período</b><br>Cada participação ajuda a melhorar.</span></div></section><section class="panel wall-facts"><h2>O cuidado em números</h2><div class="fact"><strong>${row.satisfacao==null?'—':h(number(row.satisfacao))+'%'}</strong><p>Satisfação · notas ${metricMax(metric)===5?'4 e 5':'8 a 10'}</p></div><div class="fact"><strong style="font-size:22px">${h(date(row.inicio))} a ${h(date(row.fim))}</strong><p>Período das avaliações publicadas</p></div><p class="footnote">As escalas são apresentadas separadamente. Os resultados são publicados em grupos para proteger cada resposta.</p></section></div>`;
  }
  $('#wall-metric',root).addEventListener('change',event=>{metric=event.target.value;if(snapshot)render();});
  async function load(){const version=++seq;try{const data=await request('/tv',{signal:ctx.signal});if(!ctx.alive()||version!==seq)return;snapshot=data;if(!data.metricas?.some(r=>r.metrica===metric)&&data.metricas?.length){metric=data.metricas[0].metrica;$('#wall-metric',root).value=metric;}render();}catch(error){if(ctx.alive()&&error.name!=='AbortError'){$('#wall-results',root).innerHTML=notice(error.message,true);$('#wall-updated',root).textContent='Indicadores temporariamente indisponíveis';}}}
  await load();if(ctx.alive())timer=setInterval(load,60000);ctx.cleanup(()=>clearInterval(timer));
}
