// Rechnungsplan für easybill aus den Serviceberichten eines Auftrags.
//
// Die Zeiten werden mit derselben Logik wie im Servicebericht gerechnet (zeit.ts), damit
// Rechnung und Bericht beim Kunden gleich aussehen. Die Regeln stammen aus dem Regelwerk
// "Rechnung aus Servicebericht" (Oktober 2026): je Bericht ein Block aus Textzeile,
// Arbeitszeit, Reisezeit, Reisekosten, Pauschale, Hotel und Ersatzteilen. Preise kommen
// nicht von hier, sondern aus der Preisstufe des Kunden in easybill (Serverfunktion).
import { supabase } from './supabase'
import type { Employee, Machine, OrderWithRelations, Servicebericht, ServiceberichtErsatzteil, ServiceberichtTag } from './types'
import { calcBerichtTotalsMitKontext, istSamstag, istSonnOderFeiertag, type Tageskontext } from './zeit'

// easybill-Artikel (IDs aus dem Katalog, Stand 09.10.2026 — siehe docs/easybill-artikel.md)
const TECHNIKER_ARTIKEL: Record<string, { arbeit: number; arbeit50: number | null; arbeit100: number | null; reise: number; reise50: number | null; reise100: number | null }> = {
  lautenbacher: { arbeit: 10583676, arbeit50: 10583678, arbeit100: 31548586, reise: 12917264, reise50: 12917267, reise100: 31548591 },
  dirr: { arbeit: 12917259, arbeit50: 12917260, arbeit100: 31548596, reise: 12917263, reise50: 12917268, reise100: 31548601 },
  schimpf: { arbeit: 31356831, arbeit50: 31356836, arbeit100: 238896366, reise: 31356841, reise50: 31356846, reise100: 238896369 },
  sonst: { arbeit: 12917281, arbeit50: null, arbeit100: null, reise: 12917283, reise50: null, reise100: null },
}
const ARTIKEL = {
  reisekosten: 12917270, // Reisekosten je km
  aufwand: 12917272, // Aufwandspauschale 39 €
  aufwandWalther: 177125841, // Aufwandspauschale Carl Walther
  reisepauschaleWalther: 12917275, // Reisekostenpauschale Carl Walther GmbH 140 €
  reisepauschaleVils: 12917275, // gleicher Artikel, bei Vils mit 100 € je Einsatztag
  hotel: 212119146, // Kosten Hotel
}

export interface PlanPosition {
  typ: 'TEXT' | 'POSITION'
  text?: string
  position_id?: number
  menge?: number
  einheit?: string
  preis?: number | null
  /** Nur für die Anzeige in der App */
  label?: string
}

export interface Rechnungsplan {
  auftrag_id: string
  titel: string
  text_prefix: string
  text: string
  leistung_von: string
  leistung_bis: string
  positionen: PlanPosition[]
  bericht_ids: string[]
  pdfs?: { name: string; base64: string }[]
}

export interface BerichtMitDaten extends Servicebericht {
  tage: ServiceberichtTag[]
  ersatzteile: ServiceberichtErsatzteil[]
  machine: Machine | null
  techniker: Employee | null
}

export interface PlanErgebnis {
  plan: Rechnungsplan
  warnungen: string[]
  /** Ersatzteile ohne easybill-Artikel — müssen vor dem Anlegen zugeordnet werden */
  offeneTeile: { teil: ServiceberichtErsatzteil; bericht: BerichtMitDaten }[]
  berichte: BerichtMitDaten[]
}

const TEXT_PREFIX_STANDARD = '%KUNDE.ANREDE%,<br><br>herzlichen Dank für Ihren Auftrag.<br><br><div data-empty="true" style="text-align: center;"><strong><span style="font-size: 30px; color: rgb(226, 80, 65);">*Achtung neu Bankverbindung*</span></strong></div><div style="text-align: center;"><span style="font-size: 24px; color: rgb(226, 80, 65);">&nbsp;DE89100101239419540029</span></div><br>Für unsere Bemühungen berechnen wir Ihnen die nachfolgenden Leistungen:<br><br>'
const TEXT_SCHLUSS = 'Wir liefern zu den allgemeinen Geschäftsbedingungen der LSD Maschinenservice Simon Dirr und Manuel Lautenbacher GbR. Unsere AGBs können im Internet www.lsd-maschinenservice.de/agb/ eingesehen werden. Bezüglich der Entgeltminderung verweisen wir auf die aktuellen Zahlungs- und Lieferungsbedingungen.<br><br>Wir bedanken uns noch einmal herzlichst für Ihren Auftrag und stehen Ihnen weiterhin gerne zur Verfügung.<br><br>Bitte begleichen Sie den offenen Betrag bis zum %DOKUMENT.DATUM-FAELLIG%.<br><br><br>Mit freundlichen Grüßen<br><br>Ihr Service-Team von LSD-Maschinenservice'

