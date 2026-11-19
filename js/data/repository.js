// repository.js — the one place where Intreaty's rules live.
//
// The screens never touch storage directly. They ask the Repository
// ("add this request", "mark that one answered"), and the Repository updates
// its in-memory copy, saves through whichever storage adapter it was given,
// and tells the screens to redraw.
//
// When accounts arrive, a Repository is created per signed-in user (ownerId)
// with a cloud adapter. Nothing in the screens has to change.

import {
  Kind, Status, LOCAL_OWNER_ID, FALLBACK_CATEGORY_ID, BUILT_IN_CATEGORIES, LIMITS,
  createEntry, createCategory, builtInCategoryRecords, cleanText, isDateString, nowISO, todayLocal,
} from './models.js';
import { buildBackup } from './backup.js';

// Favorite verses are a short list, so they're kept in the "meta" store.
// With accounts they would become their own table, like entries.
const VERSE_FAVORITES_KEY = 'verseFavorites';

const BUILT_IN_ORDER = BUILT_IN_CATEGORIES.map((c) => c.id);
const sameName = (a, b) => a.trim().toLocaleLowerCase() === b.trim().toLocaleLowerCase();

export class Repository {
  constructor(adapter, { ownerId = LOCAL_OWNER_ID, appVersion = '' } = {}) {
    this.adapter = adapter;
    this.ownerId = ownerId;
    this.appVersion = appVersion;
    this.entries = new Map();
    this.categories = new Map();
    this.verseFavorites = new Map(); // verseId -> { verseId, favorite, updatedAt }
    this.listeners = new Set();
  }

  async init() {
    await this.adapter.open();
    await this._load();
  }

  async _load() {
    const [entries, categories] = await Promise.all([
      this.adapter.getAll('entries', this.ownerId),
      this.adapter.getAll('categories', this.ownerId),
    ]);
    this.entries = new Map(entries.map((e) => [e.id, e]));
    this.categories = new Map(categories.map((c) => [c.id, c]));
    const favs = (await this.adapter.getMeta(VERSE_FAVORITES_KEY)) || [];
    this.verseFavorites = new Map(favs.map((f) => [f.verseId, f]));
    const missing = builtInCategoryRecords(this.ownerId).filter((c) => !this.categories.has(c.id));
    if (missing.length) await this._put('categories', missing);
  }

