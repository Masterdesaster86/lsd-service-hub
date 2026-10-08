// Service Worker: hält die App selbst auf dem Gerät, damit sie auch ohne Netz startet.
// Die Daten (Aufträge, Berichte …) speichert nicht dieser Worker, sondern die
// Offline-Schicht der App (src/lib/offline.ts) in IndexedDB.
//
// Version kommt aus der Adresse (sw.js?v=…): Jeder Build registriert eine neue
// Adresse, damit holt sich der Browser automatisch die neue Fassung.

const VERSION = new URL(self.location.href).searchParams.get('v') || 'dev'
const APP_CACHE = `lsd-app-${VERSION}`
const BILD_CACHE = 'lsd-bilder'
const BASIS = new URL(self.registration.scope).pathname // "/" oder "/neu/"

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(APP_CACHE)
    await cache.add(new Request(BASIS, { cache: 'reload' }))
    try {
      const liste = await (await fetch(`${BASIS}precache.json`, { cache: 'reload' })).json()
      // Einzeln, damit eine fehlende Datei nicht alles abbricht.
      await Promise.all(liste.map(async (p) => {
        try {
          const req = new Request(BASIS + p, { cache: 'reload' })
          const res = await fetch(req)
          if (res.ok && !istSeite(res)) await cache.put(req, res)
        } catch { /* fehlt noch, wird beim Benutzen nachgeladen */ }
      }))
    } catch { /* ohne Liste wird beim Benutzen nachgeladen */ }
    await self.skipWaiting()
  })())
})

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const namen = await caches.keys()
    await Promise.all(namen.filter((n) => n.startsWith('lsd-app-') && n !== APP_CACHE).map((n) => caches.delete(n)))
    await self.clients.claim()
  })())
})

// Während die Auslieferung läuft, liefert der Server für eine noch fehlende Datei die
// Startseite (SPA-Weiche in .htaccess). So eine Antwort darf nie als Skript oder Stil
// gespeichert werden, sonst startet die App bis zum Löschen der Website-Daten nicht mehr.
function istSeite(res) {
  return (res.headers.get('content-type') || '').toLowerCase().includes('text/html')
}
function erwartetSeite(req) {
  return req.mode === 'navigate' || req.destination === 'document' || req.destination === ''
}

function mitTimeout(promise, ms) {
  return Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms))])
}

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)

  // Seitenaufrufe: erst Netz (damit Updates sofort da sind), ohne Netz die gespeicherte App.
  if (req.mode === 'navigate' && url.origin === self.location.origin && url.pathname.startsWith(BASIS)) {
    event.respondWith((async () => {
      const cache = await caches.open(APP_CACHE)
      try {
        const res = await mitTimeout(fetch(req), 5000)
        if (res.ok) cache.put(BASIS, res.clone())
        return res
      } catch {
        return (await cache.match(BASIS, { ignoreVary: true })) || Response.error()
      }
    })())
    return
  }

  // Dateien der App (Skripte, Schriften, Skizzen, Symbole): erst Gerät, sonst Netz.
  if (url.origin === self.location.origin && url.pathname.startsWith(BASIS) && !url.pathname.endsWith('/sw.js')) {
    event.respondWith((async () => {
      const cache = await caches.open(APP_CACHE)
      const treffer = await cache.match(req, { ignoreSearch: true, ignoreVary: true })
      // Eine versehentlich gespeicherte Startseite statt der Datei: verwerfen und neu holen.
      const falsch = (res) => istSeite(res) && !erwartetSeite(req)
      if (treffer && !falsch(treffer)) return treffer
      if (treffer) await cache.delete(req, { ignoreSearch: true, ignoreVary: true })
      const res = await fetch(req)
      if (res.ok && !falsch(res)) cache.put(req, res.clone())
      return res
    })())
    return
  }

  // Öffentliche Bilder aus Supabase (Logo, PDF-Hintergrund, Unterschriften, Maschinenfotos):
  // aus dem Netz holen und merken, ohne Netz die gemerkte Fassung.
  if (url.pathname.includes('/storage/v1/object/public/')) {
    event.respondWith((async () => {
      const cache = await caches.open(BILD_CACHE)
      try {
        const res = await mitTimeout(fetch(req), 8000)
        // <img> von fremder Adresse liefert eine "undurchsichtige" Antwort — auch die merken.
        if (res.ok || res.type === 'opaque') cache.put(req, res.clone())
        return res
      } catch {
        return (await cache.match(req, { ignoreVary: true })) || Response.error()
      }
    })())
  }
})
