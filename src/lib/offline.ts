// Offline-Modus: Eine Schicht direkt unter dem Supabase-Client (eigene fetch-Funktion).
//
// - Lesen (GET und rpc): mit Netz wie gewohnt, die Antwort wird zusätzlich auf dem Gerät
//   gespeichert (IndexedDB). Ohne Netz kommt die zuletzt gespeicherte Antwort.
// - Schreiben (insert/update/delete, Unterschrift hochladen): Ohne Netz landet der Auftrag
//   in einer Warteschlange auf dem Gerät und die App bekommt sofort "erfolgreich" zurück.
//   Sobald wieder Netz da ist, wird die Warteschlange der Reihe nach hochgeladen.
// - Was noch in der Warteschlange liegt, wird beim Lesen über die gespeicherten Antworten
//   gelegt, damit die App die eigenen Änderungen auch offline sofort zeigt.
//
// Neue Datensätze bekommen ihre ID schon auf dem Gerät, damit Folgedaten (Tage,
// Ersatzteile, Messprotokoll) offline darauf verweisen können und ein doppeltes
// Hochladen nicht zu doppelten Einträgen führt.

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string

const LESEN_TIMEOUT = 8000
const SCHREIBEN_TIMEOUT = 10000
const PROBE_INTERVALL = 15000
/** Gespeicherte Antworten älter als das werden beim Start weggeräumt. */
const MAX_ALTER_MS = 45 * 24 * 3600 * 1000

/** Tabellen, deren neue Datensätze eine UUID auf dem Gerät bekommen. */
const UUID_TABELLEN = new Set([
  'serviceberichte', 'servicebericht_tage', 'servicebericht_ersatzteile', 'messprotokolle', 'wartungsprotokolle',
  'machines', 'ansprechpartner', 'customers',
])

// --- IndexedDB ---------------------------------------------------------------

interface GespeicherteAntwort {
  key: string
  status: number
  contentType: string | null
  contentRange: string | null
  body: string
  zeit: number
}

/** FormData (z.B. Bild-Upload) in speicherbarer Form. */
interface FormEintraege { formdata: [string, string | Blob][] }

function istForm(b: unknown): b is FormEintraege {
  return !!b && typeof b === 'object' && Array.isArray((b as FormEintraege).formdata)
}

function alsSendeBody(b: WarteEintrag['body']): BodyInit | null {
  if (!istForm(b)) return b
  const fd = new FormData()
  b.formdata.forEach(([k, v]) => fd.append(k, v))
  return fd
}

export interface WarteEintrag {
  id?: number
  method: string
  url: string
  headers: Record<string, string>
  body: string | Blob | FormEintraege | null
  zeit: number
  /** Kurzbeschreibung für die Anzeige, z.B. "Servicebericht ändern". */
  titel: string
  fehler?: string
}

let dbPromise: Promise<IDBDatabase> | null = null
function db(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open('lsd-offline', 1)
      req.onupgradeneeded = () => {
        const d = req.result
        if (!d.objectStoreNames.contains('antworten')) d.createObjectStore('antworten', { keyPath: 'key' })
        if (!d.objectStoreNames.contains('warteschlange')) d.createObjectStore('warteschlange', { keyPath: 'id', autoIncrement: true })
      }
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
  }
  return dbPromise
}

function anfrage<T>(store: string, modus: IDBTransactionMode, f: (s: IDBObjectStore) => IDBRequest): Promise<T> {
  return db().then((d) => new Promise<T>((resolve, reject) => {
    const tx = d.transaction(store, modus)
    const req = f(tx.objectStore(store))
    tx.oncomplete = () => resolve(req.result as T)
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error)
  }))
}

const antwortLesen = (key: string) => anfrage<GespeicherteAntwort | undefined>('antworten', 'readonly', (s) => s.get(key))
const antwortSchreiben = (a: GespeicherteAntwort) => anfrage('antworten', 'readwrite', (s) => s.put(a))
const warteschlangeLesen = () => anfrage<WarteEintrag[]>('warteschlange', 'readonly', (s) => s.getAll())
const warteAnhaengen = (e: WarteEintrag) => anfrage<number>('warteschlange', 'readwrite', (s) => s.add(e))
const warteEntfernen = (id: number) => anfrage('warteschlange', 'readwrite', (s) => s.delete(id))
const warteAktualisieren = (e: WarteEintrag) => anfrage('warteschlange', 'readwrite', (s) => s.put(e))

