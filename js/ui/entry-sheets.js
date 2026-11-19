// entry-sheets.js — the slide-up panels for one entry: view it, add/edit it,
// and mark it answered.

import { Kind, Status, LIMITS, todayLocal } from '../data/models.js';
import { esc, formatDate, categoryColor, toast } from './dom.js';
import { icon } from './icons.js';
import { openSheet, closeSheet } from './sheet.js';
import { requestPersistence } from '../pwa.js';
import { openPaste } from './paste-sheet.js';

const closeBtn = `<button type="button" class="icon-btn close-btn" data-close aria-label="Close">${icon('close')}</button>`;

function categoryOptions(repo, selectedId) {
  return repo.listCategories()
    .map((c) => `<option value="${esc(c.id)}"${c.id === selectedId ? ' selected' : ''}>${esc(c.name)}</option>`)
    .join('') + '<option value="__new">+ New category…</option>';
}

// ---------- View one entry ----------

export function openDetail(ctx, id) {
  const { repo } = ctx;
  const e = repo.getEntry(id);
  if (!e) return closeSheet();
  const cat = repo.getCategory(e.categoryId);
  const isRequest = e.kind === Kind.REQUEST;
  const answered = e.status === Status.ANSWERED;
  const linked = e.linkedEntryId ? repo.getEntry(e.linkedEntryId) : null;

  let primary = '';
  if (isRequest && !answered) {
    primary = `<button type="button" class="btn btn-answer" data-act="answer">${icon('check')}Mark answered</button>`;
  } else if (answered) {
    primary = `
      ${linked ? '' : `<button type="button" class="btn btn-secondary" data-act="add-thanks">${icon('sparkle')}Add to Thanksgivings</button>`}
      <button type="button" class="btn btn-secondary" data-act="reopen">${icon('reopen')}Mark as still praying</button>`;
  }

  openSheet(`
    <div class="sheet-head">
      <div class="detail-meta">
        <span class="cat"><span class="dot" style="--c:${categoryColor(cat.id)}"></span>${esc(cat.name)}</span>
        <span>${isRequest ? 'Added' : 'Dated'} ${esc(formatDate(e.date))}</span>
      </div>
      <div class="head-actions">
        <button type="button" class="icon-btn close-btn sheet-star" data-act="star" aria-pressed="${Boolean(e.starred)}"
          aria-label="${e.starred ? 'Remove star' : 'Star this entry'}">${icon('star')}</button>
        ${closeBtn}
      </div>
    </div>
    <h2 class="detail-title" id="sheet-title">${esc(e.title)}</h2>
    ${e.details ? `<p class="detail-body">${esc(e.details)}</p>` : ''}
    ${answered ? `
      <div class="answer-block">
        <h3>${icon('checkCircle')}Answered ${esc(formatDate(e.answeredOn))}</h3>
        ${e.answerNote ? `<p>${esc(e.answerNote)}</p>` : ''}
      </div>` : ''}
    ${linked ? `<button type="button" class="link-btn" data-goto="${esc(linked.id)}">${isRequest ? 'View in Thanksgivings' : 'View the original request'}${icon('arrow')}</button>` : ''}
    <div class="actions">
      ${primary}
      <div class="actions-row">
        <button type="button" class="btn btn-ghost" data-act="edit">${icon('pencil')}Edit</button>
        <button type="button" class="btn btn-danger" data-act="delete">${icon('trash')}Delete</button>
      </div>
    </div>`, {
    onMount: (box) => {
      box.querySelector('[data-goto]')?.addEventListener('click', (ev) => openDetail(ctx, ev.currentTarget.dataset.goto));
      box.querySelectorAll('[data-act]').forEach((b) => b.addEventListener('click', async () => {
        const act = b.dataset.act;
        try {
          if (act === 'star') {
            const updated = await repo.toggleStar(id);
            b.setAttribute('aria-pressed', String(Boolean(updated?.starred)));
            b.setAttribute('aria-label', updated?.starred ? 'Remove star' : 'Star this entry');
          } else if (act === 'answer') openAnswer(ctx, id);
          else if (act === 'edit') openForm(ctx, { id });
          else if (act === 'reopen') {
            await repo.reopen(id);
            toast('Moved back to Active');
            openDetail(ctx, id);
          } else if (act === 'add-thanks') {
            await repo.addThanksgivingFor(id);
            toast('Added to Thanksgivings', { actionLabel: 'View', onAction: () => { location.hash = '#/thanks'; } });
            openDetail(ctx, id);
          } else if (act === 'delete') {
            closeSheet();
            await repo.deleteEntry(id);
            toast('Deleted', { actionLabel: 'Undo', onAction: () => repo.restoreEntry(id) });
          }
        } catch (err) {
          toast(err.message || 'Something went wrong.');
        }
      }));
    },
  });
}