  subscribe(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  _emit() {
    for (const fn of this.listeners) fn();
  }

  async _put(store, records) {
    await this.adapter.putMany(store, records);
    const map = store === 'entries' ? this.entries : this.categories;
    for (const r of records) map.set(r.id, r);
  }

  // ---------- Reading ----------

  getEntry(id) {
    const e = this.entries.get(id);
    return e && !e.deletedAt ? e : null;
  }

  listEntries({ kind, status, categoryId } = {}) {
    const list = [...this.entries.values()].filter((e) =>
      !e.deletedAt &&
      (!kind || e.kind === kind) &&
      (!status || e.status === status) &&
      (!categoryId || e.categoryId === categoryId));
    const key = (e) => (e.status === Status.ANSWERED ? e.answeredOn : e.date);
    return list.sort((a, b) => key(b).localeCompare(key(a)) || b.createdAt.localeCompare(a.createdAt));
  }

  listCategories() {
    const list = [...this.categories.values()].filter((c) => !c.deletedAt);
    const rank = (c) => {
      if (c.id === FALLBACK_CATEGORY_ID) return 2; // "Other" always last
      return c.builtIn ? 0 : 1;
    };
    return list.sort((a, b) =>
      rank(a) - rank(b) ||
      (a.builtIn && b.builtIn ? BUILT_IN_ORDER.indexOf(a.id) - BUILT_IN_ORDER.indexOf(b.id) : a.name.localeCompare(b.name)));
  }

  getCategory(id) {
    const c = this.categories.get(id);
    return c && !c.deletedAt ? c : this.categories.get(FALLBACK_CATEGORY_ID);
  }

  // ---------- Entries ----------

  _validCategory(id) {
    const c = this.categories.get(id);
    return c && !c.deletedAt ? id : FALLBACK_CATEGORY_ID;
  }

  async addEntry(fields) {
    if (!cleanText(fields.title, LIMITS.title)) throw new Error('Please add a title.');
    const entry = createEntry({ ...fields, categoryId: this._validCategory(fields.categoryId) }, this.ownerId);
    await this._put('entries', [entry]);
    this._emit();
    return entry;
  }

  // Adds many entries at once (from a pasted list), saved and redrawn in one go.
  async addEntries(list) {
    const entries = list
      .filter((fields) => cleanText(fields.title, LIMITS.title))
      .map((fields) => createEntry({ ...fields, categoryId: this._validCategory(fields.categoryId) }, this.ownerId));
    if (!entries.length) throw new Error('There’s nothing to add.');
    await this._put('entries', entries);
    this._emit();
    return entries;
  }

  // Undo for addEntries.
  async deleteEntries(ids) {
    const ts = nowISO();
    const records = ids.map((id) => this.getEntry(id)).filter(Boolean)
      .map((e) => ({ ...e, deletedAt: ts, updatedAt: ts }));
    if (!records.length) return;
    await this._put('entries', records);
    this._emit();
  }

  async updateEntry(id, changes) {
    const cur = this.getEntry(id);
    if (!cur) throw new Error('That entry no longer exists.');
    const next = { ...cur };
    if ('title' in changes) {
      next.title = cleanText(changes.title, LIMITS.title);
      if (!next.title) throw new Error('Please add a title.');
    }
    if ('details' in changes) next.details = cleanText(changes.details, LIMITS.details);
    if ('date' in changes && isDateString(changes.date)) next.date = changes.date;
    if ('categoryId' in changes) next.categoryId = this._validCategory(changes.categoryId);
    if (cur.status === Status.ANSWERED) {
      if ('answeredOn' in changes && isDateString(changes.answeredOn)) next.answeredOn = changes.answeredOn;
      if ('answerNote' in changes) next.answerNote = cleanText(changes.answerNote, LIMITS.note);
    }
    next.updatedAt = nowISO();
    await this._put('entries', [next]);
    this._emit();
    return next;
  }

  async toggleStar(id) {
    const cur = this.getEntry(id);
    if (!cur) return null;
    const next = { ...cur, starred: !cur.starred, updatedAt: nowISO() };
    await this._put('entries', [next]);
    this._emit();
    return next;
  }

  async deleteEntry(id) {
    const cur = this.getEntry(id);
    if (!cur) return;
    const ts = nowISO();
    await this._put('entries', [{ ...cur, deletedAt: ts, updatedAt: ts }]);
    this._emit();
  }

  async restoreEntry(id) {
    const cur = this.entries.get(id);
    if (!cur || !cur.deletedAt) return;
    await this._put('entries', [{ ...cur, deletedAt: null, updatedAt: nowISO() }]);
    this._emit();
  }

  _thanksgivingFrom(request, note, date) {
    return createEntry({
      kind: Kind.THANKSGIVING,
      title: request.title,
      details: note || request.details,
      date,
      categoryId: request.categoryId,
      linkedEntryId: request.id,
    }, this.ownerId);
  }

  hasLinkedThanksgiving(request) {
    return Boolean(request.linkedEntryId && this.getEntry(request.linkedEntryId));
  }

  async markAnswered(id, { answeredOn, answerNote, addThanksgiving } = {}) {
    const cur = this.getEntry(id);
    if (!cur || cur.kind !== Kind.REQUEST) throw new Error('Only prayer requests can be marked answered.');
    const on = isDateString(answeredOn) ? answeredOn : todayLocal();
    const note = cleanText(answerNote, LIMITS.note);
    const request = { ...cur, status: Status.ANSWERED, answeredOn: on, answerNote: note, updatedAt: nowISO() };
    const records = [request];
    let thanksgiving = null;
    if (addThanksgiving && !this.hasLinkedThanksgiving(cur)) {
      thanksgiving = this._thanksgivingFrom(request, note, on);
      request.linkedEntryId = thanksgiving.id;
      records.push(thanksgiving);
    }
    await this._put('entries', records);
    this._emit();
    return { request, thanksgiving };
  }

  async addThanksgivingFor(id) {
    const cur = this.getEntry(id);
    if (!cur || cur.status !== Status.ANSWERED) throw new Error('Mark the request answered first.');
    if (this.hasLinkedThanksgiving(cur)) return this.getEntry(cur.linkedEntryId);
    const thanksgiving = this._thanksgivingFrom(cur, cur.answerNote, cur.answeredOn);
    await this._put('entries', [{ ...cur, linkedEntryId: thanksgiving.id, updatedAt: nowISO() }, thanksgiving]);
    this._emit();
    return thanksgiving;
  }

  async reopen(id) {
    const cur = this.getEntry(id);
    if (!cur || cur.status !== Status.ANSWERED) return;
    await this._put('entries', [{ ...cur, status: Status.ACTIVE, answeredOn: null, answerNote: '', updatedAt: nowISO() }]);
    this._emit();
  }

  // ---------- Categories ----------

  async addCategory(name) {
    const clean = cleanText(name, LIMITS.category);
    if (!clean) throw new Error('Please type a category name.');
    const existing = this.listCategories().find((c) => sameName(c.name, clean));
    if (existing) return existing;
    const cat = createCategory(clean, this.ownerId);
    await this._put('categories', [cat]);
    this._emit();
    return cat;
  }

  async renameCategory(id, name) {
    const cur = this.categories.get(id);
    if (!cur || cur.deletedAt || cur.builtIn) throw new Error("Built-in categories can't be renamed.");
    const clean = cleanText(name, LIMITS.category);
    if (!clean) throw new Error('Please type a category name.');
    if (this.listCategories().some((c) => c.id !== id && sameName(c.name, clean))) {
      throw new Error('You already have a category with that name.');
    }
    await this._put('categories', [{ ...cur, name: clean, updatedAt: nowISO() }]);
    this._emit();
  }

  countInCategory(id) {
    return [...this.entries.values()].filter((e) => !e.deletedAt && e.categoryId === id).length;
  }

  // Entries in a removed category move to "Other".
  async deleteCategory(id) {
    const cur = this.categories.get(id);
    if (!cur || cur.deletedAt || cur.builtIn) throw new Error("Built-in categories can't be removed.");
    const ts = nowISO();
    const moved = [...this.entries.values()]
      .filter((e) => e.categoryId === id)
      .map((e) => ({ ...e, categoryId: FALLBACK_CATEGORY_ID, updatedAt: ts }));
    if (moved.length) await this._put('entries', moved);
    await this._put('categories', [{ ...cur, deletedAt: ts, updatedAt: ts }]);
    this._emit();
  }

  // ---------- Favorite verses ----------
  // Un-hearting keeps a record ({ favorite: false }) instead of erasing it,
  // so merging an older backup can't bring a removed favorite back.

  isFavoriteVerse(verseId) {
    return this.verseFavorites.get(verseId)?.favorite === true;
  }

  favoriteVerseIds() {
    return [...this.verseFavorites.values()].filter((f) => f.favorite).map((f) => f.verseId);
  }

  async toggleFavoriteVerse(verseId) {
    const favorite = !this.isFavoriteVerse(verseId);
    this.verseFavorites.set(verseId, { verseId, favorite, updatedAt: nowISO() });
    await this._saveVerseFavorites();
    this._emit();
    return favorite;
  }

  async _saveVerseFavorites() {
    await this.adapter.setMeta(VERSE_FAVORITES_KEY, [...this.verseFavorites.values()]);
  }

  // ---------- Backup ----------

  exportBackup() {
    // Deleted records are included (marked deleted) so that merging this
    // backup elsewhere keeps deletions deleted.
    return buildBackup({
      entries: [...this.entries.values()],
      categories: [...this.categories.values()],
      verseFavorites: [...this.verseFavorites.values()],
      appVersion: this.appVersion,
    });
  }

  summarize(parsed) {
    const live = parsed.entries.filter((e) => !e.deletedAt);
    return {
      requests: live.filter((e) => e.kind === Kind.REQUEST).length,
      thanksgivings: live.filter((e) => e.kind === Kind.THANKSGIVING).length,
    };
  }

  // mode 'merge': keeps everything here and adds what's new from the file.
  //   When the same entry exists in both, the most recently edited copy wins.
  // mode 'replace': this device ends up exactly like the backup.
  async importBackup(parsed, mode = 'merge') {
    if (mode === 'replace') {
      await this.adapter.replaceAll('categories', this.ownerId, parsed.categories);
      await this.adapter.replaceAll('entries', this.ownerId, parsed.entries);
      await this.adapter.setMeta(VERSE_FAVORITES_KEY, parsed.verseFavorites);
      await this._load();
      await this._fixOrphans();
      this._emit();
      const s = this.summarize(parsed);
      return { added: s.requests + s.thanksgivings, updated: 0, unchanged: 0 };
    }

    // Categories first. A custom category with the same name as one here
    // (made separately on two devices) is treated as the same category.
    const idMap = new Map();
    const catWrites = [];
    for (const inc of parsed.categories) {
      const local = this.categories.get(inc.id);
      if (local) {
        if (!local.builtIn && inc.updatedAt > local.updatedAt) catWrites.push(inc);
        continue;
      }
      const twin = !inc.deletedAt && this.listCategories().find((c) => sameName(c.name, inc.name));
      if (twin) idMap.set(inc.id, twin.id);
      else catWrites.push(inc);
    }
    if (catWrites.length) await this._put('categories', catWrites);

    let added = 0, updated = 0, unchanged = 0;
    const entryWrites = [];
    for (const raw of parsed.entries) {
      const inc = idMap.has(raw.categoryId) ? { ...raw, categoryId: idMap.get(raw.categoryId) } : raw;
      const local = this.entries.get(inc.id);
      if (!local) {
        entryWrites.push(inc);
        if (!inc.deletedAt) added++;
      } else if (inc.updatedAt > local.updatedAt) {
        entryWrites.push(inc);
        updated++;
      } else {
        unchanged++;
      }
    }
    if (entryWrites.length) await this._put('entries', entryWrites);

    // Favorite verses: the most recent heart or un-heart wins.
    let favsChanged = false;
    for (const inc of parsed.verseFavorites) {
      const local = this.verseFavorites.get(inc.verseId);
      if (!local || inc.updatedAt > local.updatedAt) {
        this.verseFavorites.set(inc.verseId, inc);
        favsChanged = true;
      }
    }
    if (favsChanged) await this._saveVerseFavorites();

    await this._fixOrphans();
    this._emit();
    return { added, updated, unchanged };
  }

  // Any entry pointing at a category that doesn't exist goes to "Other".
  async _fixOrphans() {
    const ts = nowISO();
    const fixes = [...this.entries.values()]
      .filter((e) => { const c = this.categories.get(e.categoryId); return !c || c.deletedAt; })
      .map((e) => ({ ...e, categoryId: FALLBACK_CATEGORY_ID, updatedAt: ts }));
    if (fixes.length) await this._put('entries', fixes);
  }

  async getMeta(key) { return this.adapter.getMeta(key); }
  async setMeta(key, value) { return this.adapter.setMeta(key, value); }
}
