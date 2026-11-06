export const $ = (selector, root = document) => root.querySelector(selector);
export const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
export const h = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const drawings = {
  heart: '<path d="M20.8 4.6c-2-2-5.3-1.9-7.2.2L12 6.5l-1.6-1.7C8.5 2.7 5.2 2.6 3.2 4.6c-2.1 2.1-2.1 5.4 0 7.5L12 21l8.8-8.9c2.1-2.1 2.1-5.4 0-7.5Z"/>',
  dashboard: '<rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/>',
  message: '<path d="M4 3h16v13H9l-5 4V3Z"/><path d="M8 7h8M8 11h6"/>',
  settings: '<path d="M3 6h18M3 12h18M3 18h18"/><circle cx="8" cy="6" r="2"/><circle cx="16" cy="12" r="2"/><circle cx="10" cy="18" r="2"/>',
  tv: '<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>',
  shield: '<path d="m12 2 8 4v6c0 5-8 10-8 10S4 17 4 12V6l8-4Z"/><path d="m8 12 3 3 5-6"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/>',
  logout: '<path d="M9 3H3v18h6M13 7l5 5-5 5M7 12h15"/>',
  arrow: '<path d="m9 5 7 7-7 7"/>',
  check: '<path d="m4 12 5 5L20 6"/>',
  qr: '<rect x="3" y="3" width="6" height="6"/><rect x="15" y="3" width="6" height="6"/><rect x="3" y="15" width="6" height="6"/><path d="M15 15h3v3h3v3h-6v-3M21 12h-6v3M12 3v9H3M12 15v6"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 22v-4c0-4 16-4 16 0v4"/>',
  download: '<path d="M12 2v13m-5-5 5 5 5-5M3 16v5h18v-5"/>',
  close: '<path d="m5 5 14 14M19 5 5 19"/>',
};
export const icon = (name, cls = '') => `<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${drawings[name] || drawings.heart}</svg>`;
export const brand = (sector = 'Experiência do paciente') => `<a class="brand" href="#pesquisa"><span class="brand-mark">${icon('heart')}</span><span><b>FHDOD</b><small>${h(sector)}</small></span></a>`;
export const roles = { super_admin: 'Super Admin', admin_setor: 'Admin de Setor', gestao: 'Gestão', ouvidoria: 'Ouvidoria', visualizador: 'Visualizador' };
export const types = { elogio: 'Elogio', reclamacao: 'Reclamação', sugestao: 'Sugestão', retorno: 'Pedido de retorno' };
export const statuses = { aberta: 'Aberta', em_atendimento: 'Em atendimento', encerrada: 'Encerrada' };
export const shifts = { manha: 'Manhã', tarde: 'Tarde', noite: 'Noite' };
export const metricName = metric => metric === 'nota_10' ? 'Notas de 1 a 10' : 'Rostinhos de 1 a 5';
export const metricMax = metric => metric === 'nota_10' ? 10 : 5;
export const number = (n, digits = 1) => n === null || n === undefined || !Number.isFinite(Number(n)) ? '—' : Number(n).toLocaleString('pt-BR', { maximumFractionDigits: digits });
export function date(value, time = false) {
  if (!value) return '—';
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value.split('-').reverse().join('/');
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) return '—';
  return parsed.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric', ...(time ? { hour: '2-digit', minute: '2-digit' } : {}) });
}
export function today() { return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()); }
export function daysAgo(n) { const d = new Date(today() + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() - n); return d.toISOString().slice(0, 10); }
export const option = (value, text, selected) => `<option value="${h(value)}" ${String(value) === String(selected) ? 'selected' : ''}>${h(text)}</option>`;
export const sectorOptions = (sectors, selected, blank = 'Todos os setores') => (blank !== null ? option('', blank, selected) : '') + sectors.map(s => option(s.id, s.nome, selected)).join('');
export const notice = (text, error = false) => `<p class="notice ${error ? 'notice-error' : ''}" ${error ? 'role="alert"' : ''}>${h(text)}</p>`;
export const empty = text => `<p class="empty-state">${h(text)}</p>`;
export function feedback(root, message, error = true) {
  const node = $('.form-feedback', root);
  if (node) { node.textContent = message; node.className = 'form-feedback ' + (error ? 'error' : 'success'); node.tabIndex = -1; if (error) node.focus(); }
}
let toastTimer;
export function toast(message) { const el = $('#toast'); clearTimeout(toastTimer); el.textContent = message; el.classList.add('show'); toastTimer = setTimeout(() => el.classList.remove('show'), 5000); }
export function focusHeading(root) { const el = $('h1,h2', root); if (el) { el.tabIndex = -1; el.focus({ preventScroll: true }); } }
export function bindForm(form, handler) {
  form.addEventListener('submit', async event => {
    event.preventDefault(); if (form.dataset.busy === 'true' || !form.reportValidity()) return;
    const button = $('[type=submit]', form); form.dataset.busy = 'true'; if (button) button.disabled = true;
    feedback(form, '', false);
    try { await handler(new FormData(form), form); }
    catch (error) { if (error.name !== 'AbortError' && form.isConnected) feedback(form, error.message || 'Não foi possível concluir.'); }
    finally { form.dataset.busy = 'false'; if (button?.isConnected && button.dataset.locked !== 'true') button.disabled = false; }
  });
}
export function download(blob, filename) { const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = filename; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
export function face(value) {
  const mouth = ['M7 16q5-6 10 0', 'M8 16q4-4 8 0', 'M8 15h8', 'M7 13q5 6 10 0', 'M7 12q5 9 10 0Z'][value - 1];
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M8 8v1M16 8v1${mouth}" stroke-linecap="round"/></svg>`;
}
export function rating(metric, selected, preview = false) {
  const labels = ['Muito ruim', 'Ruim', 'Regular', 'Bom', 'Muito bom'];
  return `<div class="ratings ${metric === 'nota_10' ? 'numeric-ratings' : 'face-ratings'}" role="group" aria-label="Escolha sua avaliação">${Array.from({ length: metricMax(metric) }, (_, i) => {
    const value = i + 1; const label = metric === 'nota_10' ? `Nota ${value}` : `${value} · ${labels[i]}`;
    return `<button type="button" class="rating ${selected === value ? 'selected' : ''}" data-rating="${value}" aria-pressed="${selected === value}" ${preview ? 'disabled tabindex="-1"' : ''}>${metric === 'nota_10' ? `<b>${value}</b>` : `${face(value)}<span>${label}</span><i>${selected === value ? icon('check') : ''}</i>`}<span class="sr-only">${metric === 'nota_10' ? label : ''}</span></button>`;
  }).join('')}</div>${metric === 'nota_10' ? '<div class="scale-captions"><span>1 · Menor nota</span><span>10 · Maior nota</span></div>' : ''}`;
}
export function lineChart(rows, metric) {
  if (!rows.length) return empty('Ainda não há avaliações nesta escala e período.');
  const max = metricMax(metric), width = 620, height = 190;
  const start=Date.parse(rows[0].data),range=Date.parse(rows.at(-1).data)-start;
  const points = rows.map(row => [range ? 32+(Date.parse(row.data)-start)/range*550 : 310, 150 - Math.max(0, Math.min(max, Number(row.media))) / max * 120]);
  return `<div class="chart-scroll"><svg class="line-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="Evolução da média, escala de 1 a ${max}">${[0, 1, 2].map(i => `<path d="M30 ${30 + i * 60}H595" stroke="#dce7e6"/>`).join('')}<polyline points="${points.map(p => p.join(',')).join(' ')}" fill="none" stroke="#155e65" stroke-width="3"/>${points.map(([x, y], i) => `<circle cx="${x}" cy="${y}" r="4" fill="#155e65"><title>${h(date(rows[i].data))}: ${h(number(rows[i].media))}</title></circle>`).join('')}<text x="30" y="178">${h(date(rows[0].data))}</text><text x="595" y="178" text-anchor="end">${h(date(rows.at(-1).data))}</text></svg></div><details class="chart-data"><summary>Ver valores do gráfico</summary><div class="table-scroll"><table><thead><tr><th>Data</th><th>Média / ${max}</th><th>Respostas</th></tr></thead><tbody>${rows.map(r => `<tr><td>${h(date(r.data))}</td><td>${h(number(r.media))}</td><td>${h(r.n)}</td></tr>`).join('')}</tbody></table></div></details>`;
}
export function bar(label, value, max, count, secondary = '') {
  const width = Math.max(0, Math.min(100, Number(value || 0) / max * 100));
  return `<div class="bar-row"><span>${h(label)}${secondary ? `<small>${h(secondary)}</small>` : ''}</span><div class="bar-track"><i style="width:${width}%"></i></div><b>${h(number(value))}<small> / ${max}</small></b>${count !== undefined ? `<small>n=${h(count)}</small>` : ''}</div>`;
}