// ---------- Add or edit ----------

export function openForm(ctx, { id, kind } = {}) {
  const { repo, state } = ctx;
  const e = id ? repo.getEntry(id) : null;
  const k = e?.kind || kind || Kind.REQUEST;
  const isThanks = k === Kind.THANKSGIVING;
  const answered = e?.status === Status.ANSWERED;
  const currentFilter = state.filters[state.route.view === 'thanks' ? 'thanks' : `requests-${state.route.status}`];
  const catId = e?.categoryId || (currentFilter && currentFilter !== 'all' ? currentFilter : 'other');
  const heading = e ? (isThanks ? 'Edit thanksgiving' : 'Edit request') : (isThanks ? 'New thanksgiving' : 'New prayer request');

  openSheet(`
    <div class="sheet-head"><h2 class="sheet-title" id="sheet-title">${heading}</h2>${closeBtn}</div>
    <form id="entry-form" novalidate>
      <div class="field">
        <label for="f-title">${isThanks ? 'What are you thankful for?' : 'Who or what are you praying for?'}</label>
        <input class="input" id="f-title" name="title" maxlength="${LIMITS.title}" autocomplete="off" enterkeyhint="next"
          value="${esc(e?.title || '')}" placeholder="${isThanks ? 'e.g. A safe trip home' : "e.g. Mom's surgery on Friday"}">
      </div>
      ${e ? '' : `<button type="button" class="link-btn paste-link" id="paste-open">${icon('squarePlus')}Add several at once</button>`}
      <div class="field">
        <label for="f-details">Details <span class="lock">(optional)</span></label>
        <textarea class="textarea" id="f-details" name="details" maxlength="${LIMITS.details}" placeholder="Anything you want to remember…">${esc(e?.details || '')}</textarea>
      </div>
      <div class="row">
        <div class="field">
          <label for="f-date">Date</label>
          <input class="input" type="date" id="f-date" name="date" value="${esc(e?.date || todayLocal())}">
        </div>
        <div class="field">
          <label for="f-cat">Category</label>
          <select class="select" id="f-cat" name="categoryId">${categoryOptions(repo, catId)}</select>
        </div>
      </div>
      <div class="field" id="new-cat" hidden>
        <label for="f-newcat">New category name</label>
        <div class="inline-add">
          <input class="input" id="f-newcat" maxlength="${LIMITS.category}" autocomplete="off" placeholder="e.g. Missions" enterkeyhint="done">
          <button type="button" class="btn btn-secondary" id="add-cat">Add</button>
        </div>
      </div>
      ${answered ? `
        <div class="field">
          <label for="f-answered">Answered on</label>
          <input class="input" type="date" id="f-answered" name="answeredOn" value="${esc(e.answeredOn)}">
        </div>
        <div class="field">
          <label for="f-note">How was it answered?</label>
          <textarea class="textarea" id="f-note" name="answerNote" maxlength="${LIMITS.note}">${esc(e.answerNote)}</textarea>
        </div>` : ''}
      <p class="form-error" id="form-error" hidden></p>
      <div class="actions">
        <button type="submit" class="btn btn-primary">${icon('check')}${e ? 'Save changes' : isThanks ? 'Add thanksgiving' : 'Add request'}</button>
      </div>
    </form>`, {
    onMount: (box) => {
      const form = box.querySelector('#entry-form');
      const select = box.querySelector('#f-cat');
      const newCat = box.querySelector('#new-cat');
      const newCatInput = box.querySelector('#f-newcat');
      const errorEl = box.querySelector('#form-error');
      let lastCat = select.value;
      const showError = (msg) => { errorEl.textContent = msg; errorEl.hidden = !msg; };

      if (!e) box.querySelector('#f-title').focus({ preventScroll: true });

      // Anything already typed in the title box becomes the first line of the list.
      box.querySelector('#paste-open')?.addEventListener('click', () => openPaste(ctx, {
        kind: k,
        categoryId: select.value === '__new' ? lastCat : select.value,
        text: box.querySelector('#f-title').value.trim(),
      }));

      select.addEventListener('change', () => {
        if (select.value === '__new') {
          newCat.hidden = false;
          newCatInput.focus();
        } else {
          lastCat = select.value;
          newCat.hidden = true;
        }
      });
      const addCategory = async () => {
        try {
          const cat = await repo.addCategory(newCatInput.value);
          select.innerHTML = categoryOptions(repo, cat.id);
          lastCat = cat.id;
          newCatInput.value = '';
          newCat.hidden = true;
          showError('');
        } catch (err) {
          showError(err.message);
        }
      };
      box.querySelector('#add-cat').addEventListener('click', addCategory);
      newCatInput.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') { ev.preventDefault(); addCategory(); } });

      form.addEventListener('submit', async (ev) => {
        ev.preventDefault();
        const data = Object.fromEntries(new FormData(form));
        if (data.categoryId === '__new') data.categoryId = lastCat;
        if (!data.title.trim()) {
          showError('Please add a title.');
          box.querySelector('#f-title').focus();
          return;
        }
        try {
          if (e) {
            await repo.updateEntry(e.id, data);
            toast('Saved');
            openDetail(ctx, e.id);
          } else {
            await repo.addEntry({ ...data, kind: k });
            closeSheet();
            toast(isThanks ? 'Thanksgiving added' : 'Prayer request added');
            const target = isThanks ? '#/thanks' : '#/requests';
            // Wait for the panel to finish closing (it steps browser history back) before switching lists.
            setTimeout(() => { if (location.hash !== target) location.hash = target; }, 280);
            requestPersistence().then((p) => { if (p !== null) state.persisted = p; });
          }
        } catch (err) {
          showError(err.message || 'Something went wrong.');
        }
      });
    },
  });
}

