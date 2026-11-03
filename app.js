/*
 * FHDOD — Experiência do paciente
 * Ordem do arquivo: configuração, estado/utilitários, API e sessão,
 * pesquisa, painel de gestão, QR Codes, TV Wall, navegação e inicialização.
 */

/* 1. CONFIGURAÇÃO E CONSTANTES */
const API_BASE = '/api';
const SETORES = [
  { slug: 'pa', nome: 'Pronto Atendimento' },
  { slug: 'int', nome: 'Internação' },
  { slug: 'enfermagem', nome: 'Enfermagem' },
  { slug: 'lab', nome: 'Laboratório' },
  { slug: 'rx', nome: 'Raio-X' },
  { slug: 'refeitorio', nome: 'Refeitório' },
];
const NOTAS = [
  { valor: 1, emoji: '😞', texto: 'Péssimo' },
  { valor: 2, emoji: '🙁', texto: 'Ruim' },
  { valor: 3, emoji: '😐', texto: 'Regular' },
  { valor: 4, emoji: '🙂', texto: 'Bom' },
  { valor: 5, emoji: '😍', texto: 'Ótimo' },
];
const PERGUNTAS_POR_SETOR = {
  pa: [
    { chave: 'recepcao', nome: 'Recep\u00e7\u00e3o', pergunta: 'Como foi o acolhimento na recep\u00e7\u00e3o?', icone: '\u2302' },
    { chave: 'triagem', nome: 'Triagem', pergunta: 'Como foi sua experi\u00eancia na triagem?', icone: '+' },
    { chave: 'enfermagem', nome: 'Enfermagem', pergunta: 'Como foi o cuidado da equipe de enfermagem?', icone: '\u2661' },
    { chave: 'medico', nome: 'Atendimento m\u00e9dico', pergunta: 'Como foi o atendimento m\u00e9dico?', icone: '\u2695' },
    { chave: 'orientacoes', nome: 'Orienta\u00e7\u00f5es', pergunta: 'As orienta\u00e7\u00f5es recebidas foram claras?', icone: '\u2713' },
  ],
  int: [
    { chave: 'int_recepcao', nome: 'Admiss\u00e3o', pergunta: 'Como foi o processo de interna\u00e7\u00e3o?', icone: '\u2302' },
    { chave: 'int_enfermagem', nome: 'Enfermagem', pergunta: 'Como foi o cuidado da equipe de enfermagem?', icone: '\u2661' },
    { chave: 'int_medico', nome: 'Equipe m\u00e9dica', pergunta: 'Como foi o atendimento da equipe m\u00e9dica?', icone: '\u2695' },
    { chave: 'int_conforto', nome: 'Conforto', pergunta: 'Como avalia o conforto do quarto e do leito?', icone: '\u2302' },
    { chave: 'int_limpeza', nome: 'Limpeza', pergunta: 'Como avalia a limpeza e organiza\u00e7\u00e3o do ambiente?', icone: '\u2726' },
  ],
  lab: [
    { chave: 'lab_recepcao', nome: 'Recep\u00e7\u00e3o', pergunta: 'Como foi o acolhimento na recep\u00e7\u00e3o do laborat\u00f3rio?', icone: '\u2302' },
    { chave: 'lab_orientacao', nome: 'Orienta\u00e7\u00f5es', pergunta: 'As orienta\u00e7\u00f5es para o exame foram claras?', icone: '\u2713' },
    { chave: 'lab_espera', nome: 'Tempo de espera', pergunta: 'Como avalia o tempo de espera para o exame?', icone: '\u25f7' },
    { chave: 'lab_coleta', nome: 'Coleta / exame', pergunta: 'Como foi o atendimento durante a coleta ou exame?', icone: '\u2661' },
    { chave: 'lab_ambiente', nome: 'Ambiente', pergunta: 'Como avalia a limpeza e organiza\u00e7\u00e3o do laborat\u00f3rio?', icone: '\u2726' },
  ],
  rx: [
    { chave: 'rx_recepcao', nome: 'Recep\u00e7\u00e3o', pergunta: 'Como foi o acolhimento na recep\u00e7\u00e3o do Raio-X?', icone: '\u2302' },
    { chave: 'rx_orientacao', nome: 'Orienta\u00e7\u00f5es', pergunta: 'As orienta\u00e7\u00f5es antes do exame foram claras?', icone: '\u2713' },
    { chave: 'rx_espera', nome: 'Tempo de espera', pergunta: 'Como avalia o tempo de espera para o exame?', icone: '\u25f7' },
    { chave: 'rx_atendimento', nome: 'Atendimento', pergunta: 'Como foi o atendimento da equipe durante o exame?', icone: '\u2661' },
    { chave: 'rx_ambiente', nome: 'Ambiente', pergunta: 'Como avalia o conforto e a limpeza do ambiente?', icone: '\u2726' },
  ],
  enfermagem: [
    { chave: 'enf_acolhimento', nome: 'Acolhimento', pergunta: 'Como foi o acolhimento da equipe de enfermagem?', icone: '\u2661' },
    { chave: 'enf_atencao', nome: 'Atenção', pergunta: 'Como foi a atenção da equipe de enfermagem durante o cuidado?', icone: '\u2661' },
    { chave: 'enf_resposta', nome: 'Disponibilidade', pergunta: 'Quando chamou, a equipe respondeu em tempo adequado?', icone: '\u25f7' },
    { chave: 'enf_orientacoes', nome: 'Orientações', pergunta: 'As orientações da equipe de enfermagem foram claras?', icone: '\u2713' },
    { chave: 'enf_respeito', nome: 'Respeito e cuidado', pergunta: 'Você se sentiu respeitado e bem cuidado pela equipe?', icone: '\u2661' },
  ],
  refeitorio: [
    { chave: 'ref_acolhimento', nome: 'Atendimento', pergunta: 'Como foi o atendimento no refeit\u00f3rio?', icone: '\u2661' },
    { chave: 'ref_sabor', nome: 'Sabor', pergunta: 'Como avalia o sabor da refei\u00e7\u00e3o?', icone: '\u2668' },
    { chave: 'ref_temperatura', nome: 'Temperatura', pergunta: 'A refei\u00e7\u00e3o estava na temperatura adequada?', icone: '\u2668' },
    { chave: 'ref_variedade', nome: 'Variedade', pergunta: 'Como avalia a variedade das refei\u00e7\u00f5es?', icone: '\u2726' },
    { chave: 'ref_higiene', nome: 'Higiene', pergunta: 'Como avalia a limpeza do refeit\u00f3rio?', icone: '\u2713' },
  ],
};
const STORAGE = { session: 'fhdod.session', device: 'fhdod.device' };

