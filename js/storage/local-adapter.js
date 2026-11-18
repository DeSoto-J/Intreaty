// local-adapter.js — saves data in the browser's built-in database (IndexedDB)
// on this device.
//
// THE STORAGE CONTRACT
// Every storage adapter (this one now, a cloud one later) provides the same
// small set of async methods, so the rest of the app never knows or cares
// where data actually lives:
//
//   open()                          -> get ready to read and write
//   getAll(store, ownerId)          -> every record in a store for one owner
//   putMany(store, records)         -> insert or overwrite records by id
//   replaceAll(store, ownerId, recs)-> swap one owner's records for these
//   getMeta(key) / setMeta(key, v)  -> small settings like "last backup date"
//
// Stores: 'entries' and 'categories'.
// A future CloudAdapter (for example Supabase or Firebase) implements the same
// methods, and Repository gets handed that one instead.

const DB_NAME = 'intreaty';
const DB_VERSION = 1;

export class LocalAdapter {
  constructor(dbName = DB_NAME) {
    this.dbName = dbName;
    this.db = null;
  }

  async open() {
    if (this.db) return this;
    if (!('indexedDB' in globalThis)) {
      throw new Error('This browser cannot save data on the device.');
    }
    this.db = await new Promise((resolve, reject) => {
      const req = indexedDB.open(this.dbName, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        for (const name of ['entries', 'categories']) {
          if (!db.objectStoreNames.contains(name)) {
            const store = db.createObjectStore(name, { keyPath: 'id' });
            store.createIndex('ownerId', 'ownerId');
          }
        }
        if (!db.objectStoreNames.contains('meta')) {
          db.createObjectStore('meta', { keyPath: 'key' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
      req.onblocked = () => reject(new Error('Close other Intreaty tabs and try again.'));
    });
    // If a newer version of the app opens the database in another tab, step aside.
    this.db.onversionchange = () => this.db.close();
    return this;
  }

  _run(storeNames, mode, work) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeNames, mode);
      let result;
      tx.oncomplete = () => resolve(result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error('Saving was interrupted.'));
      const req = work(tx);
      if (req && 'onsuccess' in req) req.onsuccess = () => { result = req.result; };
    });
  }

  getAll(store, ownerId) {
    return this._run([store], 'readonly', (tx) => tx.objectStore(store).index('ownerId').getAll(ownerId));
  }

  putMany(store, records) {
    return this._run([store], 'readwrite', (tx) => {
      const os = tx.objectStore(store);
      for (const r of records) os.put(r);
    });
  }

  replaceAll(store, ownerId, records) {
    return this._run([store], 'readwrite', (tx) => {
      const os = tx.objectStore(store);
      const cursorReq = os.index('ownerId').openKeyCursor(IDBKeyRange.only(ownerId));
      cursorReq.onsuccess = () => {
        const cursor = cursorReq.result;
        if (cursor) {
          os.delete(cursor.primaryKey);
          cursor.continue();
        } else {
          for (const r of records) os.put(r);
        }
      };
    });
  }

  getMeta(key) {
    return this._run(['meta'], 'readonly', (tx) => tx.objectStore('meta').get(key)).then((row) => row?.value);
  }

  setMeta(key, value) {
    return this._run(['meta'], 'readwrite', (tx) => { tx.objectStore('meta').put({ key, value }); });
  }
}
