import { request } from './api.js';
import { $, $$, h, brand, icon, rating, feedback, bindForm, focusHeading, notice } from './ui.js';

export async function mountPatient(root, ctx) {
  const params = new URLSearchParams(location.search);
  const tablet = params.get('modo') === 'tablet';
  document.body.classList.toggle('tablet-kiosk', tablet);
  root.innerHTML = `<header class="public-header">${brand()}<nav class="public-nav" aria-label="Outras páginas"><a href="#tv">TV Wall</a><a href="#login">Acesso da equipe</a></nav></header><main id="main-content" class="patient-main" tabindex="-1"><section class="patient-card" id="survey-card"><p class="loading">Carregando a pesquisa…</p></section></main>`;
  const card = $('#survey-card', root);
  const model = { step: 'welcome', mode: tablet ? 'quick' : 'complete', sector: '', form: null, grade: null, index: 0, stages: {}, payload: null, sending: false, receipt: null };
  let sectors = [], timer, loadingVersion = 0;
  ctx.cleanup(() => { clearInterval(timer); document.body.classList.remove('tablet-kiosk'); const d = $('#privacy-dialog'); if (d.open) d.close(); });
  function actions(html) { return `<div class="patient-actions">${html}<p class="form-feedback" role="alert"></p></div>`; }
  function general() { return model.form.perguntas.find(p => p.obrigatoria); }
  function optional() { return model.form.perguntas.filter(p => !p.obrigatoria); }
  function symbol(name = 'heart') { return `<div class="patient-symbol">${icon(name)}</div>`; }
  function updateHeader() { $('.public-header .brand', root).outerHTML = brand(sectors.find(s => s.slug === model.sector)?.nome || 'Experiência do paciente'); }
  function render(focus = true) {
    if (!ctx.alive()) return;
    const step = model.step;
    card.removeAttribute('aria-busy');
    if (step === 'welcome') {
      card.innerHTML = `${symbol()}<div><p class="eyebrow">Pesquisa de satisfação</p><h1>Como foi seu atendimento?</h1><p>Sua experiência importa. Conte como foi o cuidado ${model.sector ? `no setor ${h(sectors.find(s => s.slug === model.sector)?.nome || '')}` : 'no hospital'}.</p></div><div class="patient-callout"><div>${icon('clock')}<b>É breve e simples de responder.</b></div><div>${icon('shield')}<span>Você não precisa se identificar.</span></div></div><label class="field">Setor do atendimento<select id="survey-sector"><option value="">Selecione o setor</option>${sectors.map(s => `<option value="${h(s.slug)}" ${s.slug === model.sector ? 'selected' : ''}>${h(s.nome)}</option>`).join('')}</select></label><fieldset class="survey-modes" style="border:0;padding:0;margin:0"><legend class="sr-only">Tipo de pesquisa</legend><label class="mode"><input type="radio" name="survey-mode" value="quick" ${model.mode === 'quick' ? 'checked' : ''}><span><b>Estou com pouco tempo</b>Somente a nota geral</span></label><label class="mode"><input type="radio" name="survey-mode" value="complete" ${model.mode === 'complete' ? 'checked' : ''}><span><b>Posso contar mais</b>Etapas opcionais</span></label></fieldset>${actions(`<button class="button full" id="survey-start" ${!model.form ? 'disabled' : ''}>Começar pesquisa</button><p class="patient-footnote">Participar é uma escolha sua e não muda seu atendimento.</p>`)}`;
      $('#survey-sector', card).addEventListener('change', event => { loadingVersion++; model.sector = event.target.value; model.form = null; render(false); updateHeader(); if (model.sector) loadForm(); });
      $$('[name=survey-mode]', card).forEach(input => input.addEventListener('change', () => { model.mode = input.value; }));
      $('#survey-start', card).addEventListener('click', openPrivacy);
    } else if (step === 'rating' || step === 'stage') {
      const question = step === 'rating' ? general() : optional()[model.index];
      const selected = step === 'rating' ? model.grade : model.stages[question.chave];
      card.innerHTML = `${step === 'stage' ? `<div><div class="progress-label"><b>Seu atendimento</b><span>${model.index + 1} de ${optional().length}</span></div><div class="progress-track">${optional().map((_, i) => `<i class="${i <= model.index ? 'done' : ''}"></i>`).join('')}</div></div>` : symbol()}<div><p class="eyebrow">${step === 'rating' ? 'Avaliação geral · obrigatória' : 'Etapa opcional'}</p><h1>${h(question.texto)}</h1><p>${step === 'rating' ? 'Pense na sua experiência no hospital.' : 'Responda somente se esta etapa fez parte do seu atendimento.'}</p></div>${rating(question.metrica, selected)}${actions(`<button class="button full" id="rating-next" ${!selected ? 'disabled' : ''}>${step === 'rating' && model.mode === 'quick' ? 'Enviar avaliação' : 'Continuar'}</button>${step === 'stage' ? '<button class="text-button" id="stage-skip">Pular esta etapa</button><button class="text-button" id="finish-now">Concluir agora</button>' : ''}<p class="patient-footnote">Sua resposta será enviada ao concluir a pesquisa.</p>`)}`;
      $$('[data-rating]', card).forEach(button => button.addEventListener('click', () => {
        const value = Number(button.dataset.rating);
        if (step === 'rating') model.grade = value; else model.stages[question.chave] = value;
        $$('[data-rating]', card).forEach(item => {
          const active = item === button; item.classList.toggle('selected', active); item.setAttribute('aria-pressed', String(active));
          const marker = $('i', item); if (marker) marker.innerHTML = active ? icon('check') : '';
        });
        $('#rating-next', card).disabled = false;
      }));
      $('#rating-next', card).addEventListener('click', () => {
        if (step === 'rating') {
          if (model.mode === 'quick') { submit(); return; }
          model.step = optional().length ? 'stage' : 'comment';
        } else { model.index++; if (model.index >= optional().length) model.step = 'comment'; }
        render();
      });
      $('#stage-skip', card)?.addEventListener('click', () => { delete model.stages[question.chave]; model.index++; if (model.index >= optional().length) model.step = 'comment'; render(); });
      $('#finish-now', card)?.addEventListener('click', () => submit());
    } else if (step === 'comment') {
      const low = model.grade <= model.form.limite_ouvidoria;
      const high = model.grade >= (general().metrica === 'nota_10' ? 8 : 4);
      card.innerHTML = `<div><p class="eyebrow">${low ? 'Ouvidoria · queremos ouvir você' : high ? 'Sua experiência faz a diferença' : 'Quer compartilhar mais?'}</p><h1>${low ? 'Sentimos muito. Vamos escutar você.' : high ? 'Que bom! Quer deixar um elogio?' : 'Sua opinião ajuda a melhorar.'}</h1><p>${low ? 'Conte à Ouvidoria o que podemos melhorar, se quiser.' : 'Conte o que foi bom ou o que podemos fazer melhor.'}</p></div><form id="comment-form" class="stack"><label class="field">Tipo de manifestação<select name="tipo"><option value="${low ? 'reclamacao' : high ? 'elogio' : 'sugestao'}">${low ? 'Reclamação' : high ? 'Elogio' : 'Sugestão'}</option>${['elogio','reclamacao','sugestao'].filter(t => t !== (low ? 'reclamacao' : high ? 'elogio' : 'sugestao')).map(t => `<option value="${t}">${{ elogio:'Elogio', reclamacao:'Reclamação', sugestao:'Sugestão' }[t]}</option>`).join('')}</select></label><label class="field">Seu comentário (opcional)<textarea name="comentario" maxlength="2000" rows="4" placeholder="Escreva aqui, se desejar."></textarea><small>Evite informar nomes, documentos ou detalhes de saúde.</small></label><label class="check"><input type="checkbox" id="anonymous" checked>Quero ficar anônimo</label><div id="contact-fields" class="stack" hidden><label class="field">Telefone para retorno<input type="tel" name="telefone" inputmode="tel" autocomplete="off" maxlength="16" placeholder="(DDD) 00000-0000"><small>Informe apenas se quiser um retorno da Ouvidoria.</small></label><label class="check"><input type="checkbox" name="consentimento">Autorizo o uso deste telefone para retorno da Ouvidoria, conforme o aviso de privacidade.</label></div><div id="anonymous-note" class="notice">No anonimato, não há retorno por telefone.</div><div class="patient-actions"><button class="button full" type="submit">Enviar pesquisa</button><p class="patient-footnote">Você pode enviar sem comentário e sem telefone.</p><p class="form-feedback" role="alert"></p></div></form>`;
      const form = $('#comment-form', card);
      $('#anonymous', card).addEventListener('change', event => {
        const anon = event.target.checked;
        $('#contact-fields', card).hidden = anon; $('#anonymous-note', card).hidden = !anon;
        form.elements.telefone.required = !anon; form.elements.consentimento.required = !anon;
        if (anon) { form.elements.telefone.value = ''; form.elements.consentimento.checked = false; }
      });
      form.elements.telefone.addEventListener('input', event => {
        const digits = event.target.value.replace(/\D/g, '').slice(0, 11);
        event.target.value = digits.length <= 2 ? digits : `(${digits.slice(0,2)}) ${digits.slice(2, digits.length > 10 ? 7 : 6)}${digits.length > 6 ? '-' + digits.slice(digits.length > 10 ? 7 : 6) : ''}`;
      });
      bindForm(form, async data => {
        const anon = $('#anonymous', card).checked;
        const comment = String(data.get('comentario') || '').trim();
        const phone = String(data.get('telefone') || '').replace(/\D/g, '');
        if (!anon && !/^[1-9][0-9]{9,10}$/.test(phone)) throw new Error('Informe um telefone válido com DDD.');
        await submit({ tipo: comment ? data.get('tipo') : null, comentario: comment || null, telefone: anon ? null : phone, consentimento: !anon && data.get('consentimento') === 'on' });
      });
    } else if (step === 'sending' || step === 'retry') {
      card.innerHTML = `${symbol('shield')}<div><p class="eyebrow">Sua participação importa</p><h1>${step === 'sending' ? 'Enviando sua resposta…' : 'Ainda não confirmamos o envio.'}</h1><p>${step === 'sending' ? 'Aguarde a confirmação antes de fechar esta página.' : 'Tente novamente para confirmar a mesma resposta. Você não precisa preencher tudo outra vez.'}</p></div>${step === 'sending' ? '<p class="loading">Aguarde um instante</p>' : notice(model.error, true)}${actions(step === 'retry' ? '<button class="button full" id="retry-send">Tentar enviar novamente</button><button class="text-button" id="restart-survey">Iniciar uma nova pesquisa</button>' : '')}`;
      if (step === 'retry') { $('#retry-send', card).addEventListener('click', () => submit()); $('#restart-survey', card).addEventListener('click', restart); }
    } else if (step === 'thanks') {
      card.innerHTML = `<div class="thank-symbol">${icon('check')}</div><div><p class="eyebrow">Pesquisa concluída</p><h1>Obrigado por compartilhar.</h1><p>Sua opinião ajuda a melhorar o cuidado ${h(sectors.find(s => s.slug === model.sector)?.nome || 'no hospital')}.</p></div>${model.receipt.protocolo ? `<div class="protocol"><span>${icon('message')} Protocolo da manifestação</span><strong>${h(model.receipt.protocolo)}</strong><p>Guarde esse número para tratar do seu relato com a Ouvidoria.</p></div>` : ''}<p>Obrigado por ajudar a construir um atendimento melhor para todos.</p>${actions(`<p class="patient-footnote" id="thanks-countdown">${tablet ? 'Uma nova pesquisa começará em 8 segundos.' : 'Você já pode fechar esta página.'}</p><button class="button secondary full" id="new-survey">Nova pesquisa</button>${tablet ? '<button class="text-button" id="pause-reset">Manter esta tela</button>' : ''}`)}`;
      $('#new-survey', card).addEventListener('click', restart);
      if (tablet) {
        let remaining = 8;
        timer = setInterval(() => { remaining--; if (!remaining) { clearInterval(timer); restart(); } else if ($('#thanks-countdown', card)) $('#thanks-countdown', card).textContent = `Uma nova pesquisa começará em ${remaining} segundos.`; }, 1000);
        $('#pause-reset', card).addEventListener('click', event => { clearInterval(timer); $('#thanks-countdown', card).textContent = 'Você pode guardar o protocolo com tranquilidade.'; event.currentTarget.hidden = true; });
      }
    }
    if (focus) focusHeading(card);
  }
  async function loadForm() {
    const version = ++loadingVersion;
    const btn = $('#survey-start', card); if (btn) { btn.disabled = true; btn.textContent = 'Carregando…'; }
    try {
      const form = await request(`/setores/${encodeURIComponent(model.sector)}/formulario`, { signal: ctx.signal });
      if (version !== loadingVersion || !ctx.alive()) return;
      if (!form.perguntas?.some(p => p.obrigatoria)) throw new Error('Pesquisa indisponível para este setor.');
      model.form = form; render(false);
    } catch (error) { if (version === loadingVersion && ctx.alive() && error.name !== 'AbortError') { feedback(card, error.message); if (btn?.isConnected) btn.textContent = 'Começar pesquisa'; if(!$('#retry-form',card)){const retry=document.createElement('button');retry.id='retry-form';retry.className='text-button';retry.textContent='Tentar carregar novamente';retry.onclick=()=>{retry.remove();loadForm();};$('.patient-actions',card).append(retry);} } }
  }
  function openPrivacy() {
    const dialog = $('#privacy-dialog');
    dialog.innerHTML = `<div class="row spread"><h2 id="privacy-title">Sua privacidade</h2><button class="button subtle" id="privacy-close" aria-label="Fechar aviso">${icon('close')}</button></div><p class="muted">Leia o aviso do hospital antes de participar.</p><div class="privacy-text">${h(model.form.privacidade_texto)}</div><div class="stack"><button class="button full" id="privacy-continue">Li o aviso e quero participar</button><button class="button secondary full" id="privacy-cancel">Agora não</button></div>`;
    dialog.showModal(); $('#privacy-close').onclick = $('#privacy-cancel').onclick = () => dialog.close();
    $('#privacy-continue').onclick = () => { dialog.close(); model.step = 'rating'; render(); };
  }
  async function submit(extra = {}) {
    if (model.sending) return;
    if (!model.payload) model.payload = Object.freeze({ chave_envio: crypto.randomUUID(), questionario_id: model.form.questionario_id, nota: model.grade,
      canal: tablet ? 'tablet' : 'celular', privacidade_versao: model.form.privacidade_versao, etapas: { ...model.stages }, ...extra });
    model.sending = true; model.step = 'sending'; render();
    try {
      const receipt = await request('/pesquisas', { method: 'POST', body: model.payload, signal: ctx.signal });
      if (!ctx.alive()) return;
      model.receipt = receipt; model.step = 'thanks'; render();
    } catch (error) { if (ctx.alive() && error.name !== 'AbortError') { model.error = error.message; model.step = 'retry'; render(); } }
    finally { model.sending = false; }
  }
  function restart() {
    clearInterval(timer); Object.assign(model, { step: 'welcome', grade: null, index: 0, stages: {}, payload: null, form: null, receipt: null, sending: false });
    render(); if (model.sector) loadForm();
  }
  try {
    sectors = await request('/setores', { signal: ctx.signal }); if (!ctx.alive()) return;
    const requested = params.get('setor');
    model.sector = sectors.some(s => s.slug === requested) ? requested : '';
    render(false); updateHeader(); if (requested && !model.sector) feedback(card, 'O setor do link não está disponível. Escolha um setor para continuar.');
    if (model.sector) await loadForm();
  } catch (error) {
    if (ctx.alive() && error.name !== 'AbortError') { card.innerHTML = `${symbol()}<h1>Não foi possível carregar a pesquisa.</h1>${notice(error.message, true)}<a class="button secondary" href="${h(location.pathname + location.search)}">Tentar novamente</a>`; }
  }
}