/* 2. ESTADO DA APLICAÇÃO E UTILITÁRIOS */
const state = {
  view: 'patient', survey: { step: 'welcome', setor: null, setorId: null, pergunta: '', respostaId: null, jornada: {}, etapasSelecionadas: [], etapaIndex: 0, nota: null, desejaRetorno: false },
  session: readSession(), profile: null, filters: { period: 'all', setor: 'all', shift: 'all' },
  dashboard: null, wallTimer: null, toastTimer: null,
};
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const formatDate = value => value ? new Date(value).toLocaleDateString('pt-BR') : '—';
const setorPorSlug = slug => SETORES.find(setor => setor.slug === slug) || SETORES[0];
const etapasDisponiveis = survey => (PERGUNTAS_POR_SETOR[survey.setor] || PERGUNTAS_POR_SETOR.pa).map((etapa, index) => ({ ...etapa, index }));
const deviceId = () => {
  try {
    let id = localStorage.getItem(STORAGE.device);
    if (!id) { id = crypto.randomUUID(); localStorage.setItem(STORAGE.device, id); }
    return id;
  } catch { return null; }
};
function readSession() {
  try { return JSON.parse(localStorage.getItem(STORAGE.session) || 'null'); }
  catch { return null; }
}
function saveSession(session) {
  state.session = session;
  if (session) localStorage.setItem(STORAGE.session, JSON.stringify(session));
  else localStorage.removeItem(STORAGE.session);
}
function toast(message, error = false) {
  const node = $('#toast');
  if (!node) return;
  node.textContent = message;
  node.classList.toggle('error', error);
  node.classList.add('show');
  clearTimeout(state.toastTimer);
  state.toastTimer = setTimeout(() => node.classList.remove('show'), 3600);
}
function setView(view) {
  state.view = view;
  $$('.view').forEach(section => section.classList.toggle('active', section.id === view));
  $$('.nav-btn').forEach(button => button.classList.toggle('active', button.dataset.view === view));
  if (view === 'dashboard') loadDashboard();
  if (view === 'qrs') renderQrs();
  if (view === 'wall') loadWall();
}

