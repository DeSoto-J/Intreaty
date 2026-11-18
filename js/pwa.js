// pwa.js — the "installable app" pieces: offline support, install prompts,
// app updates and asking the browser to keep our data safe.

let deferredInstall = null;
const installListeners = new Set();

export const isStandalone = () =>
  matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

export const isIOS = () =>
  /iphone|ipad|ipod/i.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

export const canPromptInstall = () => Boolean(deferredInstall);

export function onInstallChange(fn) {
  installListeners.add(fn);
}

export async function promptInstall() {
  if (!deferredInstall) return false;
  deferredInstall.prompt();
  const { outcome } = await deferredInstall.userChoice;
  deferredInstall = null;
  installListeners.forEach((fn) => fn());
  return outcome === 'accepted';
}

// Android / desktop Chrome tell us when the app can be installed.
addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredInstall = e;
  installListeners.forEach((fn) => fn());
});
addEventListener('appinstalled', () => {
  deferredInstall = null;
  installListeners.forEach((fn) => fn());
});

// The service worker (sw.js) keeps a copy of the app on the phone so it opens
// offline. When a new version is published, we offer a "Refresh" button.
export function registerServiceWorker({ onUpdateReady } = {}) {
  if (!('serviceWorker' in navigator)) return;
  let reloading = false;
  // On the very first visit there's no old version to replace, so don't reload.
  const hadController = Boolean(navigator.serviceWorker.controller);
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloading || !hadController) return;
    reloading = true;
    location.reload();
  });
  navigator.serviceWorker.register('./sw.js').then((reg) => {
    const offer = () => onUpdateReady?.(() => reg.waiting?.postMessage('skipWaiting'));
    if (reg.waiting && navigator.serviceWorker.controller) offer();
    reg.addEventListener('updatefound', () => {
      const worker = reg.installing;
      worker?.addEventListener('statechange', () => {
        if (worker.state === 'installed' && navigator.serviceWorker.controller) offer();
      });
    });
    // Check for a new version whenever the app is brought back to the front.
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') reg.update().catch(() => {});
    });
  }).catch((err) => console.warn('Offline support unavailable:', err));
}

// Asks the browser not to clear our saved data when space runs low.
export async function requestPersistence() {
  try {
    if (!navigator.storage?.persist) return null;
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch {
    return null;
  }
}

export async function isPersisted() {
  try {
    return navigator.storage?.persisted ? await navigator.storage.persisted() : null;
  } catch {
    return null;
  }
}
