import { request } from './api.js';
import { $, brand, date, empty, face, h, icon, metricMax, metricName, notice, number } from './ui.js';

export async function mountWall(root, ctx) {
  let snapshot = null,
    metric = 'rostos_5',
    timer,
    seq = 0;
  root.innerHTML = `<main class="wall" id="main-content" tabindex="-1"><header class="wall-header"><div id="wall-brand"></div><div class="wall-meta"><p class="eyebrow">A voz de quem recebe cuidado</p><span id="wall-updated">Buscando indicadores…</span><button class="menu-toggle" type="button" data-public-menu aria-label="Abrir menu" aria-expanded="false" aria-controls="wall-navigation">${icon('menu')}</button><nav class="public-nav" id="wall-navigation" aria-label="Navegacao principal"><a class="text-button" href="#pesquisa">Voltar à pesquisa</a><a class="text-button" href="#contato">Contato</a><a class="text-button" href="#sobre">Sobre nós</a></nav></div></header><div id="wall-results"><p class="loading">Carregando indicadores públicos…</p></div><footer class="wall-thanks"><h2>Sua voz faz parte do nosso cuidado.</h2><p>Obrigado por compartilhar sua experiência com a FHDOD.</p><small class="muted">Painel público · Somente resultados agregados · Sem identificação individual</small></footer></main>`;
  $('#wall-brand', root).innerHTML = brand('Pesquisa de satisfação');
  function render() {
    const row = snapshot.metricas?.find((r) => r.metrica === metric);
    const area = $('#wall-results', root);
    if (!row) {
      area.innerHTML = `<section class="panel">${empty('Ainda não há um grupo de respostas publicado nesta escala. Novos resultados aparecem após a atualização dos indicadores agregados.')}</section>`;
      $('#wall-updated', root).textContent = 'Aguardando publicação de indicadores';
      return;
    }
    $('#wall-updated', root).textContent = 'Publicado em ' + date(row.publicado_em, true);
    area.innerHTML = `<div class="wall-grid"><section class="wall-hero"><h1>Experiência dos pacientes</h1><div class="row spread"><div class="wall-value">${h(number(metric === 'rostos_5' ? Number(row.media) * 2 : row.media))}<small> / 10</small></div><div class="wall-face">${face(Math.max(1, Math.min(5, Math.round((Number(row.media) / metricMax(metric)) * 5))))}</div></div><p>${h(metric === 'rostos_5' ? 'Carinhas · nota multiplicada por 2' : metricName(metric))} · Todo o hospital</p><div class="wall-count"><strong>${h(number(row.n, 0))}</strong><span><b>respostas no período</b><br>Cada participação ajuda a melhorar.</span></div></section><section class="panel wall-facts"><h2>O cuidado em números</h2><div class="fact"><strong>${row.satisfacao == null ? '—' : h(number(row.satisfacao)) + '%'}</strong><p>Satisfação · notas ${metric === 'rostos_5' ? '8 e 10' : '8 a 10'}</p></div><div class="fact"><strong style="font-size:22px">${h(date(row.inicio))} a ${h(date(row.fim))}</strong><p>Período das avaliações publicadas</p></div><p class="footnote">As escalas são apresentadas separadamente. Os resultados são publicados em grupos para proteger cada resposta.</p></section></div>`;
  }
  async function load() {
    const version = ++seq;
    try {
      const data = await request('/tv', { signal: ctx.signal });
      if (!ctx.alive() || version !== seq) return;
      snapshot = data;
      if (!data.metricas?.some((r) => r.metrica === metric) && data.metricas?.length) {
        metric = data.metricas[0].metrica;
      }
      render();
    } catch (error) {
      if (ctx.alive() && error.name !== 'AbortError') {
        $('#wall-results', root).innerHTML = notice(error.message, true);
        $('#wall-updated', root).textContent = 'Indicadores temporariamente indisponíveis';
      }
    }
  }
  await load();
  if (ctx.alive()) timer = setInterval(load, 60000);
  ctx.cleanup(() => clearInterval(timer));
}
