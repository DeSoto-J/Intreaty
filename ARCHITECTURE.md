# Intreaty architecture and roadmap

## The three layers

```
 Screens (js/ui)  ──asks──▶  Repository (js/data/repository.js)  ──saves via──▶  Storage adapter
                  ◀─redraw──                                                      (js/storage/*)
```

- **Screens** never read or write storage. They call Repository methods such as `addEntry`, `markAnswered` and `importBackup`, and redraw when the Repository says something changed.
- **Repository** holds the rules and an in-memory copy of one person's data (`ownerId`).
- **Storage adapters** all offer the same small set of methods (`open`, `getAll`, `putMany`, `replaceAll`, `getMeta`, `setMeta`). `LocalAdapter` uses IndexedDB on the device. Moving to the cloud means writing another adapter with the same methods.

## Data model (schema version 1)

Entry:

| field | meaning |
|---|---|
| `id` | random UUID, unique across devices and users |
| `ownerId` | who it belongs to (`"local"` until accounts exist) |
| `kind` | `"request"` or `"thanksgiving"` |
| `title`, `details` | text |
| `date` | `YYYY-MM-DD`, local calendar date |
| `categoryId` | built-ins use fixed ids (`family`, `health`, …); custom ones use UUIDs |
| `status` | `"active"` / `"answered"` (requests only) |
| `answeredOn`, `answerNote` | filled in when answered |
| `linkedEntryId` | connects an answered request and its thanksgiving, both ways |
| `starred` | `true` to flag an entry; "Starred first" sorts these to the top (added in 1.1.0; older backups read as `false`) |
| `visibility`, `sharedWith` | `"private"` and `[]` for now; reserved for sharing |
| `createdAt`, `updatedAt` | ISO timestamps; `updatedAt` decides which copy wins in a merge |
| `deletedAt` | set instead of erasing, so Undo works and deletes sync correctly |

Categories have the same `id` / `ownerId` / timestamp / `deletedAt` fields, plus `name` and `builtIn`.

Favorite verses (added in 1.2.0) are records of `{ verseId, favorite, updatedAt }`, kept in the `meta` store under `verseFavorites`. Un-hearting sets `favorite: false` instead of erasing, so merges work like entries (newest `updatedAt` wins). Verse ids live in `js/data/verses.js` and must never change. With accounts, these become a per-user table.

Backups are `{ format: "intreaty-backup", version, appVersion, exportedAt, data: { entries, categories, verseFavorites } }`. `verseFavorites` is optional, so older backups still load. Raising `version` requires a step in `migrate()` in `backup.js`.

## Planned features

### "Pray for Today"
The verse of the day (`verseForDay` in `verses.js`) can sit at the top of this screen. This needs no new data. Add a view that picks a few active requests per day. A simple approach is to rotate by the day number so each request comes up in turn, and to favour requests not shown recently. Store "last shown" dates with `setMeta`, or add an optional `lastPrayedAt` field to entries (an additive change, no migration needed).

### Daily reminder notifications
- Reminders that fire at a set time while the app is closed need **Web Push**, which needs a small server (or a hosted function) to send the push each day.
- iPhone supports Web Push only for apps **added to the home screen**, on iOS 16.4 or later.
- Plan: add a Settings toggle and time picker. On enabling, ask for notification permission, subscribe through the service worker (`pushManager.subscribe`), and send the subscription and chosen time to the backend. `sw.js` then gets a `push` handler that shows the notification and opens "Pray for Today" when tapped.
- This fits naturally once a backend exists for accounts.

### User accounts and cloud storage
- Pick a hosted backend with auth and a database. Supabase (Postgres plus row-level security) or Firebase (Firestore plus security rules) both fit.
- Write `CloudAdapter` with the same methods as `LocalAdapter`. Keep `LocalAdapter` as an offline cache and sync with `updatedAt` / `deletedAt` (last write wins), which the merge logic in `Repository.importBackup` already shows.
- On first sign-in, offer to upload the device's `"local"` data and re-own it to the new user id.
- Every person's data is separated by `ownerId`, and server rules make sure people can only read their own rows.

### Sharing
- Entries stay private by default. Sharing is chosen per entry: set `visibility: "shared"` and add people or groups to `sharedWith`.
- Server-side tables to add: `groups`, `group_members`, `entry_shares` (entry, user or group), and `prayed_marks` (entry, user, time) for "I prayed for this".
- Shared viewers read the owner's entry live, so they see updates such as "answered" automatically. Only the owner can edit it.
