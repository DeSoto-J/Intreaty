// app.js — starts Intreaty and connects the pieces.
//
//   data/       what an entry is, the rules, and backups
//   storage/    where data is saved (this device now; the cloud later)
//   ui/         the screens and panels
//   pwa.js      installing, offline and updates

import { LocalAdapter } from './storage/local-adapter.js';
import { Repository } from './data/repository.js';
import { Kind } from './data/models.js';
import { $, $$, toast } from './ui/dom.js';
import { icon } from './ui/icons.js';
import { initSheet, isSheetOpen } from './ui/sheet.js';
import { applyTheme, toggleTheme, effectiveTheme, onThemeChange } from './ui/theme.js';
import { renderList, listKey } from './ui/list-view.js';
import { openDetail, openForm } from './ui/entry-sheets.js';
import { renderSettings, bindSettings } from './ui/settings-view.js';
import { openVerseOfDay, updateVerseDot } from './ui/verse-sheet.js';
import * as pwa from './pwa.js';
import { APP_VERSION } from './version.js';

// One Repository per person. Today that's the single local owner; with
// accounts, this is where a signed-in user's id and a cloud adapter go.
const repo = new Repository(new LocalAdapter(), { appVersion: APP_VERSION });

const state = {
  route: parseRoute(),
  filters: {},          // chosen category filter for each list
  starredFirst: readStarredFirst(),
  animateList: true,    // let cards glide in on the next draw
  lastBackup: null,
  persisted: null,
};
const ctx = { repo, state };

// The "Starred first" choice is remembered on this device.
function readStarredFirst() {
  try { return localStorage.getItem('intreaty.starredFirst') === '1'; } catch { return false; }
}
function saveStarredFirst(on) {
  try { localStorage.setItem('intreaty.starredFirst', on ? '1' : '0'); } catch { /* ignore */ }
}

function parseRoute() {
  const [view, sub] = location.hash.replace(/^#\/?/, '').split('/');
  if (view === 'thanks') return { view: 'thanks' };
  if (view === 'settings') return { view: 'settings' };
  return { view: 'requests', status: sub === 'answered' ? 'answered' : 'active' };
}

function render() {
  const { view } = state.route;
  $$('.tab').forEach((t) => {
    if (t.dataset.tab === view) t.setAttribute('aria-current', 'page');
    else t.removeAttribute('aria-current');
  });
  const isSettings = view === 'settings';
  $('#view-list').hidden = isSettings;
  $('#view-settings').hidden = !isSettings;
  $('#add-btn').hidden = isSettings;
  $('#add-btn').setAttribute('aria-label', view === 'thanks' ? 'Add a thanksgiving' : 'Add a prayer request');
  if (isSettings) renderSettings(ctx);
  else renderList(ctx);
}

function updateThemeButton() {
  const dark = effectiveTheme() === 'dark';
  const btn = $('#theme-toggle');
  btn.innerHTML = icon(dark ? 'sun' : 'moon');
  btn.setAttribute('aria-label', dark ? 'Switch to light mode' : 'Switch to dark mode');
}

function bindEvents() {
  $('#theme-toggle').addEventListener('click', toggleTheme);
  $('#verse-btn').addEventListener('click', () =>
    openVerseOfDay(ctx).catch(() => toast('Could not open the verse.')));
  // If the app stays open past midnight, show the "new verse" dot again.
  document.addEventListener('visibilitychange', () => { if (!document.hidden) updateVerseDot(); });
  $('#add-btn').addEventListener('click', () =>
    openForm(ctx, { kind: state.route.view === 'thanks' ? Kind.THANKSGIVING : Kind.REQUEST }));

  $('#view-list').addEventListener('click', (ev) => {
    const star = ev.target.closest('[data-star]');
    if (star) {
      repo.toggleStar(star.dataset.star).catch(() => toast('Could not save that star.'));
      return;
    }
    if (ev.target.closest('#sort-btn')) {
      state.starredFirst = !state.starredFirst;
      saveStarredFirst(state.starredFirst);
      state.animateList = true;
      renderList(ctx);
      return;
    }
    const card = ev.target.closest('[data-open]');
    if (card) return openDetail(ctx, card.dataset.open);
    const status = ev.target.closest('[data-status]');
    if (status) {
      location.hash = status.dataset.status === 'answered' ? '#/requests/answered' : '#/requests';
      return;
    }
    const chip = ev.target.closest('[data-filter]');
    if (chip) {
      state.filters[listKey(state.route)] = chip.dataset.filter;
      state.animateList = true;
      renderList(ctx);
    }
  });

  addEventListener('hashchange', () => {
    state.route = parseRoute();
    state.animateList = true;
    render();
    scrollTo({ top: 0 });
  });

  bindSettings(ctx);
}

function maybeShowInstallTip() {
  if (pwa.isStandalone()) return;
  let shown = false;
  try { shown = localStorage.getItem('intreaty.installTip') === '1'; } catch { /* ignore */ }
  if (shown || !(pwa.canPromptInstall() || pwa.isIOS())) return;
  try { localStorage.setItem('intreaty.installTip', '1'); } catch { /* ignore */ }
  setTimeout(() => {
    if (pwa.canPromptInstall()) {
      toast('Put Intreaty on your home screen', { actionLabel: 'Install', onAction: () => pwa.promptInstall(), duration: 9000 });
    } else {
      toast('Tip: add Intreaty to your home screen', { actionLabel: 'How', onAction: () => { location.hash = '#/settings'; }, duration: 9000 });
    }
  }, 1500);
}

async function init() {
  applyTheme();
  $('.brand-mark').innerHTML = icon('flame');
  $('#add-btn').innerHTML = icon('plus');
  $$('[data-icon]').forEach((el) => { el.innerHTML = icon(el.dataset.icon); });
  updateThemeButton();
  onThemeChange(() => {
    updateThemeButton();
    if (state.route.view === 'settings') renderSettings(ctx);
  });
  initSheet();

  try {
    await repo.init();
  } catch (err) {
    $('#main').innerHTML = `<div class="empty"><h2>Intreaty couldn't open</h2><p>${
      String(err.message || 'This browser blocked saving data.').replace(/</g, '&lt;')
    } If you're in a private browsing window, try a normal one.</p></div>`;
    return;
  }

  state.lastBackup = (await repo.getMeta('lastBackupAt')) || null;
  state.persisted = await pwa.isPersisted();

  // Redraw whenever data changes. If a panel is open it redraws itself.
  repo.subscribe(render);
  bindEvents();
  render();
  updateVerseDot();

  pwa.registerServiceWorker({
    onUpdateReady: (apply) => toast('A new version of Intreaty is ready', {
      actionLabel: 'Refresh',
      onAction: apply,
      duration: 10 * 60 * 1000,
    }),
  });
  pwa.onInstallChange(() => {
    if (state.route.view === 'settings' && !isSheetOpen()) renderSettings(ctx);
    maybeShowInstallTip();
  });
  maybeShowInstallTip();
  if (pwa.isStandalone()) {
    pwa.requestPersistence().then((p) => { if (p !== null) state.persisted = p; });
  }
}

init();
