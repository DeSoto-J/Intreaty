# Intreaty

A simple, private prayer list that installs to your phone's home screen.

- Keep **Prayer Requests** and **Thanksgivings** in one place
- Sort entries into categories (Family, Health, Church, Friends, Work, Other, or your own)
- **Star** important entries and sort them to the top with **Starred first**
- Mark a request **answered**, write down how, and add it to Thanksgivings
- Works offline, has light and dark mode, and saves everything on your device
- Save and restore a backup file

Your prayers never leave your phone. This repository holds only the app's code.

## Using it on your phone

Open the app's web address (for example `https://YOUR-USERNAME.github.io/Intreaty/`), then:

- **iPhone (Safari):** tap **Share**, then **Add to Home Screen**.
- **Android (Chrome):** tap **⋮**, then **Install app**.

Installing matters on iPhone. If you only use Intreaty in a Safari tab, iOS can clear its data after a few weeks of not using it. Home screen apps are protected. Save a backup now and then either way (Settings → Save a backup).

## How the code is organised

No build tools are needed. These are plain files that any web host can serve.

```
index.html              the page
css/styles.css          all the styling and the light/dark colours
manifest.webmanifest    app name, icon and colours for installing
sw.js                   service worker: offline support and updates
icons/                  app icons
js/
  app.js                starts the app and connects everything
  version.js            the version number
  pwa.js                install prompts, updates, storage protection
  data/
    models.js           what an entry and a category look like
    repository.js       the rules (add, edit, answer, delete, import…)
    backup.js           reading and writing backup files
  storage/
    local-adapter.js    saving on this device (IndexedDB)
  ui/                   the screens and slide-up panels
```

See [ARCHITECTURE.md](ARCHITECTURE.md) for how accounts, cloud sync, sharing, reminders and "Pray for Today" fit in later.

## Trying it on your computer

Service workers only run from a web server, not from a double-clicked file. Any small static server works, for example:

```bash
npx serve .
```

## Publishing a change

1. Make your change.
2. Raise the version number in **both** `js/version.js` and the top of `sw.js` (for example `1.0.0` → `1.0.1`). This tells installed phones that an update exists.
3. Commit and push. GitHub Pages updates within a minute or two. The app then shows "A new version of Intreaty is ready → Refresh".