function technikerKey(name: string | null | undefined): keyof typeof TECHNIKER_ARTIKEL {
  const n = (name || '').toLowerCase()
  if (n.includes('lautenbacher')) return 'lautenbacher'
  if (n.includes('dirr')) return 'dirr'
  if (n.includes('schimpf')) return 'schimpf'
  return 'sonst'
}

type Kundenregel = 'standard' | 'walther' | 'vils'
function kundenregel(name: string | null | undefined): Kundenregel {
  const n = (name || '').toLowerCase()
  if (n.includes('walther')) return 'walther'
  if (n.includes('vils')) return 'vils'
  return 'standard'
}

const r2 = (n: number) => Math.round(n * 100) / 100
const tt = (iso: string) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}.`
const ttjjjj = (iso: string) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}`

/** "22.09.2026", "30.09.–01.10.2026" oder "22.09. und 07.10.2026" */
export function einsatzText(daten: string[]): string {
  const d = [...new Set(daten)].sort()
  if (d.length === 0) return ''
  if (d.length === 1) return ttjjjj(d[0])
  const folgend = d.every((x, i) => i === 0 || (new Date(x).getTime() - new Date(d[i - 1]).getTime()) / 86400000 === 1)
  if (folgend) return `${tt(d[0])}–${ttjjjj(d[d.length - 1])}`
  const vorne = d.slice(0, -1).map(tt).join(', ')
  return `${vorne} und ${ttjjjj(d[d.length - 1])}`
}

function kopfblock(order: OrderWithRelations, einsatz: string, maschinen: string[]): string {
  const zeilen = [`Einsatz ${einsatz}${maschinen.length ? ' – ' + maschinen.join(', ') : ''}`, `Auftragsnummer: ${order.id}`]
  if (order.kundenreferenznr) zeilen.push(`Kundenreferenznummer: ${order.kundenreferenznr}`)
  if (order.bestellnummer) zeilen.push(`Ihre Bestellnummer: ${order.bestellnummer}`)
  return `<strong><span style="font-size: 18px;">${zeilen.join('<br>')}</span></strong>`
}

const min = (t: string | null) => (t ? Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5)) : null)

/** Gleicher Techniker, gleicher Tag, überlappende Uhrzeiten (meist ein Tippfehler beim Datum). */
function ueberschneidungen(berichte: BerichtMitDaten[]): string[] {
  const meldungen: string[] = []
  const proTechTag = new Map<string, { bericht: string; von: number; bis: number }[]>()
  for (const b of berichte) for (const t of b.tage) {
    const von = min(t.hinreise_von) ?? min(t.arbeitsbeginn), bis = min(t.rueckreise_bis) ?? min(t.arbeitsende)
    if (von == null || bis == null) continue
    const k = `${b.techniker_id}|${t.datum}`
    ;(proTechTag.get(k) || proTechTag.set(k, []).get(k)!).push({ bericht: b.bericht_nummer, von, bis })
  }
  for (const [k, liste] of proTechTag) {
    for (let i = 0; i < liste.length; i++) for (let j = i + 1; j < liste.length; j++) {
      if (liste[i].bericht !== liste[j].bericht && liste[i].von < liste[j].bis && liste[j].von < liste[i].bis) {
        meldungen.push(`${liste[i].bericht} und ${liste[j].bericht} überschneiden sich am ${ttjjjj(k.split('|')[1])} – bitte Datum prüfen.`)
      }
    }
  }
  return meldungen
}