async function aufraeumen() {
  const d = await db()
  const grenze = Date.now() - MAX_ALTER_MS
  const tx = d.transaction('antworten', 'readwrite')
  const req = tx.objectStore('antworten').openCursor()
  req.onsuccess = () => {
    const c = req.result
    if (!c) return
    if ((c.value as GespeicherteAntwort).zeit < grenze) c.delete()
    c.continue()
  }
}

// --- Zustand für die Anzeige ------------------------------------------------

export interface OfflineZustand {
  offline: boolean
  wartend: number
  fehler: string | null
  synchronisiert: boolean
  /** Letzte Verbindungsprüfung (für die Anzeige im Dialog). */
  pruefung: { zeit: number; ok: boolean; grund: string } | null
}

let zustand: OfflineZustand = { offline: typeof navigator !== 'undefined' && !navigator.onLine, wartend: 0, fehler: null, synchronisiert: false, pruefung: null }
const hoerer = new Set<(z: OfflineZustand) => void>()

function setzeZustand(neu: Partial<OfflineZustand>) {
  const vorher = zustand
  zustand = { ...zustand, ...neu }
  if (vorher !== zustand && (Object.keys(neu) as (keyof OfflineZustand)[]).some((k) => vorher[k] !== zustand[k])) {
    hoerer.forEach((h) => h(zustand))
  }
  if (vorher.offline && !zustand.offline) void synchronisieren()
}

export function offlineZustand() { return zustand }
export function aufZustandHoeren(h: (z: OfflineZustand) => void) {
  hoerer.add(h)
  return () => { hoerer.delete(h) }
}

async function warteZahlAktualisieren() {
  const liste = await warteschlangeLesen()
  setzeZustand({ wartend: liste.length, fehler: liste.find((e) => e.fehler)?.fehler ?? null })
  return liste
}

// --- Hilfen ------------------------------------------------------------------

const echtesFetch: typeof fetch = (...a) => fetch(...a)

/** Laufende Anfragen; das Vorab-Laden wartet, bis eine Seite fertig geladen hat. */
let laufend = 0
declare global { interface Window { __lsdLaufend?: () => number } }
if (typeof window !== 'undefined') window.__lsdLaufend = () => laufend

function mitTimeout(input: RequestInfo | URL, init: RequestInit | undefined, ms: number): Promise<Response> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), ms)
  const signal = init?.signal
  if (signal) {
    if (signal.aborted) ctrl.abort()
    else signal.addEventListener('abort', () => ctrl.abort(), { once: true })
  }
  return echtesFetch(input, { ...init, signal: ctrl.signal }).finally(() => clearTimeout(timer))
}

function headerObjekt(h: HeadersInit | undefined): Record<string, string> {
  const o: Record<string, string> = {}
  new Headers(h).forEach((v, k) => { o[k.toLowerCase()] = v })
  return o
}

function neueUuid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
  })
}

function cacheKey(method: string, url: string, headers: Record<string, string>, body: string | null) {
  const accept = headers['accept'] || ''
  return `${method} ${url} ${accept}${method === 'POST' ? ' ' + (body || '') : ''}`
}

function tabelleAus(url: URL): string | null {
  const m = url.pathname.match(/\/rest\/v1\/([^/]+)$/)
  return m && m[1] !== 'rpc' ? m[1] : null
}

const TITEL: Record<string, string> = {
  serviceberichte: 'Servicebericht',
  servicebericht_tage: 'Arbeitstag',
  servicebericht_ersatzteile: 'Ersatzteil',
  messprotokolle: 'Messprotokoll',
  wartungsprotokolle: 'Wartungsprotokoll',
  machines: 'Maschine',
  ansprechpartner: 'Ansprechpartner',
  customers: 'Kunde',
}
function titelFuer(method: string, url: URL): string {
  if (url.pathname.includes('/storage/v1/object/')) return 'Unterschrift hochladen'
  const t = tabelleAus(url) || 'Daten'
  const name = TITEL[t] || t
  return `${name} ${method === 'POST' ? 'anlegen' : method === 'DELETE' ? 'löschen' : 'ändern'}`
}

