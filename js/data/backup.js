// backup.js — reading and writing the backup file.
//
// A backup is one JSON file. It carries a format name and a version number so
// that future versions of Intreaty can still read today's backups (and can
// upgrade them, step by step, in migrate() below).

import { normalizeCategory, normalizeEntry, todayLocal, nowISO } from './models.js';

export const BACKUP_FORMAT = 'intreaty-backup';
export const BACKUP_VERSION = 1;

export class BackupError extends Error {}

export function buildBackup({ entries, categories, appVersion }) {
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    appVersion,
    exportedAt: nowISO(),
    data: { entries, categories },
  };
}

export function backupFileName(date = todayLocal()) {
  return `intreaty-backup-${date}.json`;
}

// Upgrades older backup versions to the current one. There is only version 1
// so far; when version 2 exists, add: if (obj.version === 1) { ...; obj.version = 2; }
function migrate(obj) {
  return obj;
}

export function parseBackup(text, ownerId) {
  let obj;
  try {
    obj = JSON.parse(text);
  } catch {
    throw new BackupError("This file couldn't be read. Make sure it's an Intreaty backup (.json).");
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
  return {
    exportedAt: typeof obj.exportedAt === 'string' ? obj.exportedAt : null,
    entries,
    categories,
    invalid: rawEntries.length - entries.length + (rawCategories.length - categories.length),
  };
}