/* 3. API SUPABASE E AUTENTICAÇÃO */
function ensureConfigured() {
  if (!API_BASE) throw new Error('A API do sistema não está configurada.');
}
async function refreshSession() {
  if (!state.session?.refresh_token) return null;
  const response = await fetch(`${API_BASE}/auth/v1/token?grant_type=refresh_token`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: state.session.refresh_token }),
  });
  if (!response.ok) { saveSession(null); return null; }
  const session = await response.json(); saveSession(session); return session;
}
async function api(path, { method = 'GET', body, auth = false } = {}) {
  ensureConfigured();
  if (auth && state.session?.expires_at && state.session.expires_at * 1000 < Date.now() + 30000) await refreshSession();
  const headers = { 'Content-Type': 'application/json' };
  if (auth && state.session?.access_token) headers.Authorization = `Bearer ${state.session.access_token}`;
  const response = await fetch(`${API_BASE}${path}`, { method, headers, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const text = await response.text();
  let result = null;
  try { result = text ? JSON.parse(text) : null; } catch { result = text; }
  if (!response.ok) throw new Error(result?.message || result?.msg || `Falha na API (${response.status}).`);
  return result;
}
const rpc = (name, body = {}, auth = false) => api(`/rest/v1/rpc/${name}`, { method: 'POST', body, auth });
async function signIn(email, password) {
  const session = await api('/auth/v1/token?grant_type=password', { method: 'POST', body: { email, password } });
  saveSession(session);
  state.profile = null;
  state.filters = { period: 'all', setor: 'all', shift: 'all' };
}
function signOut() {
  saveSession(null); state.profile = null; state.dashboard = null;
  $('#admin-tools')?.classList.add('hidden');
  if ($('#admin-tools')) $('#admin-tools').innerHTML = '';
  setView('dashboard');
}

/* 4. PESQUISA DO PACIENTE */
function changeSurveySector(slug) {
  if (!slug || slug === state.survey.setor) return;
  const params = new URLSearchParams(location.search);
  params.set('setor', slug);
  history.replaceState(null, '', `${location.pathname}?${params.toString()}${location.hash}`);
  newSurvey(slug);
}
function createSectorPicker(labelText) {
  const label = document.createElement('label');
  label.className = 'field-label sector-choice';
  label.append(labelText);
  const select = document.createElement('select');
  select.id = 'survey-sector';
  select.setAttribute('aria-label', labelText);
  select.required = true;
  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.textContent = 'Selecione o setor do atendimento';
  placeholder.disabled = true;
  placeholder.selected = !state.survey.sectorSelected;
  select.append(placeholder);
  SETORES.forEach(item => {
    const option = document.createElement('option');
    option.value = item.slug;
    option.textContent = item.nome;
    option.selected = item.slug === state.survey.setor && state.survey.sectorSelected;
    select.append(option);
  });
  select.addEventListener('change', () => changeSurveySector(select.value));
  label.append(select);
  return label;
}
function renderSurvey() {
  const root = $('#survey-card'); if (!root) return;
  const survey = state.survey;
  const setor = setorPorSlug(survey.setor);
  const etapas = etapasDisponiveis(survey);
  const etapasSelecionadas = survey.etapasSelecionadas || [];
  const etapaAtual = etapas[etapasSelecionadas[survey.etapaIndex]];
  const stageProgress = etapasSelecionadas.length ? Math.round(30 + ((survey.etapaIndex + 1) / (etapasSelecionadas.length + 1)) * 48) : 30;
  const progress = ({ welcome: 0, rating: 15, 'journey-rating': stageProgress, contactInvite: 82, comment: 89, contact: 96, thanks: 100 })[survey.step] || 0;
  const faces = (action, selected) => `<div class="faces">${NOTAS.map(note => `<button class="face ${selected === note.valor ? 'selected' : ''}" data-action="${action}" data-value="${note.valor}" aria-label="${note.texto}, nota ${note.valor}"><span>${note.emoji}</span><small>${note.texto}</small></button>`).join('')}</div>`;
  let content = `<div class="step-count">${escapeHTML(setor.nome)}${progress ? ` · ${progress}%` : ''}</div>`;
  if (survey.step !== 'welcome' && survey.step !== 'thanks') content += `<div class="progress"><span style="width:${progress}%"></span></div>`;
  if (survey.step === 'welcome') content += `<div class="welcome-mark">♥</div><h1>Como foi seu atendimento?</h1><p class="lead">Uma avaliação geral obrigatória e até ${etapas.length} perguntas opcionais sobre as etapas que você viveu.</p><button class="button primary full" data-action="survey-start">Começar pesquisa <span aria-hidden="true">→</span></button><div class="survey-footer">Você pode responder sem se identificar.</div>`;
  if (survey.step === 'rating') content += `<span class="eyebrow">AVALIAÇÃO GERAL · OBRIGATÓRIA</span><h1>${escapeHTML(survey.pergunta || 'Como foi seu atendimento neste setor?')}</h1><p class="lead">Toque em um rostinho para registrar sua avaliação.</p>${faces('survey-rating', survey.nota)}`;
  if (survey.step === 'journey-rating' && etapaAtual) content += `<span class="eyebrow">PERGUNTA OPCIONAL ${survey.etapaIndex + 1} DE ${etapasSelecionadas.length}</span><h1>${escapeHTML(etapaAtual.pergunta)}</h1><p class="lead">Avalie com um rostinho ou pule esta pergunta.</p>${faces('survey-stage-rating', survey.jornada[etapaAtual.chave])}<button class="optional-skip" data-action="survey-stage-skip">Pular esta pergunta</button>`;
  if (survey.step === 'contactInvite') content += `<div class="welcome-mark warm">♡</div><h1>Sentimos muito. Quer conversar com a Ouvidoria?</h1><p class="lead">Você pode pedir um retorno ou continuar sem deixar seus dados.</p><button class="button primary full" data-action="contact-yes">Quero receber um retorno</button><button class="button secondary full" data-action="contact-no">Continuar sem identificação</button>`;
  if (survey.step === 'comment') content += `<span class="eyebrow">OPCIONAL</span><h1>Quer compartilhar mais alguma coisa?</h1><p class="lead">Escolha elogio, reclamação ou sugestão. Não informe dados de saúde ou documentos pessoais.</p><label class="field-label">Tipo de manifestação<select id="survey-type"><option value="elogio">Elogio</option><option value="reclamacao">Reclamação</option><option value="sugestao">Sugestão</option></select></label><label class="field-label">Comentário<textarea id="survey-comment" maxlength="1000" rows="4" placeholder="Escreva aqui (opcional)"></textarea></label><button class="button primary full" data-action="survey-comment">${survey.desejaRetorno ? 'Continuar' : 'Enviar resposta'}</button><button class="optional-skip" data-action="survey-comment-skip">Pular comentário</button>`;
  if (survey.step === 'contact') content += `<span class="eyebrow">OPCIONAL · OUVIDORIA</span><h1>Como a Ouvidoria pode falar com você?</h1><p class="lead">Seu telefone é opcional e ficará visível somente para a Ouvidoria.</p><label class="field-label">Telefone<input id="survey-phone" type="tel" autocomplete="tel" placeholder="(51) 99999-9999"></label><label class="field-label">Observação<textarea id="survey-note" maxlength="500" rows="2"></textarea></label><label class="check-line"><input id="survey-consent" type="checkbox"> Autorizo o uso do meu telefone para retorno da Ouvidoria.</label><button class="button primary full" data-action="contact-submit">Enviar solicitação</button><button class="optional-skip" data-action="contact-skip">Continuar sem telefone</button>`;
  if (survey.step === 'thanks') content += `<div class="success-icon">✓</div><h1>Obrigado por compartilhar sua experiência.</h1><p class="lead">Sua opinião ajuda a Fundação a melhorar o cuidado.</p>${survey.protocol ? `<div class="survey-highlight">Protocolo de atendimento: <strong>${escapeHTML(survey.protocol)}</strong></div>` : ''}<button class="button secondary full" data-action="survey-new">Concluir</button>`;
  root.innerHTML = content;
  if (survey.step === 'welcome') {
    root.querySelector('[data-action="survey-start"]')?.before(createSectorPicker('Setor da pesquisa'));
    const heading = root.querySelector('h1');
    const lead = root.querySelector('.lead');
    const startButton = root.querySelector('[data-action="survey-start"]');
    if (!survey.sectorSelected) {
      if (heading) heading.textContent = 'Escolha o setor do seu atendimento';
      if (lead) lead.textContent = 'Selecione o setor para começar a pesquisa.';
      if (startButton) { startButton.disabled = true; startButton.textContent = 'Selecione um setor para continuar'; }
    }
  }
}
async function newSurvey(requested = new URLSearchParams(location.search).get('setor')) {
  const setor = setorPorSlug(requested);
  const sectorSelected = SETORES.some(item => item.slug === requested);
  state.survey = { step: 'welcome', setor: setor.slug, sectorSelected, setorId: null, pergunta: `Como foi o atendimento no setor ${setor.nome}?`, respostaId: null, jornada: {}, etapasSelecionadas: [], etapaIndex: 0, nota: null, desejaRetorno: false };
  renderSurvey();
  try {
    const sectors = await api(`/rest/v1/setores?select=id,slug,nome&slug=eq.${encodeURIComponent(setor.slug)}&ativo=eq.true&limit=1`);
    const currentSector = sectors?.[0];
    if (!currentSector) throw new Error('Setor indisponível.');
    state.survey.setorId = currentSector.id;
    const questions = await api(`/rest/v1/perguntas?select=etapa,texto&setor_id=eq.${currentSector.id}&ativa=eq.true&order=ordem.asc&limit=1`);
    if (questions?.[0]?.texto) state.survey.pergunta = questions[0].texto;
  } catch (error) {
    state.survey.loadError = error.message;
  }
  renderSurvey();
}
async function handleSurvey(action, value) {
  const survey = state.survey;
  if (action === 'survey-start') survey.step = 'rating';
  if (action === 'survey-rating') {
    survey.nota = Number(value);
    const source = new URLSearchParams(location.search).get('modo') === 'tablet' ? 'tablet' : 'qr';
    survey.respostaId = await rpc('registrar_resposta', { p_setor: survey.setor, p_nota: survey.nota, p_origem: source, p_dispositivo: deviceId() });
    survey.etapasSelecionadas = etapasDisponiveis(survey).map(etapa => etapa.index);
    survey.etapaIndex = 0;
    survey.step = survey.etapasSelecionadas.length ? 'journey-rating' : (survey.nota <= 2 ? 'contactInvite' : 'comment');
  }
  if (action === 'survey-stage-rating' || action === 'survey-stage-skip') {
    const stageIndex = survey.etapasSelecionadas[survey.etapaIndex];
    const stage = etapasDisponiveis(survey)[stageIndex];
    if (action === 'survey-stage-rating' && stage) {
      survey.jornada[stage.chave] = Number(value);
      await rpc('complementar_resposta', {
        p_id: survey.respostaId, p_jornada: { [stage.chave]: survey.jornada[stage.chave] }, p_tipo: null, p_comentario: null,
      });
    }
    survey.etapaIndex += 1;
    survey.step = survey.etapaIndex < survey.etapasSelecionadas.length
      ? 'journey-rating'
      : (survey.nota <= 2 ? 'contactInvite' : 'comment');
  }
  if (action === 'contact-yes') { survey.desejaRetorno = true; survey.step = 'comment'; }
  if (action === 'contact-no') { survey.desejaRetorno = false; survey.step = 'comment'; }
  if (action === 'survey-comment' || action === 'survey-comment-skip') {
    const comment = action === 'survey-comment' ? $('#survey-comment')?.value.trim() : '';
    if (comment) await rpc('complementar_resposta', {
      p_id: survey.respostaId,
      p_jornada: null,
      p_tipo: comment ? $('#survey-type').value : null,
      p_comentario: comment || null,
    });
    survey.step = survey.desejaRetorno ? 'contact' : 'thanks';
  }
  if (action === 'contact-submit') {
    const phone = $('#survey-phone').value.trim();
    if (phone.replace(/\D/g, '').length < 10) throw new Error('Informe um telefone com DDD para solicitar retorno.');
    if (!$('#survey-consent').checked) throw new Error('Marque o consentimento para enviar seus dados à Ouvidoria.');
    survey.protocol = await rpc('registrar_contato', { p_id: survey.respostaId, p_telefone: phone, p_obs: $('#survey-note').value.trim() || null, p_aceite: true });
    survey.step = 'thanks';
  }
  if (action === 'contact-skip') survey.step = 'thanks';
  if (action === 'survey-new') { await newSurvey(); return; }
  renderSurvey();
}

/* 5. PAINEL DE GESTÃO */
function selectedFilters() {
  return { p_setor: state.filters.setor === 'all' ? null : state.filters.setor, p_turno: state.filters.shift === 'all' ? null : state.filters.shift,
    p_dias: state.filters.period === 'all' ? 3650 : Number(state.filters.period) };
}
function renderKpis(kpis = {}) {
  const items = [['Respostas', kpis.n ?? kpis.total ?? 0], ['Nota média', kpis.media ?? '—'], ['Satisfação', kpis.sat == null ? '—' : `${kpis.sat}%`], ['Manifestações', kpis.manifestacoes ?? '—']];
  return items.map(([label, value]) => `<article class="kpi"><small>${label}</small><strong>${escapeHTML(value)}</strong></article>`).join('');
}
async function loadDashboard() {
  const banner = $('#auth-message');
  if (!state.session) { if (banner) banner.textContent = 'Entre com sua conta institucional para acessar os indicadores.'; $('#login-open')?.classList.remove('hidden'); $('#logout-btn')?.classList.add('hidden'); $('#admin-tools')?.classList.add('hidden'); return; }
  try {
    state.profile = await loadCurrentProfile();
    if (!state.profile) {
      $('#admin-tools')?.classList.add('hidden');
      throw new Error('Esta conta ainda não recebeu um perfil de acesso. Peça ao superadministrador para liberar um setor.');
    }
    if (state.profile.perfil === 'admin_setor') state.filters.setor = state.profile.setor?.slug || 'all';
    await renderAdminTools();
    const summary = await rpc('painel_resumo', selectedFilters(), true);
    state.dashboard = summary;
    const sectorFilter = $('#filter-sector');
    if (sectorFilter && sectorFilter.options.length <= 1) {
      const visibleSectors = state.profile.perfil === 'super_admin'
        ? SETORES
        : state.profile.perfil === 'admin_setor' && state.profile.setor ? [state.profile.setor] : [];
      sectorFilter.insertAdjacentHTML('beforeend', visibleSectors.map(sector => `<option value="${sector.slug}">${escapeHTML(sector.nome)}</option>`).join(''));
    }
    if (sectorFilter && state.profile.perfil === 'admin_setor') sectorFilter.disabled = true;
    if (sectorFilter) sectorFilter.value = state.filters.setor;
    const shiftFilter = $('#filter-shift'); if (shiftFilter) shiftFilter.value = state.filters.shift;
    const periodFilter = $('#filter-period'); if (periodFilter) periodFilter.value = state.filters.period;
    $('#auth-message').textContent = 'Acesso institucional ativo. Dados apresentados conforme seu perfil.';
    $('#login-open')?.classList.add('hidden'); $('#logout-btn')?.classList.remove('hidden');
    $('#kpis').innerHTML = renderKpis(summary.kpis || summary);
    renderTrend(summary.tendencia || summary.serie || []);
    renderSectors(summary.por_setor || []);
    renderRating(summary.distribuicao || summary.notas || []);
    const manifests = await rpc('listar_manifestacoes', { p_setor: state.filters.setor === 'all' ? null : state.filters.setor }, true);
    renderManifestations(Array.isArray(manifests) ? manifests : []);
    $('#updated-at') && ($('#updated-at').textContent = `Atualizado em ${new Date().toLocaleTimeString('pt-BR')}`);
  } catch (error) { if (banner) banner.textContent = `Não foi possível carregar o painel: ${error.message}`; }
}
async function loadCurrentProfile() {
  const userId = state.session?.user?.id;
  if (!userId) throw new Error('Sessão sem usuário. Entre novamente.');
  const rows = await api(`/rest/v1/perfis?select=user_id,nome,perfil,setor_id&user_id=eq.${encodeURIComponent(userId)}&limit=1`, { auth: true });
  const profile = rows?.[0];
  if (!profile) return null;
  if (profile.setor_id) {
    const sectors = await api(`/rest/v1/setores?select=id,slug,nome&id=eq.${profile.setor_id}&limit=1`, { auth: true });
    profile.setor = sectors?.[0] || null;
  }
  return profile;
}
async function renderAdminTools() {
  const root = $('#admin-tools'); if (!root || !state.profile) return;
  const profile = state.profile;
  const isSuper = profile.perfil === 'super_admin';
  const canEditQuestion = isSuper || profile.perfil === 'admin_setor';
  if (!canEditQuestion) { root.classList.add('hidden'); root.innerHTML = ''; return; }
  const sectorOptions = isSuper ? SETORES.map(item => `<option value="${item.slug}">${escapeHTML(item.nome)}</option>`).join('') : '';
  const chosenSector = profile.setor?.slug || SETORES[0].slug;
  root.classList.remove('hidden');
  root.innerHTML = `<article class="panel admin-question-panel"><div class="eyebrow">CONFIGURAÇÃO DO SETOR</div><h2>${isSuper ? 'Pergunta da pesquisa' : 'Pergunta do seu setor'}</h2><p>O formulário do paciente terá uma única pergunta obrigatória, respondida de 1 a 5.</p><form id="question-form"><label class="field-label">Setor${isSuper ? `<select id="question-sector">${sectorOptions}</select>` : `<span>${escapeHTML(profile.setor?.nome || 'Setor não definido')}</span>`}</label><label class="field-label">Texto da pergunta<textarea id="question-text" maxlength="180" minlength="8" required rows="3" placeholder="Como você avalia o atendimento neste setor?"></textarea></label><button class="button primary" type="submit">Salvar pergunta</button><span id="question-status" class="form-status" role="status"></span></form></article>${isSuper ? `<article class="panel access-panel"><div class="eyebrow">ACESSO DA EQUIPE</div><h2>Cadastrar administradores</h2><p>A pessoa deve primeiro criar a conta em <b>Entrar no painel → Cadastre-se</b>. Depois, informe aqui o mesmo e-mail para liberar o perfil e o setor. Cadastro sem liberação não acessa dados de gestão.</p><form id="access-form"><label class="field-label">E-mail da conta<input id="access-email" type="email" required autocomplete="off"></label><label class="field-label">Nome para exibição<input id="access-name" type="text" maxlength="120" required></label><label class="field-label">Perfil<select id="access-role"><option value="admin_setor">Administrador de setor</option><option value="super_admin">Superadministrador</option></select></label><label class="field-label" id="access-sector-label">Setor<select id="access-sector" required>${sectorOptions}</select></label><button class="button primary" type="submit">Conceder acesso</button><span id="access-status" class="form-status" role="status"></span></form></article>` : ''}`;
  const questionSelect = $('#question-sector');
  if (questionSelect) questionSelect.value = chosenSector;
  $('#question-form')?.addEventListener('submit', saveSectorQuestion);
  questionSelect?.addEventListener('change', loadQuestionText);
  $('#access-form')?.addEventListener('submit', grantSectorAccess);
  $('#access-role')?.addEventListener('change', () => {
    const isSectorAdmin = $('#access-role').value === 'admin_setor';
    $('#access-sector-label').classList.toggle('hidden', !isSectorAdmin);
    $('#access-sector').required = isSectorAdmin;
  });
  await loadQuestionText();
}
function questionEditorSlug() {
  return state.profile?.perfil === 'admin_setor' ? state.profile.setor?.slug : $('#question-sector')?.value;
}
async function loadQuestionText() {
  const slug = questionEditorSlug();
  const input = $('#question-text'); if (!slug || !input) return;
  const sector = SETORES.find(item => item.slug === slug);
  const status = $('#question-status');
  try {
    const sectors = await api(`/rest/v1/setores?select=id&slug=eq.${encodeURIComponent(slug)}&limit=1`, { auth: true });
    const sectorId = sectors?.[0]?.id;
    const rows = sectorId ? await api(`/rest/v1/perguntas?select=texto&setor_id=eq.${sectorId}&ativa=eq.true&order=ordem.asc&limit=1`, { auth: true }) : [];
    input.value = rows?.[0]?.texto || '';
    if (status) status.textContent = input.value ? `Pergunta atual: ${sector?.nome || slug}.` : 'Ainda não há pergunta cadastrada para este setor.';
  } catch (error) { if (status) status.textContent = `Não foi possível carregar a pergunta: ${error.message}`; }
}
async function saveSectorQuestion(event) {
  event.preventDefault();
  const status = $('#question-status');
  try {
    await rpc('salvar_pergunta_setor', { p_setor: questionEditorSlug(), p_texto: $('#question-text').value.trim() }, true);
    if (status) status.textContent = 'Pergunta salva. A pesquisa do setor já usará este texto.';
    toast('Pergunta do setor atualizada.');
  } catch (error) { if (status) status.textContent = error.message; }
}
async function grantSectorAccess(event) {
  event.preventDefault();
  const status = $('#access-status');
  const role = $('#access-role').value;
  try {
    await rpc('definir_perfil', {
      p_email: $('#access-email').value.trim(), p_nome: $('#access-name').value.trim(),
      p_perfil: role, p_setor: role === 'admin_setor' ? $('#access-sector').value : null,
    }, true);
    if (status) status.textContent = 'Acesso concedido. A pessoa já pode entrar com a conta existente.';
    $('#access-form').reset();
    const roleSelect = $('#access-role');
    if (roleSelect) roleSelect.dispatchEvent(new Event('change'));
    toast('Acesso concedido.');
  } catch (error) { if (status) status.textContent = error.message; }
}
function renderTrend(rows) {
  const root = $('#trend-chart'); if (!root) return;
  if (!rows.length) { root.innerHTML = '<p class="empty-state">Ainda não há dados para o período.</p>'; return; }
  const values = rows.slice(-7);
  root.innerHTML = values.map(row => `<div class="trend-column" title="${escapeHTML(row.data || row.dia || '')}: ${escapeHTML(row.media || '—')}"><i style="height:${Math.max(4, Number(row.media || 0) / 5 * 100)}%"></i></div>`).join('');
}
function renderSectors(rows) {
  const root = $('#sector-bars'); if (!root) return;
  root.innerHTML = rows.length ? rows.map(row => `<div class="sector-row"><span>${escapeHTML(row.nome || row.setor || 'Setor')}</span><div class="bar-track"><i style="width:${Math.max(0, Math.min(100, Number(row.media || 0) * 20))}%"></i></div><b>${escapeHTML(row.media ?? '—')}</b></div>`).join('') : '<p class="empty-state">Sem respostas no período.</p>';
}
function renderRating(rows) {
  const root = $('#rating-dist'); if (!root) return;
  root.innerHTML = [5, 4, 3, 2, 1].map(note => {
    const row = rows.find(item => Number(item.nota || item.rating) === note); const count = Number(row?.n || row?.total || row?.quantidade || 0);
    return `<div class="rating-row"><span>${note} ${NOTAS[note - 1].emoji}</span><div class="bar-track"><i style="width:${Math.min(100, count)}%"></i></div><b>${count}</b></div>`;
  }).join('');
}
function renderManifestations(rows) {
  const root = $('#manifestations-list'); if (!root) return;
  root.innerHTML = rows.length ? rows.map(item => `<article class="manifestation"><div class="manifestation-meta"><span class="tag">${escapeHTML(item.tipo || 'Manifestação')}</span><span>${escapeHTML(item.setor || '')} · ${formatDate(item.criado_em)}</span></div><p>${escapeHTML(item.comentario || 'Sem comentário')}</p>${item.protocolo ? `<small>Protocolo ${escapeHTML(item.protocolo)}</small>` : ''}</article>`).join('') : '<p class="empty-state">Nenhuma manifestação encontrada.</p>';
}
function openLogin() { $('#login-dialog')?.showModal(); }
async function submitLogin(event) {
  event.preventDefault();
  const error = $('#login-error'); if (error) error.textContent = '';
  try { await signIn($('#login-email').value, $('#login-password').value); $('#login-dialog')?.close(); await loadDashboard(); }
  catch (cause) { if (error) error.textContent = cause.message; }
}
async function submitSignup(event) {
  event.preventDefault();
  const status = $('#signup-status'); if (status) status.textContent = 'Criando conta…';
  try {
    const result = await api('/auth/v1/signup', { method: 'POST', body: {
      email: $('#signup-email').value.trim(), password: $('#signup-password').value,
      data: { name: $('#signup-name').value.trim() },
    } });
    $('#signup-form').reset();
    if (result?.access_token) {
      saveSession(result); state.profile = null; $('#signup-dialog')?.close();
      $('#login-dialog')?.close(); await loadDashboard();
      toast('Conta criada. Aguarde o superadministrador liberar seu perfil.');
    } else if (status) {
      status.textContent = 'Cadastro iniciado. Confirme o e-mail, se solicitado, e aguarde o superadministrador liberar seu perfil e setor.';
    }
  } catch (error) { if (status) status.textContent = error.message; }
}
async function exportResponses() {
  const rows = await rpc('exportar_respostas', { p_setor: state.filters.setor === 'all' ? null : state.filters.setor }, true);
  if (!Array.isArray(rows)) throw new Error('A API não retornou uma lista de respostas.');
  const headers = ['protocolo', 'setor', 'data_hora', 'turno', 'nota', 'tipo', 'comentario', 'jornada'];
  const quote = value => `"${String(value ?? '').replace(/"/g, '""')}"`;
  const csv = [headers.join(';'), ...rows.map(row => headers.map(key => quote(key === 'data_hora' ? row[key] : typeof row[key] === 'object' ? JSON.stringify(row[key]) : row[key])).join(';'))].join('\r\n');
  const link = document.createElement('a'); link.href = URL.createObjectURL(new Blob(['\ufeff', csv], { type: 'text/csv;charset=utf-8' })); link.download = 'respostas-fhdod.csv'; link.click(); URL.revokeObjectURL(link.href);
}

/* 6. QR CODES POR SETOR */
function renderQrs() {
  const root = $('#qr-grid'); if (!root) return;
  const base = `${location.origin}${location.pathname}`;
  root.innerHTML = SETORES.map(sector => {
    const url = `${base}?setor=${encodeURIComponent(sector.slug)}`;
    const image = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(url)}`;
    return `<article class="qr-card"><h2>${escapeHTML(sector.nome)}</h2><img src="${image}" alt="QR Code da pesquisa: ${escapeHTML(sector.nome)}" loading="lazy"><p>${escapeHTML(url)}</p><button class="button secondary" data-action="copy-link" data-value="${escapeHTML(url)}">Copiar link</button></article>`;
  }).join('');
}

/* 7. TV WALL: SOMENTE INDICADORES AGREGADOS */
async function loadWall() {
  try {
    const data = await rpc('tv_resumo');
    $('#wall-kpis').innerHTML = `<article class="wall-kpi"><strong>${escapeHTML(data.media ?? '—')}</strong><span>nota média de 5</span></article><article class="wall-kpi"><strong>${escapeHTML(data.n ?? data.respostas ?? 0)}</strong><span>respostas no período</span></article><article class="wall-kpi"><strong>${escapeHTML(data.sat == null ? '—' : `${data.sat}%`)}</strong><span>satisfação</span></article>`;
    $('#wall-sector').textContent = data.setor_destaque || 'Todos os setores';
  } catch (error) { $('#wall-kpis').innerHTML = `<p class="empty-state">Indicadores indisponíveis: ${escapeHTML(error.message)}</p>`; }
  const clock = $('#wall-clock'); if (clock) clock.textContent = new Date().toLocaleString('pt-BR');
  clearInterval(state.wallTimer); state.wallTimer = setInterval(() => { if (state.view === 'wall') loadWall(); }, 60000);
}

/* 8. EVENTOS E INICIALIZAÇÃO */
document.addEventListener('click', async event => {
  const viewButton = event.target.closest('[data-view]');
  if (viewButton) { setView(viewButton.dataset.view); return; }
  const button = event.target.closest('[data-action]'); if (!button) return;
  const { action, value } = button.dataset;
  try {
    if (action.startsWith('survey-') || action.startsWith('contact-')) {
      if (state.survey.busy) return;
      state.survey.busy = true;
      button.disabled = true;
      try { await handleSurvey(action, value); }
      catch (error) { renderSurvey(); throw error; }
      finally { state.survey.busy = false; }
    }
    else if (action === 'copy-link') { await navigator.clipboard.writeText(value); toast('Link copiado.'); }
  } catch (error) { toast(error.message || 'Não foi possível concluir a ação.', true); }
});
document.addEventListener('change', event => {
  const target = event.target;
  if (target.id === 'filter-period') state.filters.period = target.value;
  if (target.id === 'filter-sector') state.filters.setor = target.value;
  if (target.id === 'filter-shift') state.filters.shift = target.value;
  if (['filter-period', 'filter-sector', 'filter-shift'].includes(target.id)) loadDashboard();
});
$('#login-open')?.addEventListener('click', openLogin);
$('#login-close')?.addEventListener('click', () => $('#login-dialog')?.close());
$('#login-form')?.addEventListener('submit', submitLogin);
$('#signup-open')?.addEventListener('click', () => { $('#login-dialog')?.close(); $('#signup-status').textContent = ''; $('#signup-dialog')?.showModal(); });
$('#signup-close')?.addEventListener('click', () => $('#signup-dialog')?.close());
$('#signup-form')?.addEventListener('submit', submitSignup);
$('#logout-btn')?.addEventListener('click', signOut);
$('#export-btn')?.addEventListener('click', () => exportResponses().catch(error => toast(error.message, true)));
$('#reset-btn')?.addEventListener('click', () => { state.filters = { period: 'all', setor: 'all', shift: 'all' }; loadDashboard(); });
$$('[data-view="manifestations"]').forEach(button => button.remove());
if (new URLSearchParams(location.search).get('modo') === 'tablet') document.body.classList.add('tablet-kiosk');
newSurvey();
setView(location.hash.slice(1) || 'patient');
