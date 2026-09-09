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
}

function buildDaySegments(tag: ServiceberichtTag): Segment[] {
  const segs: Segment[] = []
  if (tag.hinreise_von && tag.arbeitsbeginn) segs.push({ type: 'reise', start: timeToMin(tag.hinreise_von)!, end: timeToMin(tag.arbeitsbeginn)! })
  if (tag.arbeitsbeginn && tag.arbeitsende) segs.push({ type: 'arbeit', start: timeToMin(tag.arbeitsbeginn)!, end: timeToMin(tag.arbeitsende)! })
  if (tag.arbeitsende && tag.rueckreise_bis) segs.push({ type: 'reise', start: timeToMin(tag.arbeitsende)!, end: timeToMin(tag.rueckreise_bis)! })
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
    if (s.start < oStart) result.push({ type: s.type, start: s.start, end: oStart })
    if (oEnd < s.end) result.push({ type: s.type, start: oEnd, end: s.end })
  }
  return result
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

export function calcDay(tag: ServiceberichtTag): DayTotals {
  const segs = subtractPause(buildDaySegments(tag), tag.pause_von, tag.pause_bis).sort((a, b) => a.start - b.start)
  const t = { reiseNormal: 0, reiseZuschlag50: 0, reiseZuschlag100: 0, arbeitNormal: 0, arbeitZuschlag50: 0, arbeitZuschlag100: 0 }
  let cumulative = 0

  if (istSonnOderFeiertag(tag.datum)) {
    // Sonn-/Feiertag: die gesamte Zeit bekommt +100% Zuschlag, die 10h-Regel gilt nicht.
    for (const s of segs) {
      const dur = s.end - s.start
      if (dur <= 0) continue
      if (s.type === 'reise') t.reiseZuschlag100 += dur; else t.arbeitZuschlag100 += dur
      cumulative += dur
    }
  } else if (istSamstag(tag.datum)) {
    // Samstag: die gesamte Zeit bekommt pauschal +50% Zuschlag.
    for (const s of segs) {
      const dur = s.end - s.start
      if (dur <= 0) continue
      if (s.type === 'reise') t.reiseZuschlag50 += dur; else t.arbeitZuschlag50 += dur
      cumulative += dur
    }
  } else {
    for (const s of segs) {
      const dur = s.end - s.start
      if (dur <= 0) continue
      if (cumulative >= THRESHOLD_MIN) {
        if (s.type === 'reise') t.reiseZuschlag50 += dur; else t.arbeitZuschlag50 += dur
      } else if (cumulative + dur <= THRESHOLD_MIN) {
        if (s.type === 'reise') t.reiseNormal += dur; else t.arbeitNormal += dur
      } else {
        const normalPart = THRESHOLD_MIN - cumulative, zuschlagPart = dur - normalPart
        if (s.type === 'reise') { t.reiseNormal += normalPart; t.reiseZuschlag50 += zuschlagPart }
        else { t.arbeitNormal += normalPart; t.arbeitZuschlag50 += zuschlagPart }
      }
      cumulative += dur
    }
  }

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
