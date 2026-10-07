// Abschalter für den alten Service Worker unter /neu/ (Übergangsphase neues Design).
// Geräte, die /neu installiert hatten, holen beim nächsten Update-Check diese Datei: Sie meldet
// den Worker ab und schickt offene Fenster auf dieselbe Seite der Haupt-App unter "/".
// Die Daten der Offline-Schicht (IndexedDB) gehören zur ganzen Adresse und bleiben erhalten.
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    await self.registration.unregister()
    const fenster = await self.clients.matchAll({ type: 'window' })
    for (const f of fenster) {
      try { await f.navigate(f.url.replace('/neu/', '/')) } catch { /* Fenster schon weg */ }
    }
  })())
})
