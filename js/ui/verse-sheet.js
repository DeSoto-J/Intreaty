// verse-sheet.js — "Verse of the day": the verse card, hearting favorites,
// and the "My verses" list.

import { todayLocal } from '../data/models.js';
import { VERSES, getVerse, verseForDay, verseAsText } from '../data/verses.js';
import { $, esc, plural, toast } from './dom.js';
import { icon } from './icons.js';
import { openSheet } from './sheet.js';

const closeBtn = `<button type="button" class="icon-btn close-btn" data-close aria-label="Close">${icon('close')}</button>`;
const SEEN_KEY = 'intreaty.verseSeenOn';

// Today's verse is decided once and remembered, so hearting or un-hearting
// a verse never swaps the verse you're looking at.
async function todaysVerse(repo) {
  const today = todayLocal();
  const saved = await repo.getMeta('verseOfDay');
  if (saved?.date === today && getVerse(saved.verseId)) return getVerse(saved.verseId);
  const v = verseForDay(today, repo.favoriteVerseIds());
  await repo.setMeta('verseOfDay', { date: today, verseId: v.id });
  return v;
}

// The little dot on the Verse button until you've opened today's verse.
export function updateVerseDot() {
  let seen = null;
  try { seen = localStorage.getItem(SEEN_KEY); } catch { /* ignore */ }
  $('#verse-btn')?.classList.toggle('has-new', seen !== todayLocal());
}

function markSeen() {
  try { localStorage.setItem(SEEN_KEY, todayLocal()); } catch { /* ignore */ }
  updateVerseDot();
}

// "Another verse" goes through the whole list in a shuffled order before repeating.
let deck = [];
function nextRandom(excludeId) {
  if (!deck.length) {
    deck = VERSES.map((v) => v.id).filter((id) => id !== excludeId);
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
  }
  const id = deck.pop();
  return id === excludeId && deck.length ? getVerse(deck.pop()) : getVerse(id);
}

// Copies text, with an older fallback for browsers that block the clipboard API.
async function copyText(text, container) {
  try {
    await navigator.clipboard.writeText(text);
    return;
  } catch { /* try the fallback */ }
  const ta = Object.assign(document.createElement('textarea'), { value: text, readOnly: true });
  ta.style.cssText = 'position:fixed;opacity:0;pointer-events:none';
  container.append(ta); // inside the open panel, so the selection is allowed
  ta.select();
  const ok = document.execCommand('copy');
  ta.remove();
  if (!ok) throw new Error('copy failed');
}

export async function openVerseOfDay(ctx) {
  const v = await todaysVerse(ctx.repo);
  markSeen();
  showVerse(ctx, v, 'today');
}

// mode: 'today' | 'another' | 'mine'
function showVerse(ctx, v, mode) {
  const { repo } = ctx;
  const fav = repo.isFavoriteVerse(v.id);
  const favCount = repo.favoriteVerseIds().length;
  const label = mode === 'today' ? 'Verse of the day' : mode === 'mine' ? 'From My verses' : 'Another verse';
  const canShare = typeof navigator.share === 'function';

  openSheet(`
    <div class="sheet-head">
      <h2 class="eyebrow verse-eyebrow" id="sheet-title">${icon('book')}${label}</h2>
      ${closeBtn}
    </div>
    <figure class="verse${mode === 'today' ? '' : ' verse-swap'}">
      <blockquote class="verse-text">${esc(v.text)}</blockquote>
      <figcaption class="verse-ref">${esc(v.ref)}<span>KJV</span></figcaption>
    </figure>
    <div class="verse-tools">
      <button type="button" class="verse-tool heart-btn" data-v="heart" aria-pressed="${fav}">
        ${icon('heart')}<span>${fav ? 'Saved' : 'Save'}</span></button>
      <button type="button" class="verse-tool" data-v="copy">${icon('copy')}<span>Copy</span></button>
      ${canShare ? `<button type="button" class="verse-tool" data-v="share">${icon('share')}<span>Share</span></button>` : ''}
    </div>
    <div class="actions">
      <button type="button" class="btn btn-primary" data-v="another">${icon('sparkle')}Another verse</button>
      <button type="button" class="btn btn-ghost" data-v="mine">${icon('heart')}My verses${favCount ? ` <span class="count-pill">${favCount}</span>` : ''}</button>
      ${mode === 'today' ? '' : `<button type="button" class="link-btn verse-back" data-v="today">Back to today’s verse${icon('arrow')}</button>`}
    </div>`, {
    onMount: (box) => box.querySelectorAll('[data-v]').forEach((b) => b.addEventListener('click', async () => {
      const act = b.dataset.v;
      try {
        if (act === 'heart') {
          const on = await repo.toggleFavoriteVerse(v.id);
          b.setAttribute('aria-pressed', String(on));
          b.querySelector('span').textContent = on ? 'Saved' : 'Save';
          const n = repo.favoriteVerseIds().length;
          box.querySelector('[data-v="mine"]').innerHTML = `${icon('heart')}My verses${n ? ` <span class="count-pill">${n}</span>` : ''}`;
          toast(on ? 'Saved to My verses' : 'Removed from My verses');
        } else if (act === 'copy') {
          await copyText(verseAsText(v), box);
          toast('Verse copied');
        } else if (act === 'share') {
          try { await navigator.share({ text: verseAsText(v) }); } catch (err) { if (err.name !== 'AbortError') throw err; }
        } else if (act === 'another') {
          showVerse(ctx, nextRandom(v.id), 'another');
        } else if (act === 'mine') {
          openMyVerses(ctx);
        } else if (act === 'today') {
          showVerse(ctx, await todaysVerse(repo), 'today');
        }
      } catch {
        toast(act === 'copy' ? 'Could not copy. Try Share instead.' : 'Something went wrong.');
      }
    })),
  });
}

function openMyVerses(ctx) {
  const { repo } = ctx;
  const favIds = repo.favoriteVerseIds();
  const favs = VERSES.filter((v) => favIds.includes(v.id));
  openSheet(`
    <div class="sheet-head">
      <h2 class="sheet-title" id="sheet-title">My verses</h2>
      ${closeBtn}
    </div>
    ${favs.length ? `
      <p class="note">${plural(favs.length, 'saved verse')}. Saved verses come back as the verse of the day more often.</p>
      <ul class="verse-list">
        ${favs.map((v) => `
          <li><button type="button" class="verse-row" data-verse="${esc(v.id)}">
            <span class="verse-row-ref">${esc(v.ref)}</span>
            <span class="verse-row-text">${esc(v.text)}</span>
          </button></li>`).join('')}
      </ul>` : `
      <div class="empty verse-empty">
        <div class="empty-icon">${icon('heart')}</div>
        <h2>No saved verses yet</h2>
        <p>Tap Save on any verse to keep it here. Saved verses come back as the verse of the day more often.</p>
      </div>`}
    <div class="actions">
      <button type="button" class="btn btn-secondary" data-back>${icon('book')}Back to today’s verse</button>
    </div>`, {
    onMount: (box) => {
      box.querySelectorAll('[data-verse]').forEach((b) =>
        b.addEventListener('click', () => showVerse(ctx, getVerse(b.dataset.verse), 'mine')));
      box.querySelector('[data-back]').addEventListener('click', async () =>
        showVerse(ctx, await todaysVerse(repo), 'today'));
    },
  });
}
