(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.AvtoligaPhone = api;
})(typeof globalThis === 'object' ? globalThis : this, function () {
  'use strict';

  function nationalDigits(value) {
    const text = String(value).trim();
    let digits = text.replace(/\D/g, '');
    if (/^\+7/.test(text) || (digits.length >= 11 && /^[78]/.test(digits))) digits = digits.slice(1);
    return digits.slice(0, 10);
  }

  function format(digits) {
    digits = String(digits).replace(/\D/g, '').slice(0, 10);
    if (!digits) return '+7';
    let text = '+7 (' + digits.slice(0, 3);
    if (digits.length >= 3) text += ') ';
    if (digits.length > 3) text += digits.slice(3, 6);
    if (digits.length >= 6) text += '-';
    if (digits.length > 6) text += digits.slice(6, 8);
    if (digits.length >= 8) text += '-';
    if (digits.length > 8) text += digits.slice(8, 10);
    return text;
  }

  function digitIndex(value, position) {
    const country = /^\+7/.test(value) ? 1 : 0;
    return Math.max(0, value.slice(0, position).replace(/\D/g, '').length - country);
  }

  function caretPosition(value, index) {
    const digits = nationalDigits(value);
    if (index >= digits.length) return value.length;
    if (index <= 0) return digits.length ? 4 : 2;
    let found = 0;
    for (let i = 2; i < value.length; i++) {
      if (/\d/.test(value[i]) && ++found === index) return i + 1;
    }
    return value.length;
  }

  function edit(value, start, end, type, data = '') {
    const digits = nationalDigits(value);
    let from = Math.min(digits.length, digitIndex(value, start));
    let to = Math.min(digits.length, digitIndex(value, end));
    let next;
    let caret;
    if (type.startsWith('delete')) {
      if (start === end && start <= 2) return { value: format(digits), caret: digits.length ? 4 : 2 };
      if (from === to && type.includes('Backward')) from = type.includes('Word') ? 0 : Math.max(0, from - 1);
      if (from === to && type.includes('Forward')) to = type.includes('Word') ? digits.length : Math.min(digits.length, to + 1);
      next = digits.slice(0, from) + digits.slice(to);
      caret = from;
    } else {
      let inserted = String(data).replace(/\D/g, '');
      // Complete pasted/autofilled numbers may contain +7 or the domestic 8 prefix.
      if (/^\s*\+7/.test(data) || (inserted.length >= 11 && /^[78]/.test(inserted))) inserted = inserted.slice(1);
      const room = 10 - (digits.length - (to - from));
      inserted = inserted.slice(0, Math.max(0, room));
      next = digits.slice(0, from) + inserted + digits.slice(to);
      caret = from + inserted.length;
    }
    const text = format(next);
    return { value: text, caret: caretPosition(text, caret) };
  }

  function attach(input) {
    function apply(result) {
      input.value = result.value;
      input.setSelectionRange(result.caret, result.caret);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
    input.addEventListener('focus', () => {
      if (!input.value) {
        input.value = '+7';
        input.setSelectionRange(2, 2);
      }
    });
    input.addEventListener('beforeinput', event => {
      if (!event.cancelable || event.isComposing) return;
      if (event.inputType.startsWith('delete') || (event.inputType.startsWith('insert') && event.data !== null)) {
        event.preventDefault();
        apply(edit(input.value, input.selectionStart ?? input.value.length, input.selectionEnd ?? input.value.length, event.inputType, event.data ?? ''));
      }
    });
    input.addEventListener('paste', event => {
      if (!event.clipboardData) return;
      event.preventDefault();
      apply(edit(input.value, input.selectionStart ?? input.value.length, input.selectionEnd ?? input.value.length, 'insertFromPaste', event.clipboardData.getData('text')));
    });
    // Autofill and browser input methods can bypass beforeinput.
    input.addEventListener('input', () => {
      const before = input.value;
      const position = input.selectionStart ?? before.length;
      const digits = nationalDigits(before);
      const pretty = format(digits);
      if (before !== pretty) {
        const index = digitIndex(before, position);
        input.value = pretty;
        const caret = caretPosition(pretty, index);
        input.setSelectionRange(caret, caret);
      }
    });
    input.addEventListener('blur', () => {
      if (input.value) input.value = format(nationalDigits(input.value));
    });
  }

  return { nationalDigits, format, edit, attach };
});
