// backup.js — writing and reading backup files.
//
// Since version 1.7.0 a backup is a plain text file that reads like a prayer
// list: requests, answered prayers and thanksgivings, each under its
// category, with dates, notes and stars. Restore reads those same words back,
// so there is no hidden code in the file. If someone edits it (or types a new
// prayer under a category), Restore does its best with what's there.
//
// Older versions saved a JSON file. Those can still be restored, so nobody's
// earlier backup becomes useless.

import {
  Kind, Status, BUILT_IN_CATEGORIES, FALLBACK_CATEGORY_ID, LIMITS,
  normalizeCategory, normalizeEntry, newId, todayLocal, toLocalDateString, parseLocalDate, isDateString, nowISO,
} from './models.js';
import { VERSES } from './verses.js';

export const BACKUP_FORMAT = 'intreaty-backup';
export const BACKUP_VERSION = 1;
export const TEXT_BACKUP_TITLE = 'INTREATY BACKUP';

export class BackupError extends Error {}

export function backupFileName(date = todayLocal()) {
  return `intreaty-backup-${date}.txt`;
}

// Restore reads either kind of backup: the readable text file, or an older
// JSON file.
export function parseBackup(text, ownerId) {
  const clean = String(text ?? '').replace(/^﻿/, '');
  if (clean.trimStart().startsWith('{')) return parseJsonBackup(clean, ownerId);
  return parseTextBackup(clean, ownerId);
}

// ---------- Dates in words ----------
// Always English month names, so a backup made on one phone reads back the
// same on any other.

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
  'August', 'September', 'October', 'November', 'December'];

