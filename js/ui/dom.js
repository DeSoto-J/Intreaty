// dom.js — small helpers for building the screens.

import { parseLocalDate, todayLocal } from '../data/models.js';

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

// Turns text into safe HTML. Everything the user (or a backup file) typed
// goes through this before it's shown, so it can never run as code.
export function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const fmtShort = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' });
const fmtYear = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
const fmtLong = new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric' });

export function formatDate(dateStr) {
  if (!dateStr) return '';
  if (dateStr === todayLocal()) return 'Today';
  const d = parseLocalDate(dateStr);
  return d.getFullYear() === new Date().getFullYear() ? fmtShort.format(d) : fmtYear.format(d);
}
export const formatToday = () => fmtLong.format(new Date());

export function plural(n, one, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`;
}

// Gentle, earthy colours for category dots. Built-ins get fixed colours;
// custom categories get one picked from their id so it stays the same.
const CATEGORY_COLORS = {
  family: '#b07d56', health: '#7f9a6e', church: '#9a7bb0', friends: '#c09a52', work: '#6f8ca3', other: '#9a8f84',
};
const EXTRA_COLORS = ['#b8796f', '#7e9c94', '#a68a64', '#8c86a8', '#a77d93', '#88a06a'];
export function categoryColor(id) {
  if (CATEGORY_COLORS[id]) return CATEGORY_COLORS[id];
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return EXTRA_COLORS[h % EXTRA_COLORS.length];
}

let toastTimer = null;
export function toast(message, { actionLabel, onAction, duration = 4200 } = {}) {
  const el = $('#toast');
  clearTimeout(toastTimer);
  el.innerHTML = `<span>${esc(message)}</span>${actionLabel ? `<button type="button">${esc(actionLabel)}</button>` : ''}`;
  el.hidden = false;
  requestAnimationFrame(() => el.classList.add('show'));
  const hide = () => {
    el.classList.remove('show');
    setTimeout(() => { if (!el.classList.contains('show')) el.hidden = true; }, 300);
  };
  if (actionLabel) {
    el.querySelector('button').addEventListener('click', () => { hide(); onAction?.(); }, { once: true });
  }
  toastTimer = setTimeout(hide, duration);
}
