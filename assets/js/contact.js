import { request } from './api.js';
import { $, publicHeader, bindForm, feedback, focusHeading } from './ui.js';

export async function mountContact(root, ctx) {
  document.body.classList.remove('tablet-kiosk');
  root.innerHTML = `${publicHeader({ current: 'contato' })}<main class="patient-main" id="main-content" tabindex="-1"><section class="patient-card" style="max-width:760px"><p class="eyebrow">Fale conosco</p><h1>Entre em contato</h1><p>Envie sua mensagem à Fundação Hospitalar Dr. Oswaldo Diesel. Não inclua dados de saúde ou informações de pacientes.</p><form id="contact-form" class="stack"><label class="field">Nome<input name="nome" autocomplete="name" maxlength="120" required></label><label class="field">E-mail<input name="email" type="email" autocomplete="email" maxlength="254" required></label><label class="field">Assunto<input name="assunto" maxlength="120" required></label><label class="field">Mensagem<textarea name="mensagem" minlength="10" maxlength="3000" rows="6" required></textarea></label><div class="contact-trap" aria-hidden="true"><label>Website<input name="website" tabindex="-1" autocomplete="off"></label></div><p class="footnote">Os dados serão usados somente para responder à sua mensagem.</p><button class="button" type="submit">Enviar mensagem</button><p class="form-feedback" role="status"></p></form></section></main>`;
  const form = $('#contact-form', root);
  bindForm(form, async (values) => {
    const result = await request('/contato', {
      method: 'POST',
      body: Object.fromEntries(values),
      signal: ctx.signal,
    });
    if (!ctx.alive()) return;
    form.reset();
    feedback(form, result.message || 'Mensagem enviada. Obrigado por entrar em contato.', false);
  });
  focusHeading(root);
}