// --- Filter wie bei PostgREST (nur das, was die App nutzt) --------------------

const STEUER_PARAMS = new Set(['select', 'order', 'limit', 'offset', 'on_conflict', 'columns'])
type Zeile = Record<string, unknown>

/** Prüft eine Zeile gegen die Filter einer URL. `streng`: unbekannte Filter zählen als "passt nicht". */
function passt(zeile: Zeile, url: URL, streng: boolean): boolean {
  for (const [key, wert] of url.searchParams) {
    if (STEUER_PARAMS.has(key) || key.includes('.')) continue
    const v = zeile[key]
    if (wert.startsWith('eq.')) {
      if (v === undefined) { if (streng) return false; continue }
      if (String(v) !== wert.slice(3)) return false
    } else if (wert.startsWith('in.(') && wert.endsWith(')')) {
      if (v === undefined) { if (streng) return false; continue }
      const liste = wert.slice(4, -1).split(',').map((s) => s.replace(/^"|"$/g, ''))
      if (!liste.includes(String(v))) return false
    } else if (wert === 'is.null') {
      if (v !== null && v !== undefined) return false
    } else if (streng) {
      return false
    }
  }
  return true
}

function sortieren(zeilen: Zeile[], url: URL) {
  const order = url.searchParams.get('order')
  if (!order || order.includes(',')) return
  const [spalte, richtung] = order.split('.')
  const f = richtung === 'desc' ? -1 : 1
  zeilen.sort((a, b) => {
    const x = a[spalte], y = b[spalte]
    if (x === y) return 0
    if (x === null || x === undefined) return 1
    if (y === null || y === undefined) return -1
    return (x < y ? -1 : 1) * f
  })
}

function bodyZeilen(body: WarteEintrag['body']): Zeile[] {
  if (typeof body !== 'string' || !body) return []
  try {
    const j = JSON.parse(body)
    return Array.isArray(j) ? j : [j]
  } catch { return [] }
}

/** Legt die noch nicht hochgeladenen Änderungen über eine gelesene Antwort. */
function ueberlagern(url: URL, basis: Zeile[], warte: WarteEintrag[]): { zeilen: Zeile[]; geaendert: boolean } {
  const tabelle = tabelleAus(url)
  if (!tabelle) return { zeilen: basis, geaendert: false }
  let zeilen = basis.map((z) => ({ ...z }))
  let geaendert = false, eingefuegt = false
  for (const e of warte) {
    const eu = new URL(e.url)
    if (tabelleAus(eu) !== tabelle) continue
    if (e.method === 'POST') {
      for (const neu of bodyZeilen(e.body)) {
        const vorhanden = zeilen.findIndex((z) => z.id !== undefined && z.id === neu.id)
        if (vorhanden >= 0) { zeilen[vorhanden] = { ...zeilen[vorhanden], ...neu }; geaendert = true; continue }
        const zeile = tabelle === 'serviceberichte' ? { status: 'offen', bericht_nummer: 'wird vergeben', ...neu } : neu
        if (passt(zeile, url, true)) { zeilen.push(zeile); geaendert = eingefuegt = true }
      }
    } else if (e.method === 'PATCH') {
      const patch = bodyZeilen(e.body)[0] || {}
      zeilen = zeilen.map((z) => {
        if (!passt(z, eu, true)) return z
        geaendert = true
        return { ...z, ...patch }
      })
    } else if (e.method === 'DELETE') {
      const vorher = zeilen.length
      zeilen = zeilen.filter((z) => !passt(z, eu, true))
      if (zeilen.length !== vorher) geaendert = true
    }
  }
  if (eingefuegt) sortieren(zeilen, url)
  return { zeilen, geaendert }
}

const OBJEKT_ACCEPT = 'application/vnd.pgrst.object+json'

function antwortBauen(status: number, body: string, contentType: string | null, contentRange: string | null, ausDemSpeicher: boolean) {
  const h = new Headers()
  if (contentType) h.set('content-type', contentType)
  if (contentRange) h.set('content-range', contentRange)
  if (ausDemSpeicher) h.set('x-lsd-offline', '1')
  return new Response(status === 204 ? null : body, { status, headers: h })
}

