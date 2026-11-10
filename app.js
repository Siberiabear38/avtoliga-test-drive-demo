(() => {
  'use strict';
  const form = document.getElementById('test-drive-form');
  const button = document.getElementById('submit-button');
  const buttonLabel = button.querySelector('span');
  const status = document.getElementById('form-status');
  const fields = ['phone', 'consent'];
  let sending = false;
  let finished = false;
  let requestId = null;

  function message(text, state = 'error') {
    status.textContent = text;
    status.dataset.state = state;
    status.hidden = !text;
  }
  function fieldError(id, text) {
    const input = document.getElementById(id);
    const error = document.getElementById(`${id}-error`);
    input.setAttribute('aria-invalid', String(Boolean(text)));
    error.textContent = text;
    error.hidden = !text;
  }
  function phoneNumber(value) {
    let digits = value.replace(/\D/g, '');
    if (digits.length === 10) digits = `7${digits}`;
    if (digits[0] === '8') digits = `7${digits.slice(1)}`;
    return /^7\d{10}$/.test(digits) ? digits : null;
  }
  fields.forEach(id => {
    const input = document.getElementById(id);
    input.addEventListener(id === 'consent' ? 'change' : 'input', () => {
      fieldError(id, '');
      if (!finished) message('');
      if (!sending) requestId = null;
    });
  });
  window.AvtoligaPhone.attach(document.getElementById('phone'));

  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (sending || finished) return;
    fields.forEach(id => fieldError(id, ''));
    const phone = phoneNumber(form.elements.phone.value);
    const errors = {};
    if (!phone) errors.phone = 'Введите российский номер телефона полностью.';
    if (!form.elements.consent.checked) errors.consent = 'Для отправки данных необходимо ваше согласие.';
    if (Object.keys(errors).length) {
      Object.entries(errors).forEach(([id, text]) => fieldError(id, text));
      document.getElementById(Object.keys(errors)[0]).focus();
      return;
    }
    if (form.dataset.demo === 'true') {
      message('Это демонстрация формы. Данные не отправлены; обратитесь к менеджеру автосалона.', 'pending');
      return;
    }
    sending = true;
    button.disabled = true;
    button.setAttribute('aria-busy', 'true');
    buttonLabel.textContent = 'Отправляем…';
    message('', 'pending');
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 25000);
    try {
      const sessionResponse = await fetch('api.php', { credentials: 'same-origin', cache: 'no-store', signal: controller.signal, headers: { Accept: 'application/json' } });
      const session = await sessionResponse.json();
      if (!sessionResponse.ok || !session.csrf) throw new Error('session');
      if (!requestId) requestId = crypto.randomUUID ? crypto.randomUUID() : Array.from(crypto.getRandomValues(new Uint8Array(16)), n => n.toString(16).padStart(2, '0')).join('');
      const payload = new URLSearchParams({ phone, consent: '1', website: form.elements.website.value, csrf: session.csrf, request_id: requestId });
      const response = await fetch('api.php', { method: 'POST', credentials: 'same-origin', headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' }, body: payload, signal: controller.signal });
      const result = await response.json();
      if (!response.ok || result.ok !== true) {
        if (result.errors) Object.entries(result.errors).forEach(([id, text]) => { if (fields.includes(id)) fieldError(id, text); });
        message(result.message || 'Не удалось отправить заявку. Попробуйте ещё раз или обратитесь к менеджеру.');
        return;
      }
      finished = true;
      buttonLabel.textContent = 'Данные отправлены';
      message('Спасибо! Ваши данные переданы в автосалон.', 'success');
      form.querySelectorAll('input').forEach(input => input.disabled = true);
    } catch (_) {
      message('Не удалось подтвердить отправку. Проверьте соединение и попробуйте ещё раз или обратитесь к менеджеру.');
    } finally {
      window.clearTimeout(timeout);
      sending = false;
      button.removeAttribute('aria-busy');
      button.disabled = finished;
      if (!finished) buttonLabel.textContent = 'Отправить данные';
    }
  });
})();
