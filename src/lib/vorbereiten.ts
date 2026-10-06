// "Für Einsatz vorbereiten": lädt alle Seiten, die ein Techniker beim Kunden braucht,
// einmal im Hintergrund, damit die Offline-Schicht (offline.ts) sie auf dem Gerät hat.
//
// Jede Seite wird in einem unsichtbaren Rahmen (iframe) wirklich geöffnet. So landen
// genau die Abfragen im Speicher, die die Seite auch offline wieder stellt — egal, wie
// die Seite ihre Daten lädt.
import { aufZustandHoeren, offlineZustand } from './offline'
import { fetchOrders } from './queries'
import { supabase } from './supabase'
import type { Employee } from './types'

export interface Fortschritt { fertig: number; gesamt: number; aktuell: string }

const BASIS = import.meta.env.BASE_URL.replace(/\/$/, '')

function seiteLaden(pfad: string): Promise<void> {
  return new Promise((resolve) => {
    const rahmen = document.createElement('iframe')
    rahmen.setAttribute('aria-hidden', 'true')
    rahmen.style.cssText = 'position:fixed;left:-10000px;top:0;width:400px;height:800px;border:0;visibility:hidden'
    rahmen.src = `${BASIS}${pfad}`
    let ruhig = 0
    const start = Date.now()
    const fertig = () => { clearInterval(timer); rahmen.remove(); resolve() }
    // Fertig, wenn die Seite mindestens 1,5 s geladen ist und 1 s lang keine Anfrage mehr läuft.
    const timer = setInterval(() => {
      let laufend = 1
      try { laufend = rahmen.contentWindow?.__lsdLaufend?.() ?? 1 } catch { /* noch nicht bereit */ }
      ruhig = laufend === 0 ? ruhig + 250 : 0
      if ((Date.now() - start > 1500 && ruhig >= 1000) || Date.now() - start > 25000) fertig()
    }, 250)
    document.body.appendChild(rahmen)
  })
}

/** Die Aufträge, die beim Kunden gebraucht werden: "neu" und "in Arbeit", beim Techniker nur die eigenen. */
async function relevanteAuftraege(ich: Employee) {
  const auftraege = (await fetchOrders()).filter((o) => o.status === 'neu' || o.status === 'in Arbeit')
  return ich.role === 'Techniker' ? auftraege.filter((o) => o.techniker.some((t) => t.id === ich.id)) : auftraege
}

const MERK_KEY = 'lsd-vorbereitet'
export interface Vorbereitung { zeit: number; stand: string }

export function letzteVorbereitung(): Vorbereitung | null {
  try { return JSON.parse(localStorage.getItem(MERK_KEY) || 'null') } catch { return null }
}