/** Gespeicherte oder frische Antwort + Warteschlange → Antwort für die App. */
function mitUeberlagerung(url: URL, headers: Record<string, string>, basis: GespeicherteAntwort | null, warte: WarteEintrag[], ausDemSpeicher: boolean): Response | null {
  const objekt = (headers['accept'] || '').includes(OBJEKT_ACCEPT)
  let zeilen: Zeile[] = []
  if (basis) {
    if (basis.status >= 200 && basis.status < 300) {
      try {
        const j = JSON.parse(basis.body)
        zeilen = Array.isArray(j) ? j : j ? [j] : []
      } catch {
        return antwortBauen(basis.status, basis.body, basis.contentType, basis.contentRange, ausDemSpeicher)
      }
    } else if (!(objekt && basis.status === 406)) {
      return antwortBauen(basis.status, basis.body, basis.contentType, basis.contentRange, ausDemSpeicher)
    }
  }
  const { zeilen: neu, geaendert } = warte.length ? ueberlagern(url, zeilen, warte) : { zeilen, geaendert: false }
  if (!basis && !geaendert) return null
  if (basis && !geaendert) return antwortBauen(basis.status, basis.body, basis.contentType, basis.contentRange, ausDemSpeicher)
  const ct = 'application/json; charset=utf-8'
  if (objekt) {
    if (neu.length !== 1) {
      return antwortBauen(406, JSON.stringify({ code: 'PGRST116', details: `${neu.length} Zeilen`, hint: null, message: 'JSON object requested, multiple (or no) rows returned' }), ct, null, ausDemSpeicher)
    }
    return antwortBauen(200, JSON.stringify(neu[0]), ct, null, ausDemSpeicher)
  }
  return antwortBauen(200, JSON.stringify(neu), ct, `0-${Math.max(neu.length - 1, 0)}/*`, ausDemSpeicher)
}

// --- Die fetch-Funktion für den Supabase-Client ------------------------------

function istNetzfehler(e: unknown) {
  return e instanceof TypeError || (e instanceof DOMException && (e.name === 'AbortError' || e.name === 'TimeoutError'))
}

function netzWeg() { setzeZustand({ offline: true }) }
function netzDa() { if (zustand.offline) setzeZustand({ offline: false }) }

/** Eine Anfrage ist gescheitert. Ist das Gerät sicher ohne Netz (Flugmodus), sofort offline;
 * sonst entscheidet die Server-Prüfung — eine einzelne langsame Anfrage darf nicht die ganze
 * App auf offline schalten, während andere Anfragen durchgehen. */
function anfrageGescheitert() {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) netzWeg()
  else void probe()
}

async function lesen(input: RequestInfo | URL, init: RequestInit | undefined, url: URL, headers: Record<string, string>, body: string | null): Promise<Response> {
  const key = cacheKey(init?.method || 'GET', url.toString(), headers, body)
  const warte = zustand.wartend ? await warteschlangeLesen() : []
  if (!zustand.offline) {
    try {
      const res = await mitTimeout(input, init, LESEN_TIMEOUT)
      netzDa()
      const text = await res.clone().text()
      const gespeichert: GespeicherteAntwort = {
        key, status: res.status, contentType: res.headers.get('content-type'), contentRange: res.headers.get('content-range'), body: text, zeit: Date.now(),
      }
      if (res.ok) void antwortSchreiben(gespeichert).catch(() => {})
      return (warte.length && mitUeberlagerung(url, headers, gespeichert, warte, false)) || res
    } catch (e) {
      if (init?.signal?.aborted || !istNetzfehler(e)) throw e
      anfrageGescheitert()
    }
  }
  const gespeichert = (await antwortLesen(key).catch(() => undefined)) || null
  const antwort = mitUeberlagerung(url, headers, gespeichert, warte, true)
  if (antwort) return antwort
  throw new TypeError('Offline – diese Daten sind auf dem Gerät noch nicht gespeichert.')
}

