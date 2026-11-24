import { $, publicHeader, focusHeading } from './ui.js';

export async function mountAbout(root) {
  document.body.classList.remove('tablet-kiosk');
  root.innerHTML = `${publicHeader({ current: 'sobre' })}<main class="patient-main" id="main-content" tabindex="-1"><article class="patient-card about-card"><p class="eyebrow">Sobre nós</p><h1>Fundação Hospitalar Dr. Oswaldo Diesel</h1><p class="about-location">Três Coroas, Rio Grande do Sul</p><h2>Escutar também é cuidar</h2><p>Esta pesquisa de satisfação foi criada para ouvir a experiência de pacientes e apoiar melhorias no atendimento. A participação é voluntária e as respostas são apresentadas de forma agregada.</p><p>O projeto oferece uma forma simples de avaliar o atendimento e, se desejar, compartilhar um comentário com a Ouvidoria. Não informe dados de saúde ou informações que identifiquem outras pessoas em campos de comentário.</p><div class="about-actions"><a class="button" href="#pesquisa">Responder à pesquisa</a><a class="button secondary" href="#contato">Fale conosco</a></div></article></main>`;
  focusHeading(root);
}