async function hash(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Prüfsumme über alles, was "Für Einsatz vorbereiten" lädt (Aufträge, Berichte mit Tagen und
 * Ersatzteilen, Messprotokolle, Maschinen, Kunden, Ansprechpartner). Ist sie gleich wie beim
 * letzten Vorbereiten, hat sich in der Datenbank nichts geändert.
 */
export async function datenstand(ich: Employee): Promise<string> {
  const relevant = await relevanteAuftraege(ich)
  const ids = relevant.map((o) => o.id)
  const maschinen = [...new Set(relevant.flatMap((o) => o.machines.map((m) => m.id)))]
  const kunden = [...new Set(relevant.flatMap((o) => (o.einsatzkunde_id ? [o.einsatzkunde_id] : [])))]
  const leer = { data: [] as unknown[] }
  const [berichte, protokolle, masch, kund, ansprech] = ids.length
    ? await Promise.all([
        supabase.from('serviceberichte').select('*').in('auftrag_id', ids).order('id'),
        supabase.from('messprotokolle').select('*').in('auftrag_id', ids).order('id'),
        maschinen.length ? supabase.from('machines').select('*').in('id', maschinen).order('id') : leer,
        kunden.length ? supabase.from('customers').select('*').in('id', kunden).order('id') : leer,
        kunden.length ? supabase.from('ansprechpartner').select('*').in('kunde_id', kunden).order('id') : leer,
      ])
    : [leer, leer, leer, leer, leer]
  const berichtIds = ((berichte.data || []) as { id: string }[]).map((b) => b.id)
  const [tage, teile] = berichtIds.length
    ? await Promise.all([
        supabase.from('servicebericht_tage').select('*').in('servicebericht_id', berichtIds).order('id'),
        supabase.from('servicebericht_ersatzteile').select('*').in('servicebericht_id', berichtIds).order('id'),
      ])
    : [leer, leer]
  return hash(JSON.stringify([relevant, berichte.data, protokolle.data, masch.data, kund.data, ansprech.data, tage.data, teile.data]))
}

// --- Laufender Durchgang (für Knopf und Dialog) -------------------------------

export interface VorbereitungsZustand {
  laeuft: boolean
  fortschritt: Fortschritt | null
  /** true = von selbst gestartet, nicht über den Knopf. */
  automatisch: boolean
  letzterFehler: string | null
}

let vz: VorbereitungsZustand = { laeuft: false, fortschritt: null, automatisch: false, letzterFehler: null }
const vHoerer = new Set<(z: VorbereitungsZustand) => void>()
function setzeVz(neu: Partial<VorbereitungsZustand>) {
  vz = { ...vz, ...neu }
  vHoerer.forEach((h) => h(vz))
}
export function vorbereitungsZustand() { return vz }
export function aufVorbereitungHoeren(h: (z: VorbereitungsZustand) => void) {
  vHoerer.add(h)
  return () => { vHoerer.delete(h) }
}

let laufend: Promise<number> | null = null

/** Startet das Vorbereiten (vom Knopf oder automatisch). Läuft es schon, wird der laufende Durchgang mitbenutzt. */
export function fuerEinsatzVorbereiten(ich: Employee, automatisch = false): Promise<number> {
  if (laufend) return laufend
  setzeVz({ laeuft: true, automatisch, fortschritt: { fertig: 0, gesamt: 0, aktuell: 'Aufträge' }, letzterFehler: null })
  laufend = ablauf(ich, (f) => setzeVz({ fortschritt: f }))
    .catch((e) => { setzeVz({ letzterFehler: e instanceof Error ? e.message : 'unbekannter Fehler' }); throw e })
    .finally(() => { laufend = null; setzeVz({ laeuft: false, fortschritt: null }) })
  return laufend
}

// --- Von selbst aktuell halten --------------------------------------------------

const AUTO_INTERVALL = 10 * 60 * 1000
let letzterVergleich = 0

/**
 * Hält das Gerät ohne Zutun aktuell: Solange die App sichtbar ist und Netz hat, wird beim Start,
 * beim Zurückkommen, nach dem Hochladen und alle 10 Minuten der Datenstand verglichen; weicht er
 * vom letzten Vorbereiten ab, läuft das Vorbereiten im Hintergrund. Gibt eine Stopp-Funktion zurück.
 */
export function autoVorbereitenStarten(ichHolen: () => Employee | null): () => void {
  if (window.top !== window) return () => {}
  const lauf = async () => {
    const ich = ichHolen()
    if (!ich || laufend || offlineZustand().offline || offlineZustand().wartend || document.visibilityState !== 'visible') return
    if (Date.now() - letzterVergleich < 60_000) return
    letzterVergleich = Date.now()
    try {
      const stand = await datenstand(ich)
      if (stand !== letzteVorbereitung()?.stand) await fuerEinsatzVorbereiten(ich, true)
    } catch { /* beim nächsten Mal */ }
  }
  const sichtbar = () => { if (document.visibilityState === 'visible') void lauf() }
  document.addEventListener('visibilitychange', sichtbar)
  const abNetz = aufZustandHoeren((z) => { if (!z.offline && !z.wartend) void lauf() })
  const timer = window.setInterval(lauf, AUTO_INTERVALL)
  const start = window.setTimeout(lauf, 5000)
  return () => {
    document.removeEventListener('visibilitychange', sichtbar)
    abNetz()
    clearInterval(timer)
    clearTimeout(start)
  }
}

async function ablauf(ich: Employee, melden: (f: Fortschritt) => void): Promise<number> {
  const relevant = await relevanteAuftraege(ich)
  const ids = relevant.map((o) => o.id)

  const [{ data: berichte }, { data: protokolle }] = ids.length
    ? await Promise.all([
        supabase.from('serviceberichte').select('id').in('auftrag_id', ids),
        supabase.from('messprotokolle').select('id').in('auftrag_id', ids),
      ])
    : [{ data: [] }, { data: [] }]

  const maschinen = new Set<string>()
  const kunden = new Set<string>()
  relevant.forEach((o) => {
    o.machines.forEach((m) => maschinen.add(m.id))
    if (o.einsatzkunde_id) kunden.add(o.einsatzkunde_id)
  })

  const seiten: [string, string][] = [
    ['/auftraege', 'Auftragsliste'],
    ['/kunden', 'Kundenliste'],
    ['/maschinen', 'Maschinenliste'],
    ...relevant.map((o): [string, string] => [`/auftraege/${o.id}`, `Auftrag #${o.id}`]),
    ...(berichte || []).map((b): [string, string] => [`/berichte/${b.id}`, 'Servicebericht']),
    ...(protokolle || []).map((p): [string, string] => [`/messprotokolle/${p.id}`, 'Messprotokoll']),
    ...[...maschinen].map((id): [string, string] => [`/maschinen/${id}`, 'Maschine']),
    ...[...kunden].map((id): [string, string] => [`/kunden/${id}`, 'Kunde']),
  ]
  if (ich.role === 'Techniker' || ich.role === 'CEO') seiten.push(['/verwaltung', 'Meine Verwaltung'])

  for (let i = 0; i < seiten.length; i++) {
    melden({ fertig: i, gesamt: seiten.length, aktuell: seiten[i][1] })
    await seiteLaden(seiten[i][0])
  }
  melden({ fertig: seiten.length, gesamt: seiten.length, aktuell: 'Prüfsumme' })
  // Stand merken, damit der Knopf ausgegraut bleibt, solange sich nichts ändert.
  const stand = await datenstand(ich)
  try { localStorage.setItem(MERK_KEY, JSON.stringify({ zeit: Date.now(), stand } satisfies Vorbereitung)) } catch { /* egal */ }
  melden({ fertig: seiten.length, gesamt: seiten.length, aktuell: '' })
  return relevant.length
}
