// models.js — the shape of every piece of data Intreaty stores.
//
// Each record carries fields that version 1 barely uses (ownerId, visibility,
// sharedWith, updatedAt, deletedAt). They are here on purpose: user accounts,
// cloud sync and sharing will rely on them, and having them from day one means
// no data migration is needed when those features arrive.

export const SCHEMA_VERSION = 1;

// Until accounts exist, everything belongs to this one local owner.
export const LOCAL_OWNER_ID = 'local';

export const Kind = Object.freeze({ REQUEST: 'request', THANKSGIVING: 'thanksgiving' });
export const Status = Object.freeze({ ACTIVE: 'active', ANSWERED: 'answered' });
// 'shared' is reserved for the future sharing feature. Everything is private for now.
export const Visibility = Object.freeze({ PRIVATE: 'private', SHARED: 'shared' });

// Built-in categories use fixed ids so the same category on two devices (or in
// a backup) is recognised as the same thing.
export const BUILT_IN_CATEGORIES = Object.freeze([
  { id: 'family', name: 'Family' },
  { id: 'health', name: 'Health' },
  { id: 'church', name: 'Church' },
  { id: 'friends', name: 'Friends' },
  { id: 'work', name: 'Work' },
  { id: 'other', name: 'Other' },
]);
export const FALLBACK_CATEGORY_ID = 'other';

export const LIMITS = Object.freeze({ title: 200, details: 5000, note: 5000, category: 40 });

const EPOCH = '1970-01-01T00:00:00.000Z';
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function newId() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

export const nowISO = () => new Date().toISOString();

// Dates the user picks ("the day I prayed this") are stored as plain
// YYYY-MM-DD strings in local time, so they never shift across time zones.
export function toLocalDateString(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
export const todayLocal = () => toLocalDateString(new Date());

export function parseLocalDate(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function isDateString(s) {
  if (typeof s !== 'string' || !DATE_RE.test(s)) return false;
  const d = parseLocalDate(s);
  return !Number.isNaN(d.getTime()) && toLocalDateString(d) === s;
}

const isTimestamp = (s) => typeof s === 'string' && !Number.isNaN(Date.parse(s));

export function cleanText(value, max) {
  return String(value ?? '').replace(/\r\n/g, '\n').trim().slice(0, max);
}

export function createEntry(fields, ownerId = LOCAL_OWNER_ID) {
  const ts = nowISO();
  const kind = fields.kind === Kind.THANKSGIVING ? Kind.THANKSGIVING : Kind.REQUEST;
  return {
    id: newId(),
    schemaVersion: SCHEMA_VERSION,
    ownerId,
    kind,
    title: cleanText(fields.title, LIMITS.title),
    details: cleanText(fields.details, LIMITS.details),
    date: isDateString(fields.date) ? fields.date : todayLocal(),
    categoryId: fields.categoryId || FALLBACK_CATEGORY_ID,
    status: kind === Kind.REQUEST ? Status.ACTIVE : null,
    answeredOn: null,
    answerNote: '',
    // Links an answered request and the thanksgiving made from it (both ways).
    linkedEntryId: fields.linkedEntryId ?? null,
    // Future sharing: private by default, shared per entry later.
    visibility: Visibility.PRIVATE,
    sharedWith: [],
    createdAt: ts,
    updatedAt: ts,
    // Deleting only marks a record. That makes "Undo" easy now and keeps
    // deletes in step across devices once cloud sync exists.
    deletedAt: null,
  };
}

export function createCategory(name, ownerId = LOCAL_OWNER_ID) {
  const ts = nowISO();
  return {
    id: newId(),
    schemaVersion: SCHEMA_VERSION,
    ownerId,
    name: cleanText(name, LIMITS.category),
    builtIn: false,
    createdAt: ts,
    updatedAt: ts,
    deletedAt: null,
  };
}

export function builtInCategoryRecords(ownerId = LOCAL_OWNER_ID) {
  return BUILT_IN_CATEGORIES.map((c) => ({
    id: c.id,
    schemaVersion: SCHEMA_VERSION,
    ownerId,
    name: c.name,
    builtIn: true,
    createdAt: EPOCH,
    updatedAt: EPOCH,
    deletedAt: null,
  }));
}

// Checks a record read from a backup file and returns a clean copy, or null
// if it is unusable. Anything unexpected is dropped rather than trusted.
export function normalizeEntry(raw, ownerId = LOCAL_OWNER_ID) {
  if (!raw || typeof raw !== 'object') return null;
  if (typeof raw.id !== 'string' || !raw.id || raw.id.length > 100) return null;
  const title = cleanText(raw.title, LIMITS.title);
  if (!title) return null;
  const kind = raw.kind === Kind.THANKSGIVING ? Kind.THANKSGIVING : Kind.REQUEST;
  const answered = kind === Kind.REQUEST && raw.status === Status.ANSWERED;
  const createdAt = isTimestamp(raw.createdAt) ? raw.createdAt : nowISO();
  return {
    id: raw.id,
    schemaVersion: SCHEMA_VERSION,
    ownerId,
    kind,
    title,
    details: cleanText(raw.details, LIMITS.details),
    date: isDateString(raw.date) ? raw.date : todayLocal(),
    categoryId: typeof raw.categoryId === 'string' && raw.categoryId ? raw.categoryId : FALLBACK_CATEGORY_ID,
    status: kind === Kind.REQUEST ? (answered ? Status.ANSWERED : Status.ACTIVE) : null,
    answeredOn: answered ? (isDateString(raw.answeredOn) ? raw.answeredOn : todayLocal()) : null,
    answerNote: answered ? cleanText(raw.answerNote, LIMITS.note) : '',
    linkedEntryId: typeof raw.linkedEntryId === 'string' ? raw.linkedEntryId : null,
    visibility: Visibility.PRIVATE,
    sharedWith: [],
    createdAt,
    updatedAt: isTimestamp(raw.updatedAt) ? raw.updatedAt : createdAt,
    deletedAt: isTimestamp(raw.deletedAt) ? raw.deletedAt : null,
  };
}

export function normalizeCategory(raw, ownerId = LOCAL_OWNER_ID) {
  if (!raw || typeof raw !== 'object') return null;
  if (typeof raw.id !== 'string' || !raw.id || raw.id.length > 100) return null;
  const builtIn = BUILT_IN_CATEGORIES.find((c) => c.id === raw.id);
  const name = builtIn ? builtIn.name : cleanText(raw.name, LIMITS.category);
  if (!name) return null;
  const createdAt = isTimestamp(raw.createdAt) ? raw.createdAt : nowISO();
  return {
    id: raw.id,
    schemaVersion: SCHEMA_VERSION,
    ownerId,
    name,
    builtIn: Boolean(builtIn),
    createdAt: builtIn ? EPOCH : createdAt,
    updatedAt: builtIn ? EPOCH : isTimestamp(raw.updatedAt) ? raw.updatedAt : createdAt,
    deletedAt: builtIn ? null : isTimestamp(raw.deletedAt) ? raw.deletedAt : null,
  };
}
