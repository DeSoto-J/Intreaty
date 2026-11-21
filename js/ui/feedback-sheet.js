// feedback-sheet.js — "Send feedback": report a problem or suggest an idea.
//
// The message goes to Web3Forms, a free service that emails it to the
// Intreaty feedback inbox. Nothing is sent until the person taps Send, and
// only what they type (plus the app version and phone type) is sent — never
// their prayers. No sign-in or email address is needed.
//
// The access key below is meant to be public: it can only send messages to
// the inbox, not read anything.

import { APP_VERSION } from '../version.js';
import * as pwa from '../pwa.js';
import { esc, toast } from './dom.js';
import { icon } from './icons.js';
import { openSheet, closeSheet } from './sheet.js';

const ENDPOINT = 'https://api.web3forms.com/submit';
const ACCESS_KEY = '4e5c4d8d-cc77-424f-9857-c330dd6d646d';
const MAX_MESSAGE = 3000;

const TYPES = [['problem', 'A problem'], ['idea', 'An idea']];

const closeBtn = `<button type="button" class="icon-btn close-btn" data-close aria-label="Close">${icon('close')}</button>`;

// A short, plain description like "iPhone · home screen app". Deliberately
// not the browser's full identity string.
export function deviceSummary() {
  const ua = navigator.userAgent;
  const device = /iPad/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1) ? 'iPad'
    : /iPhone|iPod/.test(ua) ? 'iPhone'
    : /Android/.test(ua) ? 'Android'
    : /Windows/.test(ua) ? 'Windows'
    : /Macintosh/.test(ua) ? 'Mac'
    : 'Other device';
  return `${device} · ${pwa.isStandalone() ? 'home screen app' : 'browser'}`;
}

// Keeps whatever was typed if the panel is closed before sending.
let draft = { type: 'problem', message: '', email: '' };

export function openFeedback() {
  const device = deviceSummary();
  const idx = Math.max(0, TYPES.findIndex(([v]) => v === draft.type));

  openSheet(`
    <div class="sheet-head"><h2 class="sheet-title" id="sheet-title">Send feedback</h2>${closeBtn}</div>
    <form id="fb-form" novalidate>
      <div class="field">
        <span class="label" id="fb-type-label">This is about</span>
        <div class="segmented" role="radiogroup" aria-labelledby="fb-type-label" style="--count:2;--index:${idx}">
          ${TYPES.map(([v, label]) => `<button type="button" role="radio" data-fb-type="${v}" aria-selected="${v === draft.type}" aria-checked="${v === draft.type}">${label}</button>`).join('')}
        </div>
      </div>
      <div class="field">
        <label for="fb-message" id="fb-message-label"></label>
        <textarea class="textarea" id="fb-message" maxlength="${MAX_MESSAGE}" data-autofocus>${esc(draft.message)}</textarea>
      </div>
      <div class="field">
        <label for="fb-email">Your email <span class="optional">(optional, only if you’d like a reply)</span></label>
        <input class="input" id="fb-email" type="email" inputmode="email" autocomplete="email" maxlength="200" value="${esc(draft.email)}">
      </div>
      <!-- Spam trap: people never see or fill this in. -->
      <input type="checkbox" name="botcheck" class="fb-trap" tabindex="-1" autocomplete="off" aria-hidden="true">
      <p class="note fb-privacy">Only what you type here is sent, along with <strong>Intreaty ${esc(APP_VERSION)}</strong> and <strong>${esc(device)}</strong> to help fix problems. Your prayers are never included.</p>
      <p class="form-error" id="fb-error" role="alert" hidden></p>
      <div class="actions">
        <button type="submit" class="btn btn-primary" id="fb-send">${icon('send')}Send feedback</button>
      </div>
    </form>`, {
    onMount: (box) => {
      const form = box.querySelector('#fb-form');
      const seg = box.querySelector('.segmented');
      const msg = box.querySelector('#fb-message');
      const msgLabel = box.querySelector('#fb-message-label');
      const email = box.querySelector('#fb-email');
      const err = box.querySelector('#fb-error');
      const send = box.querySelector('#fb-send');

      const showError = (text) => { err.textContent = text; err.hidden = false; };

      const setType = (type) => {
        draft.type = type;
        seg.style.setProperty('--index', TYPES.findIndex(([v]) => v === type));
        seg.querySelectorAll('[data-fb-type]').forEach((b) => {
          const on = b.dataset.fbType === type;
          b.setAttribute('aria-selected', on);
          b.setAttribute('aria-checked', on);
        });
        msgLabel.textContent = type === 'idea' ? 'Your idea' : 'What went wrong?';
        msg.placeholder = type === 'idea'
          ? 'What would make Intreaty more helpful to you?'
          : 'What happened, and what were you doing when it happened?';
      };
      setType(draft.type);

      seg.addEventListener('click', (ev) => {
        const b = ev.target.closest('[data-fb-type]');
        if (b) setType(b.dataset.fbType);
      });
      msg.addEventListener('input', () => { draft.message = msg.value; err.hidden = true; });
      email.addEventListener('input', () => { draft.email = email.value; err.hidden = true; });

      form.addEventListener('submit', async (ev) => {
        ev.preventDefault();
        err.hidden = true;
        const message = msg.value.trim();
        const reply = email.value.trim();
        if (!message) { showError('Please write a few words first.'); msg.focus(); return; }
        if (reply && !email.checkValidity()) { showError('That email address doesn’t look right. You can also leave it empty.'); email.focus(); return; }
        if (!navigator.onLine) { showError('You’re offline. Your message is still here. Try again when you’re connected.'); return; }

        // A filled-in spam trap means a bot: pretend it worked and send nothing.
        if (form.querySelector('.fb-trap').checked) { closeSheet(); toast('Thank you! Your feedback was sent.'); return; }

        const kind = draft.type === 'idea' ? 'Idea' : 'Problem';
        const body = {
          access_key: ACCESS_KEY,
          subject: `Intreaty feedback: ${kind}`,
          from_name: 'Intreaty app',
          type: kind,
          message,
          app_version: APP_VERSION,
          device,
        };
        if (reply) body.email = reply;

        send.disabled = true;
        send.textContent = 'Sending…';
        try {
          const res = await fetch(ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify(body),
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok || data.success === false) throw new Error(data.message || `HTTP ${res.status}`);
          draft = { type: 'problem', message: '', email: '' };
          closeSheet();
          toast('Thank you! Your feedback was sent.');
        } catch {
          showError('It couldn’t be sent just now. Your message is still here, so please try again in a little while.');
          send.disabled = false;
          send.innerHTML = `${icon('send')}Send feedback`;
        }
      });
    },
  });
}