async function schreiben(input: RequestInfo | URL, init: RequestInit | undefined, url: URL, headers: Record<string, string>): Promise<Response> {
  const method = (init?.method || 'GET').toUpperCase()
  let body: WarteEintrag['body'] = null
  if (typeof init?.body === 'string') body = init.body
  else if (init?.body instanceof Blob) body = init.body
  else if (init?.body instanceof ArrayBuffer) body = new Blob([init.body], { type: headers['content-type'] })
  else if (init?.body instanceof FormData) {
    const eintraege: [string, string | Blob][] = []
    init.body.forEach((v, k) => eintraege.push([k, v]))
    body = { formdata: eintraege }
  } else if (init?.body != null) {
    // Andere Formen (Streams) können nicht in die Warteschlange — dann nur mit Netz.
    return mitTimeout(input, init, SCHREIBEN_TIMEOUT)
  }

  // Neue Datensätze bekommen ihre ID auf dem Gerät (siehe oben).
  const tabelle = tabelleAus(url)
  if (method === 'POST' && tabelle && UUID_TABELLEN.has(tabelle) && typeof body === 'string') {
    const zeilen = bodyZeilen(body)
    if (zeilen.length && zeilen.every((z) => typeof z === 'object' && z)) {
      zeilen.forEach((z) => { if (z.id === undefined) z.id = neueUuid() })
      body = JSON.stringify(zeilen.length === 1 && !body.trimStart().startsWith('[') ? zeilen[0] : zeilen)
      if (url.searchParams.has('columns') && !url.searchParams.get('columns')!.split(',').includes('id')) {
        url.searchParams.set('columns', url.searchParams.get('columns') + ',id')
      }
      init = { ...init, body }
      input = url.toString()
    }
  }

  // Liegt schon etwas in der Warteschlange, muss alles Neue dahinter (Reihenfolge!).
  if (!zustand.offline && zustand.wartend === 0) {
    try {
      const res = await mitTimeout(input, init, SCHREIBEN_TIMEOUT)
      netzDa()
      return res
    } catch (e) {
      if (init?.signal?.aborted || !istNetzfehler(e)) throw e
      anfrageGescheitert()
    }
  }

  const eintrag: WarteEintrag = { method, url: url.toString(), headers, body, zeit: Date.now(), titel: titelFuer(method, url) }
  await warteAnhaengen(eintrag)
  await warteZahlAktualisieren()
  if (!zustand.offline) void synchronisieren()
  return synthetischeAntwort(eintrag)
}

function synthetischeAntwort(e: WarteEintrag): Response {
  const url = new URL(e.url)
  if (url.pathname.includes('/storage/v1/object/')) {
    const key = url.pathname.split('/storage/v1/object/')[1]
    return new Response(JSON.stringify({ Key: key, Id: neueUuid() }), { status: 200, headers: { 'content-type': 'application/json' } })
  }
  const representation = (e.headers['prefer'] || '').includes('return=representation')
  if (!representation) return new Response(null, { status: e.method === 'POST' ? 201 : 204 })
  let zeilen = bodyZeilen(e.body)
  if (e.method === 'DELETE') zeilen = []
  // Bei Änderungen steht die ID nur im Filter (id=eq.…) — die App erwartet sie aber zurück.
  const idFilter = url.searchParams.get('id')
  if (e.method === 'PATCH' && idFilter?.startsWith('eq.')) zeilen = zeilen.map((z) => ({ id: idFilter.slice(3), ...z }))
  const objekt = (e.headers['accept'] || '').includes(OBJEKT_ACCEPT)
  return new Response(JSON.stringify(objekt ? zeilen[0] ?? null : zeilen), {
    status: e.method === 'POST' ? 201 : 200,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  })
}

export const offlineFetch: typeof fetch = async (input, init) => {
  const url = new URL(input instanceof Request ? input.url : input.toString())
  const method = (init?.method || (input instanceof Request ? input.method : 'GET')).toUpperCase()
  const istRest = url.pathname.startsWith('/rest/v1/')
  const istStorageUpload = url.pathname.startsWith('/storage/v1/object/') && !url.pathname.startsWith('/storage/v1/object/public/') && (method === 'POST' || method === 'PUT')
  if (url.pathname.startsWith('/auth/v1/token')) {
    // Token erneuern: Ohne Netz sofort abbrechen statt minutenlang zu hängen. Die
    // Anmeldung bleibt auf dem Gerät erhalten und wird mit Netz automatisch erneuert.
    if (zustand.offline) throw new TypeError('Offline')
    return mitTimeout(input, init, LESEN_TIMEOUT)
  }
  if (!istRest && !istStorageUpload) return echtesFetch(input, init)

  laufend++
  try {
    const headers = headerObjekt(init?.headers)
    const istRpc = url.pathname.startsWith('/rest/v1/rpc/')
    if (method === 'GET' || method === 'HEAD' || (istRpc && method === 'POST')) {
      return await lesen(input, init, url, headers, typeof init?.body === 'string' ? init.body : null)
    }
    return await schreiben(input, init, url, headers)
  } finally {
    laufend--
  }
}