// ---------- Mark answered ----------

export function openAnswer(ctx, id) {
  const { repo } = ctx;
  const e = repo.getEntry(id);
  if (!e) return closeSheet();
  openSheet(`
    <div class="sheet-head"><h2 class="sheet-title" id="sheet-title">Answered prayer</h2>${closeBtn}</div>
    <p class="note">“${esc(e.title)}”</p>
    <form id="answer-form" novalidate>
      <div class="field">
        <label for="a-date">Answered on</label>
        <input class="input" type="date" id="a-date" name="answeredOn" value="${todayLocal()}">
      </div>
      <div class="field">
        <label for="a-note">How was it answered? <span class="lock">(optional)</span></label>
        <textarea class="textarea" id="a-note" name="answerNote" maxlength="${LIMITS.note}" placeholder="Write down what happened, so you can look back on it…"></textarea>
      </div>
      <label class="switch-row">
        <span><strong>Also add to Thanksgivings</strong><small>It stays in Answered too.</small></span>
        <span class="switch"><input type="checkbox" name="addThanksgiving" checked><span></span></span>
      </label>
      <div class="actions">
        <button type="submit" class="btn btn-answer">${icon('check')}Mark answered</button>
      </div>
    </form>`, {
    onMount: (box) => {
      const form = box.querySelector('#answer-form');
      form.addEventListener('submit', async (ev) => {
        ev.preventDefault();
        const fd = new FormData(form);
        try {
          const { thanksgiving } = await repo.markAnswered(id, {
            answeredOn: fd.get('answeredOn'),
            answerNote: fd.get('answerNote'),
            addThanksgiving: fd.get('addThanksgiving') === 'on',
          });
          closeSheet();
          if (thanksgiving) {
            toast('Answered and added to Thanksgivings', { actionLabel: 'View', onAction: () => { location.hash = '#/thanks'; } });
          } else {
            toast('Marked answered', { actionLabel: 'View', onAction: () => { location.hash = '#/requests/answered'; } });
          }
        } catch (err) {
          toast(err.message || 'Something went wrong.');
        }
      });
    },
  });
}
