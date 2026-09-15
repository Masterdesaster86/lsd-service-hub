// Zeit-, Überstunden- und Spesenlogik — 1:1 aus dem HTML-Prototyp übernommen.
import type { ServiceberichtTag } from './types'

export const WOCHENTAGE = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa']

export function parseISO(dateStr: string | null): Date | null {
  if (!dateStr) return null
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function formatDMY(dateObj: Date): string {
  return `${String(dateObj.getDate()).padStart(2, '0')}.${String(dateObj.getMonth() + 1).padStart(2, '0')}.${dateObj.getFullYear()}`
}

export function formatISO(dateObj: Date): string {
  return `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`
}

export function addDays(dateObj: Date, n: number): Date {
  const d = new Date(dateObj)
  d.setDate(d.getDate() + n)
  return d
}

const timeToMin = (t: string | null | undefined) => {
  if (!t) return null
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

// Gesetzliche Feiertage Bayern (Firmensitz Füssen) — jährlich zu pflegen.
// TODO: auf eine Feiertagsbibliothek/-formel umstellen, sobald mehrere Jahre laufen.
const FEIERTAGE: Record<number, string[]> = {
  2026: ['2026-01-01', '2026-01-06', '2026-04-03', '2026-04-06', '2026-05-01', '2026-05-14', '2026-05-25', '2026-06-04', '2026-08-15', '2026-10-03', '2026-11-01', '2026-12-25', '2026-12-26'],
}

export function istSonnOderFeiertag(datumStr: string | null): boolean {
  if (!datumStr) return false
  const jahr = Number(datumStr.slice(0, 4))
  if (FEIERTAGE[jahr]?.includes(datumStr)) return true
  const d = parseISO(datumStr)
  return d ? d.getDay() === 0 : false
}

export function istSamstag(datumStr: string | null): boolean {
  if (!datumStr) return false
  const d = parseISO(datumStr)
  return d ? d.getDay() === 6 : false
}

interface Segment {
  type: 'reise' | 'arbeit'
  start: number
  end: number
  // ID der servicebericht_tage-Zeile, aus der dieses Segment stammt. Damit
  // lässt sich das Ergebnis nach der gemeinsamen Berechnung wieder auf den
  // richtigen Servicebericht zurückverteilen (siehe verteileSegmente).
  quelle: string
}

function buildDaySegments(tag: ServiceberichtTag): Segment[] {
  const segs: Segment[] = []
  if (tag.hinreise_von && tag.arbeitsbeginn) segs.push({ type: 'reise', start: timeToMin(tag.hinreise_von)!, end: timeToMin(tag.arbeitsbeginn)!, quelle: tag.id })
  if (tag.arbeitsbeginn && tag.arbeitsende) segs.push({ type: 'arbeit', start: timeToMin(tag.arbeitsbeginn)!, end: timeToMin(tag.arbeitsende)!, quelle: tag.id })
  if (tag.arbeitsende && tag.rueckreise_bis) segs.push({ type: 'reise', start: timeToMin(tag.arbeitsende)!, end: timeToMin(tag.rueckreise_bis)!, quelle: tag.id })
  return segs.filter((s) => s.end > s.start).sort((a, b) => a.start - b.start)
}

function subtractPause(segs: Segment[], pauseVon: string | null | undefined, pauseBis: string | null | undefined): Segment[] {
  if (!pauseVon || !pauseBis) return segs
  const pStart = timeToMin(pauseVon)!, pEnd = timeToMin(pauseBis)!
  if (pEnd <= pStart) return segs
  const result: Segment[] = []
  for (const s of segs) {
    const oStart = Math.max(s.start, pStart), oEnd = Math.min(s.end, pEnd)
    if (oStart >= oEnd) { result.push(s); continue }
    if (s.start < oStart) result.push({ type: s.type, start: s.start, end: oStart, quelle: s.quelle })
    if (oEnd < s.end) result.push({ type: s.type, start: oEnd, end: s.end, quelle: s.quelle })
  }
  return result
}

/** Baut aus MEHREREN Tag-Zeilen, die denselben echten Kalendertag betreffen
 * (z.B. weil an einem Tag mehrere Maschinen = mehrere Serviceberichte
 * bearbeitet wurden), einen gemeinsamen, chronologisch sortierten Zeitstrahl. */
function buildKombinierteSegmente(tageAmTag: ServiceberichtTag[]): Segment[] {
  return tageAmTag
    .flatMap((tag) => subtractPause(buildDaySegments(tag), tag.pause_von, tag.pause_bis))
    .sort((a, b) => a.start - b.start)
}

const THRESHOLD_MIN = 600 // 10h

export interface DayTotals {
  reiseNormal: number
  reiseZuschlag50: number
  reiseZuschlag100: number
  arbeitNormal: number
  arbeitZuschlag50: number
  arbeitZuschlag100: number
  gesamt: number
}

type RohTotals = { reiseNormal: number; reiseZuschlag50: number; reiseZuschlag100: number; arbeitNormal: number; arbeitZuschlag50: number; arbeitZuschlag100: number }

function leereRohTotals(): RohTotals {
  return { reiseNormal: 0, reiseZuschlag50: 0, reiseZuschlag100: 0, arbeitNormal: 0, arbeitZuschlag50: 0, arbeitZuschlag100: 0 }
}

function rundeDayTotals(t: RohTotals): DayTotals {
  const gesamt = t.reiseNormal + t.reiseZuschlag50 + t.reiseZuschlag100 + t.arbeitNormal + t.arbeitZuschlag50 + t.arbeitZuschlag100
  return {
    reiseNormal: t.reiseNormal / 60,
    reiseZuschlag50: t.reiseZuschlag50 / 60,
    reiseZuschlag100: t.reiseZuschlag100 / 60,
    arbeitNormal: t.arbeitNormal / 60,
    arbeitZuschlag50: t.arbeitZuschlag50 / 60,
    arbeitZuschlag100: t.arbeitZuschlag100 / 60,
    gesamt: gesamt / 60,
  }
}

/**
 * Wendet die 10h-Überstundenschwelle EINMAL auf den gesamten übergebenen
 * Zeitstrahl an (wichtig: `segs` sollte alle Segmente eines echten
 * Kalendertages enthalten, auch wenn die aus mehreren Serviceberichten
 * stammen — sonst fängt jeder Bericht fälschlich wieder bei Stunde 0 an).
 * Rechnet danach pro `quelle` zurück, wie viel Normal-/Zuschlagzeit auf sie
 * entfällt, plus die Summe über alle Quellen.
 */
function verteileSegmente(segs: Segment[], datum: string): { proQuelle: Map<string, RohTotals>; gesamt: RohTotals } {
  const proQuelle = new Map<string, RohTotals>()
  const gesamt = leereRohTotals()

  function addiere(quelle: string, feld: keyof RohTotals, dur: number) {
    if (dur <= 0) return
    if (!proQuelle.has(quelle)) proQuelle.set(quelle, leereRohTotals())
    proQuelle.get(quelle)![feld] += dur
    gesamt[feld] += dur
  }

  let cumulative = 0
  const sortiert = [...segs].sort((a, b) => a.start - b.start)

  if (istSonnOderFeiertag(datum)) {
    // Sonn-/Feiertag: die gesamte Zeit bekommt +100% Zuschlag, die 10h-Regel gilt nicht.
    for (const s of sortiert) {
      const dur = s.end - s.start
      addiere(s.quelle, s.type === 'reise' ? 'reiseZuschlag100' : 'arbeitZuschlag100', dur)
      cumulative += dur
    }
  } else if (istSamstag(datum)) {
    // Samstag: die gesamte Zeit bekommt pauschal +50% Zuschlag.
    for (const s of sortiert) {
      const dur = s.end - s.start
      addiere(s.quelle, s.type === 'reise' ? 'reiseZuschlag50' : 'arbeitZuschlag50', dur)
      cumulative += dur
    }
  } else {
    for (const s of sortiert) {
      const dur = s.end - s.start
      if (dur <= 0) continue
      if (cumulative >= THRESHOLD_MIN) {
        addiere(s.quelle, s.type === 'reise' ? 'reiseZuschlag50' : 'arbeitZuschlag50', dur)
      } else if (cumulative + dur <= THRESHOLD_MIN) {
        addiere(s.quelle, s.type === 'reise' ? 'reiseNormal' : 'arbeitNormal', dur)
      } else {
        const normalPart = THRESHOLD_MIN - cumulative, zuschlagPart = dur - normalPart
        addiere(s.quelle, s.type === 'reise' ? 'reiseNormal' : 'arbeitNormal', normalPart)
        addiere(s.quelle, s.type === 'reise' ? 'reiseZuschlag50' : 'arbeitZuschlag50', zuschlagPart)
      }
      cumulative += dur
    }
  }

  return { proQuelle, gesamt }
}

/** Zeit EINES Tages einer EINZELNEN Bericht-Zeile, ohne Rücksicht auf andere
 * Serviceberichte desselben Kalendertages. Nur noch für die Live-Vorschau
 * beim Erfassen eines Tages gedacht (TagFormModal) — überall sonst bitte
 * `calcTagMitKontext` verwenden, sonst wird die 10h-Schwelle falsch pro
 * Bericht statt pro echtem Arbeitstag angewendet. */
export function calcDay(tag: ServiceberichtTag): DayTotals {
  const segs = subtractPause(buildDaySegments(tag), tag.pause_von, tag.pause_bis)
  const { gesamt } = verteileSegmente(segs, tag.datum)
  return rundeDayTotals(gesamt)
}

/**
 * Korrekte Zeit EINES bestimmten Tages (`zielTag`), unter Berücksichtigung
 * ALLER Tage, die derselbe Techniker am selben Kalendertag erfasst hat —
 * auch aus anderen Serviceberichten (z.B. weil an einem Tag mehrere
 * Maschinen bearbeitet wurden). `tageAmSelbenTag` muss `zielTag` selbst
 * enthalten. Die 10h-Schwelle wird einmal über den ganzen echten Arbeitstag
 * angewendet, das Ergebnis aber nur für `zielTag` zurückgegeben.
 */
export function calcTagMitKontext(zielTag: ServiceberichtTag, tageAmSelbenTag: ServiceberichtTag[]): DayTotals {
  const segs = buildKombinierteSegmente(tageAmSelbenTag)
  const { proQuelle } = verteileSegmente(segs, zielTag.datum)
  return rundeDayTotals(proQuelle.get(zielTag.id) || leereRohTotals())
}

/** @deprecated Rechnet die 10h-Schwelle pro Tag isoliert — falsch, sobald am
 * selben Kalendertag noch ein weiterer Servicebericht (z.B. andere Maschine)
 * existiert. Bitte `calcBerichtTotalsMitKontext` mit `fetchTageskontext`
 * verwenden. Nur noch als Fallback, solange irgendwo kein Kontext verfügbar ist. */
export function calcBerichtTotals(tage: ServiceberichtTag[]): DayTotals {
  const sum: DayTotals = { reiseNormal: 0, reiseZuschlag50: 0, reiseZuschlag100: 0, arbeitNormal: 0, arbeitZuschlag50: 0, arbeitZuschlag100: 0, gesamt: 0 }
  tage.forEach((tag) => {
    const d = calcDay(tag)
    sum.reiseNormal += d.reiseNormal; sum.reiseZuschlag50 += d.reiseZuschlag50; sum.reiseZuschlag100 += d.reiseZuschlag100
    sum.arbeitNormal += d.arbeitNormal; sum.arbeitZuschlag50 += d.arbeitZuschlag50; sum.arbeitZuschlag100 += d.arbeitZuschlag100
    sum.gesamt += d.gesamt
  });
  (Object.keys(sum) as (keyof DayTotals)[]).forEach((k) => { sum[k] = Math.round(sum[k] * 100) / 100 })
  return sum
}

/** Tage desselben Technikers, gruppiert nach Kalendertag (`datum`) — über
 * ALLE seine Serviceberichte hinweg. Kommt von `fetchTageskontext`. */
export type Tageskontext = Record<string, ServiceberichtTag[]>

/** Wie `calcBerichtTotals`, aber 10h-schwellenkorrekt: berücksichtigt pro Tag
 * auch die Zeiten aus anderen Serviceberichten desselben Technikers (siehe
 * `calcTagMitKontext`). `kontext` muss für jedes `datum` in `tage` mindestens
 * `tage` selbst enthalten. */
export function calcBerichtTotalsMitKontext(tage: ServiceberichtTag[], kontext: Tageskontext): DayTotals {
  const sum: DayTotals = { reiseNormal: 0, reiseZuschlag50: 0, reiseZuschlag100: 0, arbeitNormal: 0, arbeitZuschlag50: 0, arbeitZuschlag100: 0, gesamt: 0 }
  tage.forEach((tag) => {
    const d = calcTagMitKontext(tag, kontext[tag.datum] || [tag])
    sum.reiseNormal += d.reiseNormal; sum.reiseZuschlag50 += d.reiseZuschlag50; sum.reiseZuschlag100 += d.reiseZuschlag100
    sum.arbeitNormal += d.arbeitNormal; sum.arbeitZuschlag50 += d.arbeitZuschlag50; sum.arbeitZuschlag100 += d.arbeitZuschlag100
    sum.gesamt += d.gesamt
  });
  (Object.keys(sum) as (keyof DayTotals)[]).forEach((k) => { sum[k] = Math.round(sum[k] * 100) / 100 })
  return sum
}

// Verpflegungsmehraufwand — deutsche Pauschalen (Teiltag ab 8h / Volltag mit Übernachtung).
const SPESENSATZ_TEILTAG = 14
const SPESENSATZ_VOLLTAG = 28

export interface SpesenZeile {
  datum: string
  verpflegung: number
  hotelkosten: number
  uebernachtung: boolean
}

export function calcTagesspesen(tage: ServiceberichtTag[]): SpesenZeile[] {
  return tage.map((tag, i) => {
    const d = calcDay(tag)
    const vorherUeb = i > 0 && !!tage[i - 1].uebernachtung
    const jetztUeb = !!tag.uebernachtung
    let satz = 0
    if (tage.length > 1 && (jetztUeb || vorherUeb)) {
      satz = vorherUeb && jetztUeb ? SPESENSATZ_VOLLTAG : SPESENSATZ_TEILTAG
    } else if (d.gesamt > 8) {
      satz = SPESENSATZ_TEILTAG
    }
    return { datum: tag.datum, verpflegung: satz, hotelkosten: tag.hotelkosten || 0, uebernachtung: jetztUeb }
  })
}

export function calcBerichtSpesen(tage: ServiceberichtTag[]) {
  const zeilen = calcTagesspesen(tage)
  const verpflegungGesamt = zeilen.reduce((s, z) => s + z.verpflegung, 0)
  const hotelGesamt = zeilen.reduce((s, z) => s + z.hotelkosten, 0)
  return { zeilen, verpflegungGesamt, hotelGesamt, gesamt: Math.round((verpflegungGesamt + hotelGesamt) * 100) / 100 }
}
