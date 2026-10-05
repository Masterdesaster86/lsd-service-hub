// "Für Einsatz vorbereiten": lädt alle Seiten, die ein Techniker beim Kunden braucht,
// einmal im Hintergrund, damit die Offline-Schicht (offline.ts) sie auf dem Gerät hat.
//
// Jede Seite wird in einem unsichtbaren Rahmen (iframe) wirklich geöffnet. So landen
// genau die Abfragen im Speicher, die die Seite auch offline wieder stellt — egal, wie
// die Seite ihre Daten lädt.
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

export async function fuerEinsatzVorbereiten(ich: Employee, melden: (f: Fortschritt) => void): Promise<number> {
  // Offene Aufträge: beim Techniker die eigenen, sonst alle offenen.
  const auftraege = (await fetchOrders()).filter((o) => o.status !== 'erledigt')
  const meine = auftraege.filter((o) => o.techniker.some((t) => t.id === ich.id))
  const relevant = ich.role === 'Techniker' ? meine : auftraege
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
  melden({ fertig: seiten.length, gesamt: seiten.length, aktuell: '' })
  return relevant.length
}
