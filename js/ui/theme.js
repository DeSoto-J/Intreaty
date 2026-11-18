// theme.js — light / dark mode.
// The choice ('system', 'light' or 'dark') is remembered on this device.

const KEY = 'intreaty.theme';
const darkQuery = matchMedia('(prefers-color-scheme: dark)');
const listeners = new Set();

export function getThemePref() {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'light' || v === 'dark' ? v : 'system';
  } catch {
    return 'system';
  }
}

export function effectiveTheme(pref = getThemePref()) {
  if (pref === 'system') return darkQuery.matches ? 'dark' : 'light';
  return pref;
}

function syncThemeColor() {
  // Colours the phone's status bar / browser bar to match the app.
  const bg = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim();
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', bg);
}

export function applyTheme(pref = getThemePref()) {
  const root = document.documentElement;
  if (pref === 'system') delete root.dataset.theme;
  else root.dataset.theme = pref;
  syncThemeColor();
  for (const fn of listeners) fn(pref);
}

export function setThemePref(pref) {
  try {
    if (pref === 'system') localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, pref);
  } catch { /* private mode: just apply for this visit */ }
  applyTheme(pref);
}

export function toggleTheme() {
  setThemePref(effectiveTheme() === 'dark' ? 'light' : 'dark');
}

export function onThemeChange(fn) {
  listeners.add(fn);
}

darkQuery.addEventListener?.('change', () => {
  if (getThemePref() === 'system') applyTheme('system');
});
