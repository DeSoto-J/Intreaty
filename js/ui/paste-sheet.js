// paste-sheet.js — "Add several at once": paste a list (typed, from Notes,
// or copied from a photo with Live Text / Google Lens), check it over, and
// add each line as its own entry.

import { Kind, LIMITS } from '../data/models.js';
import { esc, plural, toast } from './dom.js';
import { icon } from './icons.js';
import { openSheet, closeSheet } from './sheet.js';

const MAX_ITEMS = 200;
const closeBtn = `<button type="button" class="icon-btn close-btn" data-close aria-label="Close">${icon('close')}</button>`;

// Bullets, checkboxes and numbering at the start of a line: "- ", "• ", "☐ ",
// "[ ] ", "1. ", "2) ", "(3) ", "a) ". Run twice for things like "1. - Mom".
const MARKER = /^(?:[-–—•*·●○◦▪▫■□☐☑✓✔►▸>+~]+|\[\s*[xX✓]?\s*\]|\(?\d{1,3}[.)\]]|\(\d{1,3}\)|\(?[a-zA-Z]\))\s*/;

export function cleanLine(line) {
  let s = line.replace(/\s+/g, ' ').trim();
  for (let i = 0; i < 2; i++) s = s.replace(MARKER, '').trim();
  // Nothing left but punctuation or symbols? Skip it.
  return /[\p{L}\p{N}]/u.test(s) ? s : '';
}

// Turns pasted text into a list of { title, details }.
export function parseList(text) {
  return String(text || '')
    .split(/\r?\n/)
    .map(cleanLine)
    .filter(Boolean)
    .slice(0, MAX_ITEMS)
    .map(toItem);
}

// A very long line keeps its first words as the title and the whole line as details.
function toItem(line) {
  if (line.length <= 120) return { title: line, details: '' };
  const cut = line.slice(0, 100);
  const title = `${cut.slice(0, Math.max(cut.lastIndexOf(' '), 60)).trim()}…`;
  return { title, details: line.slice(0, LIMITS.details) };
}

function categoryOptions(repo, selectedId) {
  return repo.listCategories()
    .map((c) => `<option value="${esc(c.id)}"${c.id === selectedId ? ' selected' : ''}>${esc(c.name)}</option>`)
    .join('');
}

export function openPaste(ctx, { kind = Kind.REQUEST, categoryId = 'other', text = '' } = {}) {
  const isThanks = kind === Kind.THANKSGIVING;
  openSheet(`
    <div class="sheet-head"><h2 class="sheet-title" id="sheet-title">Add several at once</h2>${closeBtn}</div>
    <p class="note">Paste or type your list, <strong>one ${isThanks ? 'thanksgiving' : 'request'} per line</strong>. You’ll check it over before anything is added.</p>
    <div class="field">
      <label for="p-text" class="sr-only">Your list</label>
      <textarea class="textarea paste-box" id="p-text" placeholder="${isThanks
        ? 'A safe trip home\nNew job for Sarah\nGood news from the doctor'
        : 'Mom’s surgery on Friday\nJob search for David\nHealing for Pastor Mike'}">${esc(text)}</textarea>
    </div>
    <details class="howto">
      <summary>${icon('sparkle')}How do I copy text from a photo?</summary>
      <div class="howto-body">
        <p><strong>iPhone:</strong> open the photo in Photos, tap the <strong>Live Text</strong> button in the corner (it appears when the photo has words), then <strong>Copy All</strong>.</p>
        <p><strong>Android:</strong> open the photo in Google Photos, tap <strong>Lens</strong>, then <strong>Text</strong>, <strong>Select all</strong> and <strong>Copy</strong>.</p>
        <p>Then come back here, press and hold in the box above, and choose <strong>Paste</strong>. Typed lists and neat handwriting work best, and you can fix any mistakes on the next screen.</p>
      </div>
    </details>
    <p class="form-error" id="p-error" hidden></p>
    <div class="actions">
      <button type="button" class="btn btn-primary" id="p-next">${icon('arrow')}Review list</button>
    </div>`, {
    onMount: (box) => {
      const ta = box.querySelector('#p-text');
      const err = box.querySelector('#p-error');
      box.querySelector('#p-next').addEventListener('click', () => {
        const items = parseList(ta.value);
        if (!items.length) {
          err.textContent = 'Paste or type at least one line first.';
          err.hidden = false;
          ta.focus();
          return;
        }
        openReview(ctx, { kind, categoryId, text: ta.value, items });
      });
    },
  });
}

