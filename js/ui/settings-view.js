// settings-view.js — the Settings screen: appearance, categories, backup,
// installing the app, feedback, and about.

import { Kind } from '../data/models.js';
import { parseBackup, backupFileName, BackupError } from '../data/backup.js';
import { $, esc, plural, categoryColor, toast } from './dom.js';
import { icon } from './icons.js';
import { openSheet, closeSheet, confirmSheet } from './sheet.js';
import { getThemePref, setThemePref } from './theme.js';
import * as pwa from '../pwa.js';
import { APP_VERSION } from '../version.js';
import { getVerse, APP_VERSE_ID } from '../data/verses.js';
import { openFeedback } from './feedback-sheet.js';

const THEMES = [['system', 'Automatic'], ['light', 'Light'], ['dark', 'Dark']];

function timeAgo(iso) {
  const days = Math.floor((Date.now() - Date.parse(iso)) / 86400000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  return months === 1 ? 'a month ago' : `${months} months ago`;
}

function installSection() {
  if (pwa.isStandalone()) return '';
  let body;
  if (pwa.canPromptInstall()) {
    body = `<p class="note">Add Intreaty to your home screen so it opens like an app, works offline, and keeps your data safe.</p>
      <button type="button" class="btn btn-primary" data-set="install" style="width:100%">${icon('phone')}Install Intreaty</button>`;
  } else if (pwa.isIOS()) {
    body = `<p class="note">Add Intreaty to your home screen. It opens like an app, works offline, and iPhone keeps its data safe.</p>
      <ol class="install-steps">
        <li>In Safari, tap the <strong>Share</strong> button ${icon('share')}</li>
        <li>Scroll down and tap <strong>Add to Home Screen</strong> ${icon('squarePlus')}</li>
        <li>Tap <strong>Add</strong>, then open Intreaty from your home screen</li>
      </ol>`;
  } else {
    body = `<p class="note" style="margin:0">On Android, open this page in <strong>Chrome</strong>, tap the <strong>⋮</strong> menu, then <strong>Install app</strong> (or <strong>Add to Home screen</strong>).</p>`;
  }
  return `<section class="group"><h2 class="group-title">Install</h2><div class="panel panel-pad">${body}</div></section>`;
}

export function renderSettings(ctx) {
  const { repo, state } = ctx;
  const pref = getThemePref();
  const idx = THEMES.findIndex(([v]) => v === pref);
  const cats = repo.listCategories();
  const total = repo.listEntries().length;
  const last = state.lastBackup;
  const stale = total > 0 && (!last || Date.now() - Date.parse(last) > 30 * 86400000);

  $('#view-settings').innerHTML = `
    <div class="view-head">
      <p class="eyebrow">Make it yours</p>
      <h1 class="view-title" id="settings-title">Settings</h1>
    </div>

    <section class="group">
      <h2 class="group-title">Appearance</h2>
      <div class="panel panel-pad">
        <div class="segmented" role="radiogroup" aria-label="Theme" style="--count:3;--index:${idx}">
          ${THEMES.map(([v, label]) => `<button type="button" role="radio" data-theme-pref="${v}" aria-selected="${v === pref}" aria-checked="${v === pref}">${label}</button>`).join('')}
        </div>
      </div>
    </section>

    <section class="group">
      <h2 class="group-title">Categories</h2>
      <div class="panel">
        ${cats.map((c) => {
          const n = repo.countInCategory(c.id);
          return `
          <div class="list-row">
            <span class="dot" style="--c:${categoryColor(c.id)}"></span>
            <div class="grow">${esc(c.name)}<div class="sub">${plural(n, 'entry', 'entries')}</div></div>
            ${c.builtIn ? '<span class="lock">Built-in</span>' : `
              <button type="button" class="small-btn" data-cat-rename="${esc(c.id)}" aria-label="Rename ${esc(c.name)}">${icon('pencil')}</button>
              <button type="button" class="small-btn danger" data-cat-delete="${esc(c.id)}" aria-label="Remove ${esc(c.name)}">${icon('trash')}</button>`}
          </div>`;
        }).join('')}
        <form class="list-row" id="cat-form">
          <div class="inline-add grow" style="margin:0">
            <input class="input" name="name" maxlength="40" autocomplete="off" placeholder="Add a category" aria-label="New category name" enterkeyhint="done">
            <button type="submit" class="btn btn-secondary">${icon('plus')}Add</button>
          </div>
        </form>
      </div>
    </section>

    <section class="group">
      <h2 class="group-title">Backup</h2>
      <div class="panel panel-pad">
        <p class="note">Your prayers are saved <strong>only on this device</strong>. Save a backup file now and then (to Files, Google Drive or email) so you never lose them.</p>
        <p class="note">${last ? `Last backup: <strong>${timeAgo(last)}</strong>.` : 'No backup saved yet.'}${stale ? ' It’s a good time to save one.' : ''}</p>
        <div class="btn-stack">
          <button type="button" class="btn btn-primary" data-set="export">${icon('download')}Save a backup</button>
          <button type="button" class="btn btn-ghost" data-set="import">${icon('upload')}Restore from a backup</button>
        </div>
      </div>
    </section>

    ${installSection()}

    <section class="group">
      <h2 class="group-title">Feedback</h2>
      <div class="panel panel-pad">
        <p class="note">Found a problem or have an idea? Send it straight to the maker of Intreaty. No email or sign-in needed.</p>
        <button type="button" class="btn btn-secondary" data-set="feedback" style="width:100%">${icon('message')}Send feedback</button>
      </div>
    </section>

    <section class="group">
      <h2 class="group-title">Your data</h2>
      <div class="panel">
        <div class="list-row"><div class="grow">Entries saved<div class="sub">${plural(repo.listEntries({ kind: Kind.REQUEST }).length, 'request')}, ${plural(repo.listEntries({ kind: Kind.THANKSGIVING }).length, 'thanksgiving')}</div></div></div>
        <div class="list-row"><div class="grow">Storage<div class="sub">${
          state.persisted ? 'Protected — the browser won’t clear it on its own.'
          : 'The browser could clear it if the phone runs very low on space. Installing the app and keeping a backup protects it.'}</div></div></div>
      </div>
    </section>

    <div class="about">
      <span class="brand-name">Intreaty</span>
      <figure class="about-verse">
        <blockquote>“${esc(getVerse(APP_VERSE_ID).text)}”</blockquote>
        <figcaption>${esc(getVerse(APP_VERSE_ID).ref)}</figcaption>
      </figure>
      Version ${APP_VERSION} · Private by design — nothing leaves your device.
    </div>`;
}

// ---------- Actions ----------

async function exportBackup(ctx) {
  const { repo, state } = ctx;
  const json = JSON.stringify(repo.exportBackup(), null, 2);
  const name = backupFileName();
  const file = new File([json], name, { type: 'application/json' });
  const onPhone = matchMedia('(pointer: coarse)').matches;
  let saved = false;
  if (onPhone && navigator.canShare?.({ files: [file] })) {
    // Opens the phone's share sheet: "Save to Files", Google Drive, email…
    try {
      await navigator.share({ files: [file], title: 'Intreaty backup' });
      saved = true;
    } catch (err) {
      if (err.name === 'AbortError') return;
    }
  }
  if (!saved) {
    const url = URL.createObjectURL(file);
    const a = Object.assign(document.createElement('a'), { href: url, download: name });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }
  state.lastBackup = new Date().toISOString();
  await repo.setMeta('lastBackupAt', state.lastBackup);
  toast('Backup saved');
  renderSettings(ctx);
}

function openImportChoice(ctx, parsed) {
  const { repo } = ctx;
  const s = repo.summarize(parsed);
  const when = parsed.exportedAt ? new Date(parsed.exportedAt).toLocaleDateString(undefined, { dateStyle: 'medium' }) : 'an unknown date';
  openSheet(`
    <div class="sheet-head"><h2 class="sheet-title" id="sheet-title">Restore backup</h2>
      <button type="button" class="icon-btn close-btn" data-close aria-label="Close">${icon('close')}</button></div>
    <p class="note">This backup is from <strong>${esc(when)}</strong> and has ${plural(s.requests, 'prayer request')} and ${plural(s.thanksgivings, 'thanksgiving')}.</p>
    <div class="actions">
      <button type="button" class="btn btn-primary" data-mode="merge">Merge with this device</button>
      <p class="note" style="margin:-4px 4px 6px">Recommended. Keeps everything here and adds what’s missing.</p>
      <button type="button" class="btn btn-danger" data-mode="replace">Replace everything on this device</button>
    </div>`, {
    onMount: (box) => box.querySelectorAll('[data-mode]').forEach((b) => b.addEventListener('click', async () => {
      const mode = b.dataset.mode;
      if (mode === 'replace') {
        const ok = await confirmSheet({
          title: 'Replace everything?',
          message: 'Everything on this device will be swapped for what’s in the backup. Anything added since that backup will be lost.',
          confirmLabel: 'Replace everything',
          danger: true,
        });
        if (!ok) return;
      }
      try {
        const r = await repo.importBackup(parsed, mode);
        closeSheet();
        toast(mode === 'replace' ? 'Backup restored'
          : r.added || r.updated ? `Restored ${plural(r.added, 'new entry', 'new entries')}${r.updated ? `, updated ${r.updated}` : ''}`
          : 'Everything in that backup was already here');
      } catch (err) {
        closeSheet();
        toast(err.message || 'Restoring failed. Nothing was changed.');
      }
    })),
  });
}

function openRename(ctx, id) {
  const { repo } = ctx;
  const cat = repo.categories.get(id);
  openSheet(`
    <div class="sheet-head"><h2 class="sheet-title" id="sheet-title">Rename category</h2>
      <button type="button" class="icon-btn close-btn" data-close aria-label="Close">${icon('close')}</button></div>
    <form id="rename-form" novalidate>
      <div class="field"><label for="r-name">Name</label>
        <input class="input" id="r-name" name="name" maxlength="40" autocomplete="off" value="${esc(cat.name)}" data-autofocus></div>
      <p class="form-error" hidden></p>
      <button type="submit" class="btn btn-primary" style="width:100%">Save</button>
    </form>`, {
    onMount: (box) => box.querySelector('form').addEventListener('submit', async (ev) => {
      ev.preventDefault();
      try {
        await repo.renameCategory(id, ev.target.elements.namedItem('name').value);
        closeSheet();
      } catch (err) {
        const el = box.querySelector('.form-error');
        el.textContent = err.message;
        el.hidden = false;
      }
    }),
  });
}

export function bindSettings(ctx) {
  const { repo } = ctx;
  const root = $('#view-settings');
  const fileInput = $('#import-file');

  root.addEventListener('click', async (ev) => {
    const t = ev.target.closest('button');
    if (!t) return;
    if (t.dataset.themePref) {
      setThemePref(t.dataset.themePref);
    } else if (t.dataset.set === 'export') {
      exportBackup(ctx).catch(() => toast('Could not save the backup.'));
    } else if (t.dataset.set === 'import') {
      fileInput.click();
    } else if (t.dataset.set === 'install') {
      pwa.promptInstall();
    } else if (t.dataset.set === 'feedback') {
      openFeedback();
    } else if (t.dataset.catRename) {
      openRename(ctx, t.dataset.catRename);
    } else if (t.dataset.catDelete) {
      const id = t.dataset.catDelete;
      const cat = repo.categories.get(id);
      const n = repo.countInCategory(id);
      const ok = await confirmSheet({
        title: `Remove “${esc(cat.name)}”?`,
        message: n ? `${plural(n, 'entry', 'entries')} in this category will move to <strong>Other</strong>.` : 'No entries use this category.',
        confirmLabel: 'Remove category',
        danger: true,
      });
      if (!ok) return;
      closeSheet();
      try { await repo.deleteCategory(id); } catch (err) { toast(err.message); }
    }
  });

  root.addEventListener('submit', async (ev) => {
    if (ev.target.id !== 'cat-form') return;
    ev.preventDefault();
    const input = ev.target.elements.namedItem('name');
    if (!input.value.trim()) return;
    try {
      const cat = await repo.addCategory(input.value);
      toast(`Added “${cat.name}”`);
    } catch (err) {
      toast(err.message);
    }
  });

  fileInput.addEventListener('change', async () => {
    const file = fileInput.files[0];
    fileInput.value = '';
    if (!file) return;
    try {
      const parsed = parseBackup(await file.text(), repo.ownerId);
      openImportChoice(ctx, parsed);
    } catch (err) {
      toast(err instanceof BackupError ? err.message : 'That file could not be read.');
    }
  });
}