/**
 * Baut den Rechnungsplan für alle abgeschlossenen, noch nicht abgerechneten Berichte des Auftrags.
 * `kontexte` liefert je Techniker die Tage aller seiner Berichte (für die 10-h-Schwelle).
 */
export function baueRechnungsplan(order: OrderWithRelations, alleBerichte: BerichtMitDaten[], kontexte: Record<string, Tageskontext>): PlanErgebnis {
  const warnungen: string[] = []
  const offen = alleBerichte.filter((b) => b.status !== 'abgeschlossen')
  if (offen.length) warnungen.push(`Noch nicht abgeschlossen und deshalb nicht auf der Rechnung: ${offen.map((b) => b.bericht_nummer).join(', ')}.`)
  const schonAbgerechnet = alleBerichte.filter((b) => b.status === 'abgeschlossen' && b.abgerechnet)
  if (schonAbgerechnet.length) warnungen.push(`Bereits abgerechnet und deshalb nicht dabei: ${schonAbgerechnet.map((b) => b.bericht_nummer).join(', ')}.`)

  const berichte = alleBerichte.filter((b) => b.status === 'abgeschlossen' && !b.abgerechnet)
  // Reihenfolge: nach erstem Einsatztag, Nachträge direkt hinter ihrem Bericht
  const ersterTag = (b: BerichtMitDaten) => [...b.tage].map((t) => t.datum).sort()[0] || '9999'
  const haupt = berichte.filter((b) => !b.ist_nachtrag).sort((a, b) => ersterTag(a).localeCompare(ersterTag(b)) || a.bericht_nummer.localeCompare(b.bericht_nummer))
  const sortiert: BerichtMitDaten[] = []
  for (const h of haupt) {
    sortiert.push(h)
    sortiert.push(...berichte.filter((n) => n.ist_nachtrag && n.nachtrag_zu === h.id))
  }
  // Nachträge, deren Bericht nicht (mehr) auf dieser Rechnung ist, hinten anhängen
  sortiert.push(...berichte.filter((b) => !sortiert.includes(b)))

  warnungen.push(...ueberschneidungen(berichte))

  const regel = kundenregel(order.einsatzkunde?.name)
  const positionen: PlanPosition[] = []
  const offeneTeile: PlanErgebnis['offeneTeile'] = []
  const pauschaleGesehen = new Set<string>()
  const alleDaten: string[] = []

  for (const b of sortiert) {
    const daten = b.tage.map((t) => t.datum)
    alleDaten.push(...daten)
    const m = b.machine
    const klammer = [m?.bezeichnung, m?.nummer, m?.kunden_maschinennummer].filter(Boolean).join(', ')
    positionen.push({ typ: 'TEXT', text: `Servicebericht ${b.bericht_nummer}${klammer ? ` (${klammer})` : ''}${daten.length ? `, Einsatz ${einsatzText(daten)}` : ''}:` })

    const t = calcBerichtTotalsMitKontext(b.tage, kontexte[b.techniker_id] || {})
    const tk = technikerKey(b.techniker?.name)
    const art = TECHNIKER_ARTIKEL[tk]
    const techName = b.techniker?.name || 'Techniker'
    const std = (label: string, menge: number, id: number | null, ersatz: number) => {
      if (menge <= 0) return
      if (id == null) { warnungen.push(`Für ${techName} gibt es in easybill keinen Artikel „${label}“ – die ${r2(menge)} h stehen als normale Stunden drin, bitte in easybill anpassen.`); id = ersatz }
      positionen.push({ typ: 'POSITION', position_id: id, menge: r2(menge), einheit: 'Std.', label: `${label} ${techName}` })
    }
    std('Arbeitszeit', t.arbeitNormal, art.arbeit, art.arbeit)
    std('Arbeitszeit +50 %', t.arbeitZuschlag50, art.arbeit50, art.arbeit)
    std('Arbeitszeit +100 %', t.arbeitZuschlag100, art.arbeit100, art.arbeit)
    if (regel === 'standard') {
      std('Reisezeit', t.reiseNormal, art.reise, art.reise)
      std('Reisezeit +50 %', t.reiseZuschlag50, art.reise50, art.reise)
      std('Reisezeit +100 %', t.reiseZuschlag100, art.reise100, art.reise)
      const km = b.tage.reduce((s, x) => s + (x.km_hin || 0) + (x.km_rueck || 0), 0)
      if (km > 0) positionen.push({ typ: 'POSITION', position_id: ARTIKEL.reisekosten, menge: km, einheit: 'km', label: 'Reisekosten' })
    }

    // Pauschalen je Techniker und Einsatztag, über alle Berichte des Auftrags nur einmal
    let neueTage = 0
    for (const d of new Set(daten)) { const k = `${b.techniker_id}|${d}`; if (!pauschaleGesehen.has(k)) { pauschaleGesehen.add(k); neueTage++ } }
    if (neueTage > 0) {
      if (regel === 'walther') {
        positionen.push({ typ: 'POSITION', position_id: ARTIKEL.aufwandWalther, menge: neueTage, einheit: 'Stück', label: 'Aufwandspauschale Carl Walther' })
        positionen.push({ typ: 'POSITION', position_id: ARTIKEL.reisepauschaleWalther, menge: neueTage, einheit: 'Stück', label: 'Reisekostenpauschale Carl Walther' })
      } else if (regel === 'vils') {
        if (tk !== 'lautenbacher') positionen.push({ typ: 'POSITION', position_id: ARTIKEL.reisepauschaleVils, menge: neueTage, einheit: 'Stück', preis: 100, label: 'Reisekostenpauschale (Vils, 100 € je Tag)' })
      } else {
        positionen.push({ typ: 'POSITION', position_id: ARTIKEL.aufwand, menge: neueTage, einheit: 'Stück', label: 'Aufwandspauschale' })
      }
    }

    const hotel = r2(b.tage.reduce((s, x) => s + (Number(x.hotelkosten) || 0), 0))
    if (hotel > 0) positionen.push({ typ: 'POSITION', position_id: ARTIKEL.hotel, menge: 1, einheit: 'Stück', preis: hotel, label: 'Kosten Hotel' })

    for (const teil of b.ersatzteile) {
      const pid = teil.easybill_position_id
      if (pid) positionen.push({ typ: 'POSITION', position_id: Number(pid), menge: teil.menge || 1, einheit: 'Stück', label: `${teil.bezeichnung}${teil.id_nummer ? ' ' + teil.id_nummer : ''}` })
      else offeneTeile.push({ teil, bericht: b })
    }

    if (b.tage.some((x) => istSamstag(x.datum) || istSonnOderFeiertag(x.datum)) && tk === 'sonst') {
      warnungen.push(`${b.bericht_nummer}: Wochenend-/Feiertagsstunden von ${techName} – bitte Zuschlag in easybill prüfen.`)
    }
  }

  const tage = [...new Set(alleDaten)].sort()
  const maschinen = [...new Set(sortiert.map((b) => b.machine?.bezeichnung).filter(Boolean) as string[])]
  const plan: Rechnungsplan = {
    auftrag_id: order.id,
    titel: `Auftrag ${order.id} - Servicebericht ${sortiert.map((b) => b.bericht_nummer).join(' / ')}`,
    text_prefix: TEXT_PREFIX_STANDARD + kopfblock(order, einsatzText(tage), maschinen),
    text: TEXT_SCHLUSS,
    leistung_von: tage[0] || '',
    leistung_bis: tage[tage.length - 1] || '',
    positionen,
    bericht_ids: sortiert.map((b) => b.id),
  }
  return { plan, warnungen, offeneTeile, berichte: sortiert }
}

/** Ruft die Serverfunktion auf; Fehlermeldungen kommen als deutscher Text zurück. */
export async function easybillAufruf<T = Record<string, unknown>>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('easybill-rechnung', { body })
  if (error) {
    let text = error.message
    try {
      const b = await (error as { context?: Response }).context?.json()
      if (b?.fehler) text = b.fehler
    } catch { /* Body war kein JSON */ }
    throw new Error(text)
  }
  if (data?.fehler) throw new Error(data.fehler)
  return data as T
}

export function pdfDateiname(bericht: Servicebericht, machine: Machine | null): string {
  const m = (machine?.bezeichnung || '').replace(/[^A-Za-z0-9]+/g, '')
  return `Servicebericht_${bericht.bericht_nummer}${m ? '_' + m : ''}.pdf`
}