function openReview(ctx, { kind, categoryId, text, items }) {
  const { repo, state } = ctx;
  const isThanks = kind === Kind.THANKSGIVING;
  const noun = isThanks ? 'thanksgiving' : 'request';
  const cats = (sel) => categoryOptions(repo, sel);

  openSheet(`
    <div class="sheet-head"><h2 class="sheet-title" id="sheet-title">Check your list</h2>${closeBtn}</div>
    <p class="note">Fix anything that doesn’t look right, and untick lines you don’t want, like a heading.</p>
    <div class="field">
      <label for="p-cat">Category for all</label>
      <select class="select" id="p-cat">${cats(categoryId)}</select>
    </div>
    <ul class="paste-list">
      ${items.map((it, i) => `
        <li class="paste-row" data-i="${i}">
          <label class="paste-check"><input type="checkbox" checked aria-label="Include line ${i + 1}"><span>${icon('check')}</span></label>
          <div class="paste-fields">
            <input class="input paste-title" maxlength="${LIMITS.title}" value="${esc(it.title)}" aria-label="Line ${i + 1}" autocomplete="off">
            <select class="paste-cat" aria-label="Category for line ${i + 1}">${cats(categoryId)}</select>
          </div>
        </li>`).join('')}
    </ul>
    <p class="form-error" id="p-error" hidden></p>
    <div class="actions">
      <button type="button" class="btn btn-primary" id="p-add"></button>
      <button type="button" class="link-btn paste-back" id="p-back">Back to the pasted text</button>
    </div>`, {
    onMount: (box) => {
      const rows = [...box.querySelectorAll('.paste-row')];
      const batch = box.querySelector('#p-cat');
      const addBtn = box.querySelector('#p-add');
      const err = box.querySelector('#p-error');

      const chosen = () => rows.filter((r) =>
        r.querySelector('input[type=checkbox]').checked && r.querySelector('.paste-title').value.trim());
      const refresh = () => {
        const n = chosen().length;
        addBtn.disabled = n === 0;
        addBtn.innerHTML = `${icon('check')}${n ? `Add ${plural(n, noun)}` : `Nothing to add`}`;
        rows.forEach((r) => r.classList.toggle('is-off', !r.querySelector('input[type=checkbox]').checked));
      };
      refresh();
      box.addEventListener('input', refresh);
      box.addEventListener('change', refresh);

      // The category for all changes every line you haven't set by hand.
      batch.addEventListener('change', () => rows.forEach((r) => {
        const sel = r.querySelector('.paste-cat');
        if (!sel.dataset.touched) sel.value = batch.value;
      }));
      rows.forEach((r) => r.querySelector('.paste-cat').addEventListener('change', (ev) => {
        ev.target.dataset.touched = '1';
      }));

      box.querySelector('#p-back').addEventListener('click', () =>
        openPaste(ctx, { kind, categoryId: batch.value, text }));

      addBtn.addEventListener('click', async () => {
        const list = chosen().map((r) => ({
          kind,
          title: r.querySelector('.paste-title').value,
          details: items[Number(r.dataset.i)].details,
          categoryId: r.querySelector('.paste-cat').value,
        }));
        try {
          const added = await repo.addEntries(list);
          closeSheet();
          toast(`Added ${plural(added.length, noun)}`, {
            actionLabel: 'Undo',
            onAction: () => repo.deleteEntries(added.map((e) => e.id)),
            duration: 8000,
          });
          const target = isThanks ? '#/thanks' : '#/requests';
          state.filters[isThanks ? 'thanks' : 'requests-active'] = 'all';
          setTimeout(() => { if (location.hash !== target) location.hash = target; }, 280);
        } catch (e) {
          err.textContent = e.message || 'Something went wrong.';
          err.hidden = false;
        }
      });
    },
  });
}
