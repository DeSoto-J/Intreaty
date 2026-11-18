// list-view.js — draws the Prayer Requests and Thanksgivings lists.

import { Kind, Status } from '../data/models.js';
import { $, esc, formatDate, formatToday, plural, categoryColor } from './dom.js';
import { icon } from './icons.js';

export const listKey = (route) => (route.view === 'thanks' ? 'thanks' : `requests-${route.status}`);

export function queryFor(route) {
  return route.view === 'thanks'
    ? { kind: Kind.THANKSGIVING }
    : { kind: Kind.REQUEST, status: route.status === 'answered' ? Status.ANSWERED : Status.ACTIVE };
}

const EMPTY = {
  'requests-active': {
    icon: 'flame',
    title: 'Your prayer list is ready',
    text: "Tap + to add someone or something you're praying for.",
  },
  'requests-answered': {
    icon: 'checkCircle',
    title: 'Remember your answered prayers here',
    text: 'When a prayer is answered, mark it answered and it will be kept here.',
  },
  thanks: {
    icon: 'heart',
    title: 'Count your blessings',
    text: "Tap + to write down something you're grateful for.",
  },
};

function cardHTML(repo, e, i) {
  const cat = repo.getCategory(e.categoryId);
  const answered = e.status === Status.ANSWERED;
  const fromPrayer = e.kind === Kind.THANKSGIVING && e.linkedEntryId && repo.getEntry(e.linkedEntryId);
  return `
    <li class="card${e.starred ? ' is-starred' : ''}" style="--i:${Math.min(i, 12)}">
      <button class="star-btn" type="button" data-star="${esc(e.id)}" aria-pressed="${Boolean(e.starred)}"
        aria-label="${e.starred ? 'Remove star from' : 'Star'} ${esc(e.title)}">${icon('star')}</button>
      <button class="card-btn" type="button" data-open="${esc(e.id)}">
        <div class="card-meta">
          <span class="cat"><span class="dot" style="--c:${categoryColor(cat.id)}"></span>${esc(cat.name)}</span>
          <time datetime="${esc(e.date)}">${esc(formatDate(e.date))}</time>
        </div>
        <h3 class="card-title">${esc(e.title)}</h3>
        ${e.details ? `<p class="card-details">${esc(e.details)}</p>` : ''}
        ${answered ? `<div class="answer-line">${icon('checkCircle')}<span>Answered ${esc(formatDate(e.answeredOn))}${e.answerNote ? ` — ${esc(e.answerNote)}` : ''}</span></div>` : ''}
        ${fromPrayer ? `<span class="linked-tag">${icon('flame')}From an answered prayer</span>` : ''}
      </button>
    </li>`;
}

export function renderList({ repo, state }) {
  const route = state.route;
  const isThanks = route.view === 'thanks';
  const key = listKey(route);
  const base = repo.listEntries(queryFor(route));

  $('#today-line').textContent = formatToday();
  $('#view-title').textContent = isThanks ? 'Thanksgivings' : 'Prayer Requests';

  // Active / Answered switch
  const tabs = $('#status-tabs');
  tabs.hidden = isThanks;
  if (!isThanks) {
    const active = repo.listEntries({ kind: Kind.REQUEST, status: Status.ACTIVE }).length;
    const answered = repo.listEntries({ kind: Kind.REQUEST, status: Status.ANSWERED }).length;
    const onAnswered = route.status === 'answered';
    tabs.style.setProperty('--index', onAnswered ? 1 : 0);
    tabs.innerHTML = `
      <button type="button" role="tab" data-status="active" aria-selected="${!onAnswered}">Active<span class="count">${active}</span></button>
      <button type="button" role="tab" data-status="answered" aria-selected="${onAnswered}">Answered<span class="count">${answered}</span></button>`;
  }

  // Category filter: only categories that appear in this list.
  const used = new Set(base.map((e) => e.categoryId));
  let filter = state.filters[key] || 'all';
  if (filter !== 'all' && !used.has(filter)) filter = state.filters[key] = 'all';
  const cats = repo.listCategories().filter((c) => used.has(c.id));
  const chips = $('#category-chips');
  chips.hidden = cats.length < 2;
  chips.innerHTML = [
    `<button type="button" class="chip" data-filter="all" aria-pressed="${filter === 'all'}">All</button>`,
    ...cats.map((c) => `
      <button type="button" class="chip" data-filter="${esc(c.id)}" aria-pressed="${filter === c.id}">
        <span class="dot" style="--c:${categoryColor(c.id)}"></span>${esc(c.name)}
      </button>`),
  ].join('');

  let list = filter === 'all' ? base : base.filter((e) => e.categoryId === filter);
  // "Starred first" keeps the usual newest-first order within each group.
  if (state.starredFirst) list = [...list.filter((e) => e.starred), ...list.filter((e) => !e.starred)];

  const sortBtn = $('#sort-btn');
  sortBtn.hidden = base.length === 0;
  sortBtn.setAttribute('aria-pressed', String(state.starredFirst));
  sortBtn.innerHTML = `${icon('star')}Starred first`;

  const n = base.length;
  $('#view-sub').textContent =
    key === 'requests-active' ? (n ? `${plural(n, 'request')} you're lifting up` : 'Bring your requests here.')
    : key === 'requests-answered' ? (n ? `${plural(n, 'prayer')} answered` : 'Answered prayers are kept here.')
    : (n ? `${plural(n, 'blessing')} remembered` : 'The good things you are grateful for.');

  const ul = $('#entry-list');
  // Cards glide in when you switch lists, but not on every small change like tapping a star.
  ul.classList.toggle('static', !state.animateList);
  state.animateList = false;
  ul.innerHTML = list.map((e, i) => cardHTML(repo, e, i)).join('');

  const empty = $('#empty-state');
  empty.hidden = list.length > 0;
  if (!list.length) {
    const m = EMPTY[key];
    empty.innerHTML = `<div class="empty-icon">${icon(m.icon)}</div><h2>${m.title}</h2><p>${m.text}</p>`;
  }
}