// --- Hochladen der Warteschlange --------------------------------------------

let tokenHolen: () => Promise<string | null> = async () => null
/** Wird vom Supabase-Client gesetzt: liefert ein gültiges Zugangs-Token. */
export function setzeTokenQuelle(f: () => Promise<string | null>) { tokenHolen = f }

let laeuft: Promise<void> | null = null

/** Lädt die Warteschlange der Reihe nach hoch. Bricht beim ersten Fehler ab (Folgedaten hängen evtl. davon ab). */
export function synchronisieren(): Promise<void> {
  if (typeof window === 'undefined' || window.top !== window) return Promise.resolve()
  if (!laeuft) {
    const arbeit = async () => {
      let liste = await warteschlangeLesen()
      if (!liste.length) return
      const token = await tokenHolen().catch(() => null)
      if (!token) return
      for (const e of liste) {
        const headers: Record<string, string> = { ...e.headers, authorization: `Bearer ${token}`, apikey: ANON_KEY }
        let res: Response
        try {
          // Bei FormData setzt der Browser den Content-Type samt Trenner selbst.
          if (istForm(e.body)) delete headers['content-type']
          res = await mitTimeout(e.url, { method: e.method, headers, body: alsSendeBody(e.body) }, 30000)
        } catch (err) {
          if (istNetzfehler(err)) { anfrageGescheitert(); break }
          throw err
        }
        netzDa()
        let erledigt = res.ok
        if (!erledigt && e.method === 'POST' && res.status === 409) {
          // Schon angekommen (gleiche ID) — z.B. weil der erste Versuch doch durchging.
          const t = await res.clone().text()
          if (t.includes('23505')) erledigt = true
        }
        if (erledigt) {
          await warteEntfernen(e.id!)
          continue
        }
        // Vorübergehend (Anmeldung wird gerade erneuert, Server überlastet): später nochmal.
        if (res.status === 401 || res.status === 408 || res.status === 429 || res.status >= 500) break
        const text = await res.text().catch(() => '')
        let meldung = text
        try { meldung = JSON.parse(text).message || text } catch { /* Text bleibt */ }
        await warteAktualisieren({ ...e, fehler: `${e.titel}: ${meldung || 'Fehler ' + res.status}` })
        break
      }
      liste = await warteZahlAktualisieren()
      if (!liste.length) setzeZustand({ synchronisiert: true })
    }
    // Die Sperre verhindert doppeltes Hochladen aus zwei Fenstern. Gibt ein anderes Fenster
    // sie nicht binnen 10 s frei, laufen wir trotzdem (ein doppelter Versuch ist harmlos:
    // gleiche IDs, Änderungen mehrfach anwendbar) — hängen bleiben darf die Warteschlange nie.
    const mitSperre = () => {
      if (!navigator.locks) return arbeit()
      const ctrl = new AbortController()
      const timer = setTimeout(() => ctrl.abort(), 10000)
      return navigator.locks.request('lsd-sync', { signal: ctrl.signal }, arbeit)
        .catch((e) => (e instanceof DOMException && e.name === 'AbortError' ? arbeit() : Promise.reject(e)))
        .finally(() => clearTimeout(timer))
    }
    laeuft = mitSperre().catch((e) => console.error('Synchronisieren fehlgeschlagen', e)).finally(() => { laeuft = null })
  }
  return laeuft
}

export async function warteschlangeAnzeigen(): Promise<WarteEintrag[]> {
  return warteschlangeLesen()
}

/** Fehlerhaften Eintrag erneut versuchen (Fehlermarke entfernen und hochladen). */
export async function erneutVersuchen(id: number) {
  const e = (await warteschlangeLesen()).find((x) => x.id === id)
  if (e) await warteAktualisieren({ ...e, fehler: undefined })
  await warteZahlAktualisieren()
  await synchronisieren()
}