export function longDate(dateStr) {
  const d = parseLocalDate(dateStr);
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

function clockTime(d) {
  const h = d.getHours();
  return `${h % 12 || 12}:${String(d.getMinutes()).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}

// "November 18, 2026", "Nov 18 2026", "18 November 2026" or "2026-11-18".
export function readDate(text) {
  const s = String(text || '').trim();
  let m = s.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return validDate(+m[1], +m[2], +m[3]);
  m = s.match(/([A-Za-z]{3,})\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})/);
  if (m) return validDate(+m[3], monthNumber(m[1]), +m[2]);
  m = s.match(/(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]{3,})\.?,?\s+(\d{4})/);
  if (m) return validDate(+m[3], monthNumber(m[2]), +m[1]);
  return null;
}

function monthNumber(name) {
  const i = MONTHS.findIndex((mn) => mn.toLowerCase().startsWith(name.slice(0, 3).toLowerCase()));
  return i + 1;
}

function validDate(y, m, d) {
  if (!m) return null;
  const s = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  return isDateString(s) ? s : null;
}

function readTime(text) {
  const m = String(text || '').match(/(\d{1,2}):(\d{2})\s*([AaPp])\.?[Mm]?/);
  if (!m) return null;
  const h = (+m[1] % 12) + (/p/i.test(m[3]) ? 12 : 0);
  return { h, min: +m[2] };
}

// ---------- Writing the readable backup ----------

const INDENT = '    ';
const SECTION = (name) => `========== ${name} ==========`;
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const oneLine = (s) => String(s).replace(/\s*\n\s*/g, ' ').trim();

// A labelled field. Notes with several lines keep their line breaks, lined
// up under the first line.
function field(label, value) {
  const head = `${INDENT}${label}: `;
  const pad = ' '.repeat(head.length);
  return String(value).split('\n').map((line, i) => (i === 0 ? head : line ? pad : '') + line);
}

// entries and categories come in the order they appear in the app.
export function formatTextBackup({ entries, categories, verseFavoriteIds = [], savedAt = new Date() }) {
  const live = entries.filter((e) => !e.deletedAt);
  const active = live.filter((e) => e.kind === Kind.REQUEST && e.status !== Status.ANSWERED);
  const answered = live.filter((e) => e.kind === Kind.REQUEST && e.status === Status.ANSWERED);
  const thanks = live.filter((e) => e.kind === Kind.THANKSGIVING);
  const cats = categories.filter((c) => !c.deletedAt);
  const catName = new Map(cats.map((c) => [c.id, c.name]));
  const linked = new Set(live.map((e) => e.id));

  const out = [
    TEXT_BACKUP_TITLE,
    `Saved ${longDate(toLocalDateString(savedAt))} at ${clockTime(savedAt)}`,
    `${plural(active.length, 'prayer request')} · ${plural(answered.length, 'answered prayer')} · ${plural(thanks.length, 'thanksgiving')}`,
    '',
    'This is your prayer list from Intreaty. Keep it somewhere safe.',
    'To bring it back, open Intreaty, go to Settings, and tap Restore from a backup.',
  ];

  const section = (title, list, describe) => {
    out.push('', SECTION(title));
    if (!list.length) { out.push('', '(none)'); return; }
    // Same category order as the app; anything in an unknown category goes under Other.
    const order = [...cats.map((c) => c.id)];
    const groupOf = (e) => (catName.has(e.categoryId) ? e.categoryId : FALLBACK_CATEGORY_ID);
    for (const catId of order) {
      const group = list.filter((e) => groupOf(e) === catId);
      if (!group.length) continue;
      out.push('', `[${catName.get(catId) || 'Other'}]`);
      for (const e of group) {
        out.push('', `• ${e.starred ? '★ ' : ''}${oneLine(e.title)}`);
        describe(e);
      }
    }
  };

  section('PRAYER REQUESTS', active, (e) => {
    out.push(...field('Added', longDate(e.date)));
    if (e.details) out.push(...field('Notes', e.details));
  });
  section('ANSWERED PRAYERS', answered, (e) => {
    out.push(...field('Added', longDate(e.date)));
    out.push(...field('Answered', longDate(e.answeredOn || e.date)));
    if (e.details) out.push(...field('Notes', e.details));
    if (e.answerNote) out.push(...field('How God answered', e.answerNote));
    if (e.linkedEntryId && linked.has(e.linkedEntryId)) out.push(`${INDENT}Also in Thanksgivings`);
  });
  section('THANKSGIVINGS', thanks, (e) => {
    out.push(...field('Added', longDate(e.date)));
    if (e.details) out.push(...field('Notes', e.details));
  });

  // Your own categories, so ones with nothing in them come back too.
  const custom = cats.filter((c) => !c.builtIn);
  if (custom.length) {
    out.push('', SECTION('YOUR CATEGORIES'), '', ...custom.map((c) => c.name));
  }

  const verses = VERSES.filter((v) => verseFavoriteIds.includes(v.id));
  if (verses.length) {
    out.push('', SECTION('SAVED VERSES'), '', ...verses.map((v) => v.ref));
  }

  // The invisible mark at the start helps every phone and computer show the
  // bullets, stars and dashes correctly.
  return `﻿${out.join('\n')}\n`;
}

// ---------- Reading the readable backup ----------

const SECTION_KINDS = [
  [/answer/i, 'answered'],
  [/thank/i, 'thanks'],
  [/request|prayer/i, 'requests'],
  [/categor/i, 'categories'],
  [/verse/i, 'verses'],
];

function sectionKind(line) {
  const m = line.match(/^=+\s*(.*?)\s*=+$/) || line.match(/^([A-Z][A-Z\s]{3,})$/);
  if (!m) return null;
  const found = SECTION_KINDS.find(([re]) => re.test(m[1]));
  return found ? found[1] : null;
}

const BULLET = /^[•\-*–·]\s+/;
const FIELD = /^(Added|Answered|Notes|How God answered)\s*:\s*(.*)$/i;
const normRef = (s) => s.toLowerCase().replace(/[–—-]/g, '-').replace(/\s+/g, ' ').trim();

export function parseTextBackup(text, ownerId) {
  const lines = String(text).replace(/^﻿/, '').replace(/\r\n?/g, '\n').split('\n');
  const head = lines.filter((l) => l.trim()).slice(0, 5).join('\n');
  if (!head.toUpperCase().includes(TEXT_BACKUP_TITLE)) {
    throw new BackupError("This doesn't look like an Intreaty backup file.");
  }

  // When it was saved: "Saved November 20, 2026 at 3:41 PM".
  let exportedAt = null;
  const savedLine = lines.slice(0, 10).find((l) => /^\s*saved\b/i.test(l));
  const savedDate = savedLine && readDate(savedLine);
  if (savedDate) {
    const d = parseLocalDate(savedDate);
    const t = readTime(savedLine.replace(/.*\bat\b/i, ''));
    if (t) d.setHours(t.h, t.min);
    exportedAt = d.toISOString();
  }
  const stamp = exportedAt || nowISO();
  const fallbackDate = savedDate || todayLocal();

  // Categories by name. Built-in ones keep their fixed ids.
  const cats = new Map(); // lower-case name -> raw category
  const categoryId = (name) => {
    const clean = name.trim().slice(0, LIMITS.category);
    if (!clean) return FALLBACK_CATEGORY_ID;
    const key = clean.toLowerCase();
    const builtIn = BUILT_IN_CATEGORIES.find((c) => c.name.toLowerCase() === key);
    if (builtIn) return builtIn.id;
    if (!cats.has(key)) cats.set(key, { id: newId(), name: clean, createdAt: stamp, updatedAt: stamp });
    return cats.get(key).id;
  };

  const raw = [];
  const favs = [];
  let section = null;
  let catId = FALLBACK_CATEGORY_ID;
  let entry = null;
  let lastField = null; // the multi-line field being read
  let blankSince = false;

  const finish = () => { entry = null; lastField = null; blankSince = false; };

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) { blankSince = true; continue; }
    const indented = /^\s/.test(line);

    const kind = !indented && sectionKind(trimmed);
    if (kind) { finish(); section = kind; catId = FALLBACK_CATEGORY_ID; continue; }
    if (!section || trimmed === '(none)') continue;

    if (section === 'categories') {
      categoryId(trimmed.replace(BULLET, '').replace(/^\[(.*)\]$/, '$1'));
      continue;
    }
    if (section === 'verses') {
      const ref = normRef(trimmed.replace(BULLET, ''));
      const v = VERSES.find((x) => normRef(x.ref) === ref);
      if (v && !favs.some((f) => f.verseId === v.id)) favs.push({ verseId: v.id, favorite: true, updatedAt: stamp });
      continue;
    }

    // A category heading: [Family]
    const cat = !indented && trimmed.match(/^\[(.+)\]$/);
    if (cat) { finish(); catId = categoryId(cat[1]); continue; }

    // A new entry: • Mom's surgery on Friday
    if (!indented && BULLET.test(trimmed)) {
      finish();
      let title = trimmed.replace(BULLET, '');
      const starred = /^★\s*/.test(title);
      title = title.replace(/^★\s*/, '');
      entry = {
        id: newId(),
        kind: section === 'thanks' ? Kind.THANKSGIVING : Kind.REQUEST,
        status: section === 'answered' ? Status.ANSWERED : (section === 'thanks' ? null : Status.ACTIVE),
        title,
        details: '',
        date: null,
        answeredOn: null,
        answerNote: '',
        starred,
        categoryId: catId,
        alsoThanked: false,
      };
      raw.push(entry);
      continue;
    }
    if (!entry) continue;

    // Details under an entry
    const f = trimmed.match(FIELD);
    if (f) {
      const label = f[1].toLowerCase();
      blankSince = false;
      if (label === 'added') { entry.date = readDate(f[2]); lastField = null; }
      else if (label === 'answered') { entry.answeredOn = readDate(f[2]); lastField = null; }
      else if (label === 'notes') { entry.details = f[2]; lastField = 'details'; }
      else { entry.answerNote = f[2]; lastField = 'answerNote'; }
      continue;
    }
    if (/^also in thanksgivings$/i.test(trimmed)) { entry.alsoThanked = true; lastField = null; continue; }
    if (lastField && indented) {
      // Another line of notes (a blank line between keeps its paragraph break).
      entry[lastField] += (blankSince ? '\n\n' : '\n') + trimmed;
      blankSince = false;
      continue;
    }
    if (!indented) {
      // A plain line someone typed under a category: treat it as a new entry.
      finish();
      const typed = {
        id: newId(), kind: section === 'thanks' ? Kind.THANKSGIVING : Kind.REQUEST,
        status: section === 'answered' ? Status.ANSWERED : (section === 'thanks' ? null : Status.ACTIVE),
        title: trimmed, details: '', date: null, answeredOn: null, answerNote: '', starred: false, categoryId: catId, alsoThanked: false,
      };
      raw.push(typed);
      entry = typed;
    }
  }

  // Fill in what wasn't written down, and connect each answered prayer with
  // its thanksgiving again.
  for (const e of raw) {
    e.date = e.date || e.answeredOn || fallbackDate;
    if (e.status === Status.ANSWERED) e.answeredOn = e.answeredOn || e.date;
    e.createdAt = parseLocalDate(e.date).toISOString();
    e.updatedAt = stamp;
  }
  const takenThanks = new Set();
  for (const req of raw.filter((e) => e.alsoThanked)) {
    const same = (t) => t.kind === Kind.THANKSGIVING && !takenThanks.has(t.id) && t.title.toLowerCase() === req.title.toLowerCase();
    const t = raw.find((x) => same(x) && x.date === req.answeredOn) || raw.find(same);
    if (t) { takenThanks.add(t.id); req.linkedEntryId = t.id; t.linkedEntryId = req.id; }
  }

  const entries = raw.map((e) => normalizeEntry(e, ownerId)).filter(Boolean);
  const categories = [...cats.values()].map((c) => normalizeCategory(c, ownerId)).filter(Boolean);
  return { exportedAt, entries, categories, verseFavorites: favs, invalid: 0, source: 'text' };
}

// ---------- Reading an older JSON backup ----------
// Format: { format: "intreaty-backup", version, appVersion, exportedAt,
//           data: { entries, categories, verseFavorites } }

// Upgrades older JSON backup versions to the current one. There is only
// version 1; JSON is no longer written, so this should never need to grow.
function migrate(obj) {
  return obj;
}

function parseJsonBackup(text, ownerId) {
  let obj;
  try {
    obj = JSON.parse(text);
  } catch {
    throw new BackupError("This file couldn't be read. Make sure it's an Intreaty backup.");
  }
  if (!obj || obj.format !== BACKUP_FORMAT) {
    throw new BackupError("This doesn't look like an Intreaty backup file.");
  }
  if (typeof obj.version !== 'number' || obj.version > BACKUP_VERSION) {
    throw new BackupError('This backup was made by a newer version of Intreaty. Update the app and try again.');
  }
  obj = migrate(obj);
  const rawEntries = Array.isArray(obj.data?.entries) ? obj.data.entries : [];
  const rawCategories = Array.isArray(obj.data?.categories) ? obj.data.categories : [];
  const entries = rawEntries.map((e) => normalizeEntry(e, ownerId)).filter(Boolean);
  const categories = rawCategories.map((c) => normalizeCategory(c, ownerId)).filter(Boolean);
  // Favorite verses were added in app version 1.2.0; older backups have none.
  const rawFavs = Array.isArray(obj.data?.verseFavorites) ? obj.data.verseFavorites : [];
  const verseFavorites = rawFavs
    .filter((f) => f && typeof f.verseId === 'string' && f.verseId.length <= 40 && typeof f.updatedAt === 'string')
    .map((f) => ({ verseId: f.verseId, favorite: f.favorite === true, updatedAt: f.updatedAt }));
  return {
    exportedAt: typeof obj.exportedAt === 'string' ? obj.exportedAt : null,
    entries,
    categories,
    verseFavorites,
    invalid: rawEntries.length - entries.length + (rawCategories.length - categories.length),
    source: 'json',
  };
}
