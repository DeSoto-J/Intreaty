// sheet.js — the panel that slides up from the bottom for viewing, adding
// and editing entries. There's one panel; opening a new one while it's
// showing just swaps what's inside.
//
// On Android, the phone's Back button closes the panel instead of leaving
// the screen, because opening it adds a step to the browser history.

import { $ } from './dom.js';

let onCloseCallback = null;
let closing = false;

const dialog = () => $('#sheet');
const inner = () => $('#sheet-inner');

export function initSheet() {
  const d = dialog();
  // Escape key
  d.addEventListener('cancel', (e) => { e.preventDefault(); closeSheet(); });
  // Tapping the dimmed area outside the panel
  d.addEventListener('click', (e) => { if (e.target === d) closeSheet(); });
  // Close buttons inside any panel
  inner().addEventListener('click', (e) => { if (e.target.closest('[data-close]')) closeSheet(); });
  // Phone Back button
  addEventListener('popstate', () => { if (d.open) closeSheet({ fromHistory: true }); });
}

export function isSheetOpen() {
  return dialog().open && !closing;
}

export function openSheet(html, { onMount, onClose } = {}) {
  const d = dialog();
  const box = inner();
  box.innerHTML = `<div class="grabber" aria-hidden="true"></div>${html}`;
  onCloseCallback = onClose || null;
  if (!d.open) {
    d.classList.remove('closing');
    d.showModal();
    history.pushState({ sheet: true }, '');
  }
  box.scrollTop = 0;
  // Don't pop the keyboard up on its own; just make sure focus is inside.
  box.querySelector('[data-autofocus]')?.focus({ preventScroll: true });
  if (!box.contains(document.activeElement)) box.setAttribute('tabindex', '-1'), box.focus({ preventScroll: true });
  onMount?.(box);
}

export function closeSheet({ fromHistory = false } = {}) {
  const d = dialog();
  if (!d.open || closing) return;
  closing = true;
  d.classList.add('closing');
  if (!fromHistory && history.state?.sheet) history.back();
  setTimeout(() => {
    d.classList.remove('closing');
    d.close();
    closing = false;
    const cb = onCloseCallback;
    onCloseCallback = null;
    cb?.();
  }, 230);
}

// A simple "Are you sure?" panel. Resolves true if confirmed.
export function confirmSheet({ title, message, confirmLabel = 'Confirm', danger = false }) {
  return new Promise((resolve) => {
    let settled = false;
    const settle = (v) => { if (!settled) { settled = true; resolve(v); } };
    openSheet(`
      <div class="sheet-head"><h2 class="sheet-title" id="sheet-title">${title}</h2></div>
      <p class="note">${message}</p>
      <div class="actions">
        <button type="button" class="btn ${danger ? 'btn-danger-solid' : 'btn-primary'}" data-confirm>${confirmLabel}</button>
        <button type="button" class="btn btn-secondary" data-close>Cancel</button>
      </div>`, {
      onMount: (box) => box.querySelector('[data-confirm]').addEventListener('click', () => settle(true)),
      onClose: () => settle(false),
    });
  });
}