/** Fehlerhaften Eintrag verwerfen (die Änderung geht verloren). */
export async function verwerfen(id: number) {
  await warteEntfernen(id)
  await warteZahlAktualisieren()
  await synchronisieren()
}

/** Beim Abmelden: alles auf dem Gerät Gespeicherte löschen (nur ohne Warteschlange). */
export async function geraetespeicherLeeren() {
  await anfrage('antworten', 'readwrite', (s) => s.clear())
}

/** Für das PDF: noch nicht hochgeladene Unterschrift direkt vom Gerät holen. */
export async function wartendesBild(publicUrl: string): Promise<Blob | null> {
  const m = publicUrl.match(/\/storage\/v1\/object\/public\/(.+)$/)
  if (!m) return null
  const pfad = decodeURIComponent(m[1].split('?')[0])
  const liste = await warteschlangeLesen().catch(() => [] as WarteEintrag[])
  for (let i = liste.length - 1; i >= 0; i--) {
    const e = liste[i]
    if (!decodeURIComponent(new URL(e.url).pathname).endsWith('/storage/v1/object/' + pfad)) continue
    if (e.body instanceof Blob) return e.body
    if (istForm(e.body)) {
      const datei = e.body.formdata.find(([, v]) => v instanceof Blob)
      if (datei) return datei[1] as Blob
    }
  }
  return null
}

// --- Netz beobachten ---------------------------------------------------------

let probeLaeuft: Promise<boolean> | null = null

/** Fragt den Server kurz an. true = erreichbar (Zustand wird dabei auf online gesetzt). */
function probe(): Promise<boolean> {
  if (!probeLaeuft) {
    probeLaeuft = (async () => {
      let ok = false, grund = '', hart = false
      try {
        const res = await mitTimeout(`${SUPABASE_URL}/auth/v1/health`, { headers: { apikey: ANON_KEY } }, 10000)
        ok = res.ok
        if (!ok) grund = `Server antwortet mit Fehler ${res.status}`
      } catch (e) {
        const zeitueberschreitung = e instanceof DOMException && e.name === 'AbortError'
        grund = zeitueberschreitung ? 'Keine Antwort (Zeitüberschreitung)' : 'Keine Verbindung zum Server'
        hart = !zeitueberschreitung
      }
      setzeZustand({ pruefung: { zeit: Date.now(), ok, grund } })
      // Eine Zeitüberschreitung allein (langsames Netz, viele Anfragen gleichzeitig) schaltet
      // nicht auf offline — nur ein harter Fehler oder ein Gerät, das selbst "kein Netz" meldet.
      if (ok) netzDa()
      else if (hart || navigator.onLine === false) netzWeg()
      return ok
    })().finally(() => { probeLaeuft = null })
  }
  return probeLaeuft
}

/** Vom Knopf "Verbindung prüfen": Server anfragen und, wenn erreichbar, Warteschlange hochladen. */
export async function verbindungPruefen(): Promise<boolean> {
  const ok = await probe()
  if (ok) await synchronisieren()
  return ok
}

// Nach dem Flugmodus braucht das Netz am Handy oft ein paar Sekunden: rasch mehrmals prüfen.
function baldPruefen() {
  ;[1500, 4000, 8000].forEach((ms) => setTimeout(() => { if (zustand.offline) void probe() }, ms))
  void probe()
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', baldPruefen)
  window.addEventListener('offline', anfrageGescheitert)
  // iOS hält die App im Hintergrund an. Kommt sie wieder nach vorn, sofort prüfen bzw. hochladen.
  const wiederDa = () => {
    if (document.visibilityState !== 'visible') return
    if (zustand.offline) baldPruefen()
    else if (zustand.wartend && !zustand.fehler) void synchronisieren()
  }
  document.addEventListener('visibilitychange', wiederDa)
  window.addEventListener('pageshow', wiederDa)
  window.addEventListener('focus', wiederDa)
  setInterval(() => {
    if (zustand.offline) void probe()
    else if (zustand.wartend && !zustand.fehler) void synchronisieren()
  }, PROBE_INTERVALL)
  void warteZahlAktualisieren().then(() => synchronisieren()).catch(() => {})
  void aufraeumen().catch(() => {})
}
