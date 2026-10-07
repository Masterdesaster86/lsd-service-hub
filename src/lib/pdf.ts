// PDF-Erzeugung für Servicebericht und Monats-Stundennachweis (client-seitig, jsPDF).
// Layout/Farben orientieren sich an der Firmenvorlage (servicebericht-vorlage.pdf) und
// dem LSD-Maschinenservice-Schriftzug aus dem Design-System.
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { LOGO_SCHRIFTZUG, PDF_HINTERGRUND_URL } from './branding'
import type { Ansprechpartner, Customer, Employee, Machine, Messprotokoll, Order, OrderWithRelations, Servicebericht, ServiceberichtErsatzteil, ServiceberichtTag, Wartungsprotokoll } from './types'
import { calcBerichtTotalsMitKontext, calcTagMitKontext, type DayTotals, type Tageskontext } from './zeit'
import { formatDateDE, hhmm } from './format'
import { wartendesBild } from './offline'
import { BIG_SHOULDERS_800_TTF } from '../assets/bigShouldersFont'
import {
  WARTUNG_BEMERKUNG_KEY, WARTUNG_ERGEBNIS_TEXT, WARTUNG_GRUPPEN, WARTUNG_HINWEIS, alleWartungspunkte,
  wAngebotKey, wBemerkungKey, wReparaturKey, wartungErgebnis, wartungStatus, type WartungErgebnis, type WartungStatus,
} from './wartung'
import { ERGEBNIS_KEY, MESSPROTOKOLL_TYPEN, bemerkungKey, bewerte, gewaehlteStufe, grenzeFuer, messwertZahl, skizzeUrl, type Messpunkt, type MessprotokollTyp } from './messprotokoll'

const GRAPHITE = '#1B1F24'
// Firmenfarben, direkt aus dem Logo entnommen
const BLAU = '#0070B8'        // Hauptton für Akzente
const BLAU_DUNKEL = '#003868' // Abschnittsüberschriften
const BLAU_HELL = '#5AB0E4'   // Text auf dunklem Grund
const INK = '#20242A'
const INK_SOFT = '#565F68'
const LINE = '#C7CBC3'

const PAGE_W = 210, PAGE_H = 297
const MARGIN = 14
const CONTENT_W = PAGE_W - MARGIN * 2

const FOOTER_TEXT = 'Simon Dirr und Manuel Lautenbacher GbR · Oblisbergstrasse 19 · DE-87629 Füssen · +49 8362 9267544 · info@LSD-Maschinenservice.de'
const AGB_TEXT = 'Die Berechnung und Durchführung der Leistungen erfolgt nach unseren aktuellen AGB. Techniker und Kunde bestätigen mit ihrer Unterschrift die Richtigkeit der oben aufgeführten Angaben. AGB auf Anfrage oder unter www.lsd-maschinenservice.de/agb-s/.'

// Logo-Seitenverhältnis (Breite/Höhe) des extrahierten PNGs.
const LOGO_RATIO = 1030 / 285

const bildCache = new Map<string, Promise<string>>()

// Die eingebauten PDF-Schriften kennen nur Latin-1/WinAnsi. Ein einziges anderes
// Zeichen (z.B. ein Pfeil oder ≈) lässt jsPDF die ganze Zeile in einer Breitkodierung
// setzen: die Zeile wird auseinandergezogen und läuft über den Rand. Deshalb werden
// solche Zeichen vor dem Zeichnen ersetzt.
const ERSATZ: Record<string, string> = {
  '→': '->', '⇒': '=>', '←': '<-', '↔': '<->', '↑': '(auf)', '↓': '(ab)', '≈': '~', '≥': '>=', '≤': '<=', '≠': '!=',
  'Ω': 'Ohm', '−': '-', '‑': '-', '‐': '-', '✓': 'ok', '✔': 'ok', '✗': 'x', '✘': 'x', '×': 'x', '\u00a0': ' ', '\u202f': ' ', '\u2009': ' ',
}
const WINANSI_EXTRA = '€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ'
function pdfSicher(text: string): string {
  return text.replace(/[\u0100-\uffff]/g, (c) => {
    if (ERSATZ[c] !== undefined) return ERSATZ[c]
    if (WINANSI_EXTRA.includes(c)) return c
    const grund = c.normalize('NFKD').replace(/[\u0100-\uffff]/g, '')
    return grund || '?'
  }).replace(/[\u00a0\u202f\u2009]/g, ' ')
}
function sicher<T extends string | string[]>(t: T): T {
  return (Array.isArray(t) ? t.map(pdfSicher) : pdfSicher(t as string)) as T
}

/** Neues A4-Dokument, dessen Texte vor dem Zeichnen auf druckbare Zeichen geprüft werden
 * (gilt auch für Tabellen, die intern doc.text aufrufen). */
function neuesPdf(): jsPDF {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true })
  const text = doc.text.bind(doc) as (...a: unknown[]) => jsPDF
  const teilen = doc.splitTextToSize.bind(doc) as (...a: unknown[]) => string[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(doc as any).text = (t: string | string[], ...rest: unknown[]) => text(sicher(t), ...rest)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(doc as any).splitTextToSize = (t: string | string[], ...rest: unknown[]) => teilen(sicher(t), ...rest)
  return doc
}
/** Logo verkleinert (640 px breit) als PNG mit Transparenz. Das Original (1030 px) legte
 * jsPDF unkomprimiert ab — über 1 MB pro PDF. Beim Einfügen zusätzlich 'FAST' (deflate). */
let logoPromise: Promise<string> | null = null
function logoAlsDataUrl(): Promise<string> {
  if (!logoPromise) {
    logoPromise = new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => {
        const breite = Math.min(640, img.naturalWidth)
        const hoehe = Math.round(breite * (img.naturalHeight / img.naturalWidth))
        const canvas = document.createElement('canvas')
        canvas.width = breite
        canvas.height = hoehe
        const ctx = canvas.getContext('2d')
        if (!ctx) return reject(new Error('Canvas nicht verfügbar'))
        ctx.drawImage(img, 0, 0, breite, hoehe)
        resolve(canvas.toDataURL('image/png'))
      }
      img.onerror = () => reject(new Error('Logo konnte nicht geladen werden'))
      img.src = LOGO_SCHRIFTZUG
    })
  }
  return logoPromise
}

function bildAlsDataUrl(url: string): Promise<string> {
  let vorhanden = bildCache.get(url)
  if (!vorhanden) {
    vorhanden = fetch(url)
      .then((res) => res.blob())
      .then((blob) => new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onloadend = () => resolve(reader.result as string)
        reader.onerror = reject
        reader.readAsDataURL(blob)
      }))
    bildCache.set(url, vorhanden)
  }
  return vorhanden
}

/** Werkfoto als Seitenhintergrund. Das Bild ist bereits aufgehellt und läuft
 * nach oben hin transparent aus, damit Text und Tabellen lesbar bleiben. */
function addHintergrund(doc: jsPDF, hintergrund: string) {
  doc.addImage(hintergrund, 'JPEG', 0, 0, PAGE_W, PAGE_H)
}

function setupPage(doc: jsPDF, hintergrund: string) {
  addHintergrund(doc, hintergrund)
  doc.internal.events.subscribe('addPage', () => addHintergrund(doc, hintergrund))
}

/** Heller, ruhiger Kopfbereich: schmaler Akzentstreifen oben, Titel mit
 * blauem Unterstrich, Logo rechts auf hellem Grund (dort hat es den vollen
 * Kontrast — auf dunklem Balken gingen die dunklen Logoteile unter).
 * `felder` sind beschriftete Kennnummern, z.B. Auftrags- und Berichtsnummer.
 * Gibt die Y-Position zurück, an der der Inhalt beginnen kann. */
function drawHeader(doc: jsPDF, logo: string, title: string, felder: [string, string][], zusatz?: string): number {
  doc.setFillColor(GRAPHITE)
  doc.rect(0, 0, PAGE_W, 2.6, 'F')
  doc.setFillColor(BLAU)
  doc.rect(0, 0, 58, 2.6, 'F')

  doc.setTextColor(GRAPHITE)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(17)
  doc.setCharSpace(0.7)
  doc.text(title, MARGIN, 15)
  doc.setCharSpace(0)

  doc.setFillColor(BLAU)
  doc.rect(MARGIN, 17.6, 22, 1.2, 'F')

  felder.forEach(([label, wert], i) => {
    const x = MARGIN + i * 54
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.setTextColor(INK_SOFT)
    doc.text(label.toUpperCase(), x, 24)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12.5)
    doc.setTextColor(GRAPHITE)
    doc.text(wert, x, 29.5)
  })

  const logoH = 11.5, logoW = logoH * LOGO_RATIO
  doc.addImage(logo, 'PNG', PAGE_W - MARGIN - logoW, 9.2, logoW, logoH, undefined, 'FAST')

  if (zusatz) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8.5)
    doc.setTextColor(INK_SOFT)
    doc.text(zusatz, PAGE_W - MARGIN, 27.5, { align: 'right' })
  }

  doc.setDrawColor(LINE)
  doc.setLineWidth(0.3)
  doc.line(MARGIN, 33.5, PAGE_W - MARGIN, 33.5)
  doc.setLineWidth(0.2)

  doc.setTextColor(INK)
  doc.setFont('helvetica', 'normal')
  return 40
}

function drawFooterAndPageNumbers(doc: jsPDF) {
  const pages = doc.getNumberOfPages()
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i)
    doc.setFontSize(7)
    doc.setTextColor(INK_SOFT)
    doc.text(FOOTER_TEXT, PAGE_W / 2, 292, { align: 'center' })
    if (pages > 1) doc.text(`Seite ${i} / ${pages}`, PAGE_W - MARGIN, 292, { align: 'right' })
  }
}

function sectionTitle(doc: jsPDF, text: string, y: number): number {
  doc.setFontSize(9.5)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(BLAU_DUNKEL)
  doc.text(text.toUpperCase(), MARGIN, y)
  doc.setTextColor(INK)
  doc.setFont('helvetica', 'normal')
  return y + 4.5
}

/** Bordered box with a wrapped text paragraph; returns the new Y. */
function textBox(doc: jsPDF, y: number, text: string, minHeight = 12): number {
  doc.setFontSize(9.5)
  const lines = doc.splitTextToSize(text || '–', CONTENT_W - 6)
  const h = Math.max(minHeight, lines.length * 4 + 4)
  doc.setDrawColor(LINE)
  doc.rect(MARGIN, y, CONTENT_W, h)
  doc.setTextColor(INK)
  doc.text(lines, MARGIN + 3, y + 4.8)
  return y + h + 4
}

/** Dreispaltiges Label/Wert-Raster für Stammdaten. Leere [label,value]-Paare
 * werden übersprungen. Werte dürfen Zeilenumbrüche enthalten: die erste Zeile
 * steht kräftig, weitere Zeilen (z.B. Telefon, E-Mail) etwas kleiner darunter. */
function fieldRow(doc: jsPDF, y: number, fields: [string, string][]): number {
  const colW = CONTENT_W / fields.length
  let maxZeilen = 1
  fields.forEach(([label, value], i) => {
    if (!label && !value) return
    const x = MARGIN + i * colW
    doc.setFontSize(7)
    doc.setTextColor(INK_SOFT)
    doc.text(label.toUpperCase(), x, y)
    doc.setTextColor(INK)

    let zeile = 0
    ;(value || '–').split('\n').forEach((absatz, idx) => {
      const istErste = idx === 0
      doc.setFont('helvetica', istErste ? 'bold' : 'normal')
      doc.setFontSize(istErste ? 10 : 9)
      const teile = doc.splitTextToSize(absatz, colW - 4)
      doc.text(teile, x, y + 4.5 + zeile * 4)
      zeile += teile.length
    })
    maxZeilen = Math.max(maxZeilen, zeile)
    doc.setFont('helvetica', 'normal')
  })
  return y + 4.5 + maxZeilen * 4 + 2
}

/** Straße und Ort untereinander statt in einer Zeile. */
function adresseMehrzeilig(kunde: Customer | null | undefined): string {
  if (!kunde) return '–'
  const ort = `${kunde.plz ?? ''} ${kunde.ort ?? ''}`.trim()
  return [kunde.strasse, ort].filter(Boolean).join('\n') || '–'
}

/** Name, Telefon und E-Mail untereinander. */
function ansprechpartnerMehrzeilig(ap: Ansprechpartner | null | undefined): string {
  if (!ap) return '–'
  return [ap.name, ap.telefon, ap.email].filter(Boolean).join('\n')
}

function divider(doc: jsPDF, y: number): number {
  doc.setDrawColor(LINE)
  doc.line(MARGIN, y, PAGE_W - MARGIN, y)
  return y + 3.5
}

function ensureSpace(doc: jsPDF, y: number, needed: number): number {
  if (y + needed > 278) {
    doc.addPage()
    return 14
  }
  return y
}

export interface BerichtPdfInput {
  bericht: Servicebericht
  tage: ServiceberichtTag[]
  tageskontext: Tageskontext
  ersatzteile: ServiceberichtErsatzteil[]
  machine: Machine | undefined
  techniker: Employee | undefined
  order: OrderWithRelations
  technikerSignatureDataUrl?: string | null
  kundeSignatureDataUrl?: string | null
}

export async function buildBerichtPdf(input: BerichtPdfInput): Promise<jsPDF> {
  const { bericht, tage, tageskontext, ersatzteile, machine, techniker, order } = input
  const [logo, hintergrund] = await Promise.all([logoAlsDataUrl(), bildAlsDataUrl(PDF_HINTERGRUND_URL)])
  const doc = neuesPdf()
  const totals = calcBerichtTotalsMitKontext(tage, tageskontext)

  setupPage(doc, hintergrund)
  let y = drawHeader(doc, logo, 'SERVICEBERICHT', [
    ['Auftragsnummer', `#${order.id}`],
    ['Servicebericht-Nr.', bericht.bericht_nummer],
  ])

  y = fieldRow(doc, y, [
    ['Auftraggeber', order.auftraggeber?.name || '–'],
    ['Einsatzkunde', order.einsatzkunde?.name || '–'],
    ['Techniker', techniker?.name || '–'],
  ])
  y = fieldRow(doc, y, [
    ['Adresse', adresseMehrzeilig(order.einsatzkunde)],
    ['Ansprechpartner', ansprechpartnerMehrzeilig(order.ansprechpartner)],
    ['Einsatzbeginn (geplant)', formatDateDE(order.einsatzbeginn)],
  ])
  y = divider(doc, y)
  y = fieldRow(doc, y, [
    ['Maschine', machine?.bezeichnung || bericht.maschine_id],
    ['', ''],
    ['Bestellnummer', order.bestellnummer || '–'],
  ])
  y = fieldRow(doc, y, [
    ['Maschinennummer', machine?.nummer || '–'],
    ['Kunden-Maschinennr.', machine?.kunden_maschinennummer || '–'],
    ['Steuerung', machine?.steuerung || '–'],
  ])
  y = divider(doc, y)
  y = fieldRow(doc, y, [
    ['Betriebsstunden (Bericht)', bericht.betriebsstunden != null ? `${bericht.betriebsstunden} h` : '–'],
    ['Spindelstunden (Bericht)', bericht.spindelstunden != null ? `${bericht.spindelstunden} h` : '–'],
    ['', ''],
  ])
  y = sectionTitle(doc, 'Fehlerbeschreibung', y)
  y = textBox(doc, y, bericht.fehlerbeschreibung || '–', 9)

  y = ensureSpace(doc, y, 26)
  y = sectionTitle(doc, 'Durchgeführte Arbeiten', y)
  y = textBox(doc, y, bericht.durchgefuehrte_arbeiten || '–', 13)

  if (bericht.empfehlung) {
    y = ensureSpace(doc, y, 18)
    y = sectionTitle(doc, 'Empfehlung', y)
    y = textBox(doc, y, bericht.empfehlung, 9)
  }

  if (tage.length) {
    y = ensureSpace(doc, y, 24)
    y = sectionTitle(doc, 'Zeiterfassung', y)
    autoTable(doc, {
      startY: y,
      margin: { left: MARGIN, right: MARGIN },
      styles: { fontSize: 8, textColor: INK, lineColor: LINE, cellPadding: 2 },
      headStyles: { fillColor: GRAPHITE, textColor: '#ffffff' },
      head: [['Datum', 'Hinreise ab', 'Arbeit von–bis', 'Rückreise bis', 'Pause', 'Reise', 'Arbeit']],
      body: tage.map((t) => {
        const d = calcTagMitKontext(t, tageskontext[t.datum] || [t])
        const reiseTxt = [
          d.reiseNormal ? `${fmt(d.reiseNormal)} h` : null,
          d.reiseZuschlag50 ? `+ ${fmt(d.reiseZuschlag50)} h à 150%` : null,
          d.reiseZuschlag100 ? `+ ${fmt(d.reiseZuschlag100)} h à 200%` : null,
        ].filter(Boolean).join('\n') || '–'
        const arbeitTxt = [
          d.arbeitNormal ? `${fmt(d.arbeitNormal)} h` : null,
          d.arbeitZuschlag50 ? `+ ${fmt(d.arbeitZuschlag50)} h à 150%` : null,
          d.arbeitZuschlag100 ? `+ ${fmt(d.arbeitZuschlag100)} h à 200%` : null,
        ].filter(Boolean).join('\n') || '–'
        const hin = `${hhmm(t.hinreise_von) || '–'}${t.km_hin ? `\n(${t.km_hin} km)` : ''}`
        const rueck = `${hhmm(t.rueckreise_bis) || '– offen –'}${t.km_rueck ? `\n(${t.km_rueck} km)` : ''}`
        const pause = t.pause_von ? `${hhmm(t.pause_von)}–${hhmm(t.pause_bis)}` : '–'
        // Kein Emoji: die PDF-Standardschrift kann es nicht darstellen und
        // gibt stattdessen Buchstabensalat aus.
        const pauseWithUeb = t.uebernachtung ? `${pause}\nmit Übernachtung` : pause
        return [formatDateDE(t.datum), hin, `${hhmm(t.arbeitsbeginn) || '–'}–${hhmm(t.arbeitsende) || '–'}`, rueck, pauseWithUeb, reiseTxt, arbeitTxt]
      }),
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    y = (doc as any).lastAutoTable.finalY

    const summaryParts = [
      `${fmt(totals.reiseNormal)} h Reise normal`,
      totals.reiseZuschlag50 ? `+ ${fmt(totals.reiseZuschlag50)} h à 150%` : null,
      totals.reiseZuschlag100 ? `+ ${fmt(totals.reiseZuschlag100)} h à 200%` : null,
      `·  ${fmt(totals.arbeitNormal)} h Arbeit normal`,
      totals.arbeitZuschlag50 ? `+ ${fmt(totals.arbeitZuschlag50)} h à 150%` : null,
      totals.arbeitZuschlag100 ? `+ ${fmt(totals.arbeitZuschlag100)} h à 200%` : null,
      `·  ${fmt(totals.gesamt)} h gesamt`,
    ].filter(Boolean).join(' ')
    doc.setFillColor(GRAPHITE)
    doc.rect(MARGIN, y, CONTENT_W, 8, 'F')
    doc.setTextColor(BLAU_HELL)
    doc.setFontSize(8.5)
    doc.setFont('helvetica', 'bold')
    doc.text(`Gesamt: ${summaryParts}`, MARGIN + 3, y + 5.3)
    doc.setFont('helvetica', 'normal')
    y += 11
  }

  y = ensureSpace(doc, y, 20)
  y = sectionTitle(doc, 'Ersatzteile', y)
  if (ersatzteile.length) {
    autoTable(doc, {
      startY: y,
      margin: { left: MARGIN, right: MARGIN },
      styles: { fontSize: 8.5, textColor: INK, lineColor: LINE },
      headStyles: { fillColor: GRAPHITE, textColor: '#ffffff' },
      head: [['ID-Nummer', 'Bezeichnung', 'Menge']],
      body: ersatzteile.map((t) => [t.id_nummer || '–', t.bezeichnung, String(t.menge)]),
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    y = (doc as any).lastAutoTable.finalY + 6
  } else {
    doc.setFontSize(9); doc.setTextColor(INK_SOFT)
    doc.text('Keine Ersatzteile erfasst.', MARGIN, y)
    y += 6
  }

  y = ensureSpace(doc, y, 50)
  doc.setFontSize(7.5)
  doc.setTextColor(INK_SOFT)
  const agbLines = doc.splitTextToSize(AGB_TEXT, CONTENT_W)
  doc.text(agbLines, MARGIN, y)
  y += agbLines.length * 3.2 + 6

  const sigW = (CONTENT_W - 10) / 2, sigH = 20
  doc.setDrawColor(LINE)
  doc.rect(MARGIN, y, sigW, sigH)
  doc.rect(MARGIN + sigW + 10, y, sigW, sigH)
  // Unterschrift unverzerrt ins Feld setzen (eingepasst und zentriert).
  const unterschriftEinsetzen = (dataUrl: string, x: number) => {
    const { width, height } = doc.getImageProperties(dataUrl)
    const maxW = sigW - 2, maxH = sigH - 2
    const f = Math.min(maxW / width, maxH / height)
    const w = width * f, h = height * f
    doc.addImage(dataUrl, 'PNG', x + 1 + (maxW - w) / 2, y + 1 + (maxH - h) / 2, w, h)
  }
  if (input.technikerSignatureDataUrl) unterschriftEinsetzen(input.technikerSignatureDataUrl, MARGIN)
  if (input.kundeSignatureDataUrl) unterschriftEinsetzen(input.kundeSignatureDataUrl, MARGIN + sigW + 10)
  doc.setFontSize(8)
  doc.setTextColor(INK_SOFT)
  doc.text(`Unterschrift Techniker (${techniker?.name || '–'})`, MARGIN, y + sigH + 4)
  doc.text('Unterschrift Kunde', MARGIN + sigW + 10, y + sigH + 4)
  doc.setTextColor(INK)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.text(`Abgeschlossen am: ${bericht.abgeschlossen_am ? new Date(bericht.abgeschlossen_am).toLocaleDateString('de-DE') : '–'}`, MARGIN, y + sigH + 10)
  doc.setFont('helvetica', 'normal')

  drawFooterAndPageNumbers(doc)
  return doc
}

function fmt(n: number): string {
  return (Math.round(n * 100) / 100).toString().replace('.', ',')
}

export function berichtPdfFilename(bericht: Servicebericht): string {
  return `${bericht.bericht_nummer}.pdf`
}

export function messprotokollPdfFilename(protokoll: Messprotokoll): string {
  const kurz = protokoll.id.slice(0, 8)
  return `Messprotokoll-${protokoll.auftrag_id}-${kurz}.pdf`
}

/** Skizze (PNG) als verkleinertes JPEG laden, damit das PDF klein bleibt. */
type SkizzeBild = { dataUrl: string; ratio: number }
const skizzeCache = new Map<string, Promise<SkizzeBild | null>>()
function skizzeAlsJpeg(url: string, maxBreite = 1200): Promise<SkizzeBild | null> {
  const key = `${url}@${maxBreite}`
  let vorhanden = skizzeCache.get(key)
  if (!vorhanden) {
    vorhanden = new Promise((resolve) => {
      const img = new Image()
      img.onload = () => {
        const breite = Math.min(maxBreite, img.naturalWidth)
        const hoehe = Math.round(breite * (img.naturalHeight / img.naturalWidth))
        const canvas = document.createElement('canvas')
        canvas.width = breite
        canvas.height = hoehe
        const ctx = canvas.getContext('2d')
        if (!ctx) return resolve(null)
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, breite, hoehe)
        ctx.drawImage(img, 0, 0, breite, hoehe)
        // Kleine Vorschauen dürfen stärker komprimiert sein (Strichzeichnung auf Weiß).
        resolve({ dataUrl: canvas.toDataURL('image/jpeg', maxBreite <= 600 ? 0.72 : 0.85), ratio: hoehe / breite })
      }
      img.onerror = () => resolve(null)
      img.src = url
    })
    skizzeCache.set(key, vorhanden)
  }
  return vorhanden
}

export interface MessprotokollPdfInput {
  protokoll: Messprotokoll
  order: Order | null
  machine: Machine | null
  kunde: Customer | null
  techniker: Employee | null
  abnehmer: string
  ppNummer: string
  werte: Record<string, string>
}

// --- Messprotokoll: Layout nach dem Claude-Design-Entwurf (Okt. 2026) ---------
// Dunkler Kopfblock mit Schrägkante, Ergebnis-Kasten, je Prüfpunkt ein Balken
// (gemessen gegen zulässig), Status-Marke und Skizze; Bemerkungen/Nacharbeit am Ende.

const MP = { tinte: '#14181d', papier: '#eef0ee', akzent: '#2764ad', linie: '#ccd3d2', weich: '#5b6670', hell: '#9aa7ac' }
// Spaltenbreiten der Messtabelle (Summe = CONTENT_W)
const MP_SPALTEN = { nr: 9, punkt: 70, zul: 24, ist: 15, anteil: 22, status: 24, skizze: 18 }
/** Messwerte immer mit drei Nachkommastellen (0,010 statt 0,01), wie auf dem Messgerät. */
const mm3 = (n: number) => n.toLocaleString('de-DE', { minimumFractionDigits: 3, maximumFractionDigits: 4 })
const MP_SEITENENDE = 281

function bigShouldersLaden(doc: jsPDF) {
  if (!doc.getFontList()['BigShoulders']) {
    doc.addFileToVFS('BigShoulders800.ttf', BIG_SHOULDERS_800_TTF)
    doc.addFont('BigShoulders800.ttf', 'BigShoulders', 'normal')
  }
}

/** Kleine Beschriftung in Versalien mit Sperrung (Ersatz für die Mono-Schrift des Entwurfs). */
function mpLabel(doc: jsPDF, text: string, x: number, y: number, farbe = MP.weich, groesse = 6.3, align: 'left' | 'right' = 'left') {
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(groesse)
  doc.setCharSpace(0.45)
  doc.setTextColor(farbe)
  doc.text(text.toUpperCase(), x, y, { align })
  doc.setCharSpace(0)
}

function mpAbschnitt(doc: jsPDF, text: string, y: number): number {
  doc.setFillColor(MP.akzent)
  doc.rect(MARGIN, y - 2.1, 2.2, 2.2, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.5)
  doc.setCharSpace(0.6)
  doc.setTextColor(MP.tinte)
  doc.text(text.toUpperCase(), MARGIN + 4.5, y)
  doc.setCharSpace(0)
  return y + 5
}

/** Kopfzeile der Folgeseiten. Gibt die Y-Position für den Inhalt zurück. */
function mpFolgeseite(doc: jsPDF, logo: string, zeile: string): number {
  doc.addPage()
  mpLabel(doc, zeile, MARGIN, 14, MP.weich, 6.8)
  const h = 6, w = h * LOGO_RATIO
  doc.addImage(logo, 'PNG', PAGE_W - MARGIN - w, 9.6, w, h, undefined, 'FAST')
  doc.setDrawColor(MP.linie)
  doc.setLineWidth(0.3)
  doc.line(MARGIN, 18.5, PAGE_W - MARGIN, 18.5)
  doc.setLineWidth(0.2)
  return 27
}

function mpFuss(doc: jsPDF) {
  const n = doc.getNumberOfPages()
  for (let i = 1; i <= n; i++) {
    doc.setPage(i)
    doc.setDrawColor(MP.linie)
    doc.setLineWidth(0.3)
    doc.line(MARGIN, 286.5, PAGE_W - MARGIN, 286.5)
    doc.setLineWidth(0.2)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(6.3)
    doc.setTextColor(MP.weich)
    doc.text(FOOTER_TEXT, MARGIN, 290.5)
    mpLabel(doc, `Seite ${i} / ${n}`, PAGE_W - MARGIN, 290.5, MP.weich, 6.3, 'right')
  }
}

/** Beschriftete Zellen in einer Reihe mit Rahmen; mehrzeilige Werte machen die Reihe höher. */
function mpRaster(doc: jsPDF, y: number, zellen: [string, string][]): number {
  const w = CONTENT_W / zellen.length
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8.3)
  const zeilen = zellen.map(([, wert]) => doc.splitTextToSize(wert || '–', w - 5) as string[])
  const h = 7.5 + Math.max(...zeilen.map((z) => z.length)) * 3.6
  doc.setDrawColor(MP.linie)
  doc.setLineWidth(0.3)
  doc.rect(MARGIN, y, CONTENT_W, h)
  zellen.forEach(([label], i) => {
    const x = MARGIN + i * w
    if (i > 0) doc.line(x, y, x, y + h)
    mpLabel(doc, label, x + 2.5, y + 4)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8.3)
    doc.setTextColor(MP.tinte)
    doc.text(zeilen[i], x + 2.5, y + 8.8)
  })
  doc.setLineWidth(0.2)
  return y + h
}

/** Status-Marke: gefüllt = über Toleranz, umrandet = in Ordnung, ohne Rahmen = nur erfasst. */
function mpStatus(doc: jsPDF, x: number, y: number, art: 'io' | 'nio' | 'erfasst') {
  const w = MP_SPALTEN.status - 2, h = 5
  if (art === 'nio') {
    doc.setFillColor(MP.tinte)
    doc.rect(x, y, w, h, 'F')
    doc.setFillColor('#ffffff')
    doc.triangle(x + 2.2, y + 3.6, x + 4.4, y + 3.6, x + 3.3, y + 1.5, 'F')
    mpLabel(doc, 'Über Tol.', x + 5.8, y + 3.5, '#ffffff', 5.7)
  } else if (art === 'io') {
    doc.setDrawColor(MP.linie)
    doc.rect(x, y, w, h)
    doc.setFillColor(MP.tinte)
    doc.rect(x + 2.3, y + 1.7, 1.7, 1.7, 'F')
    mpLabel(doc, 'In Ordnung', x + 5.8, y + 3.5, MP.tinte, 5.7)
  } else {
    mpLabel(doc, 'Erfasst', x, y + 3.5, MP.weich, 5.7)
  }
}

interface MpZeile {
  p: Messpunkt
  wert: string
  n: number | null
  grenze: number | null
  stufeLabel: string | null
  bewertung: ReturnType<typeof bewerte>
  bemerkung: string
  skizze: SkizzeBild | null
}

export async function buildMessprotokollPdf(input: MessprotokollPdfInput): Promise<jsPDF> {
  const { protokoll, machine, kunde, techniker, abnehmer, ppNummer, werte } = input
  const typ = protokoll.typ as MessprotokollTyp
  const typDef = MESSPROTOKOLL_TYPEN[typ]
  const logo = await logoAlsDataUrl()
  const doc = neuesPdf()
  bigShouldersLaden(doc)

  const datum = formatDateDE((protokoll.abgeschlossen_am || protokoll.erstellt_am || '').slice(0, 10))
  const maschineName = machine?.bezeichnung || protokoll.maschine_id
  const kurzzeile = `Messprotokoll · Auftrag #${protokoll.auftrag_id} · ${maschineName}${machine?.nummer ? ' · ' + machine.nummer : ''}`

  // --- Kopfblock --------------------------------------------------------------
  doc.setFillColor(MP.papier)
  doc.rect(0, 0, PAGE_W, 30, 'F')
  doc.setFillColor(MP.tinte)
  doc.rect(0, 0, 138, 30, 'F')
  doc.triangle(138, 0, 150, 0, 138, 30, 'F')
  doc.setFillColor(MP.akzent)
  doc.rect(MARGIN, 8.6, 5, 0.7, 'F')
  mpLabel(doc, 'Geometrieprüfung · Abnahme', MARGIN + 7, 9.6, MP.hell, 6.3)
  doc.setFont('BigShoulders', 'normal')
  doc.setFontSize(27)
  doc.setTextColor('#ffffff')
  doc.text('MESSPROTOKOLL', MARGIN, 20.6)
  mpLabel(doc, `Auftrag #${protokoll.auftrag_id} · ${maschineName} · ${datum}`, MARGIN, 26, '#c9d0d4', 6.8)
  const logoH = 9, logoW = logoH * LOGO_RATIO
  doc.addImage(logo, 'PNG', PAGE_W - MARGIN - logoW, 10.5, logoW, logoH, undefined, 'FAST')

  // --- Stammdaten -------------------------------------------------------------
  let y = 37
  y = mpRaster(doc, y, [
    ['Kunde', kunde?.name || '–'],
    ['Maschine', maschineName],
    ['Maschinennummer', machine?.nummer || '–'],
    ['Typ', typDef.label],
  ])
  y = mpRaster(doc, y, [
    ['Auftragsnummer', `#${protokoll.auftrag_id}`],
    ['Techniker', techniker?.name || '–'],
    ['Erstellt am', formatDateDE(protokoll.erstellt_am?.slice(0, 10))],
    ['Abgeschlossen am', protokoll.abgeschlossen_am ? formatDateDE(protokoll.abgeschlossen_am.slice(0, 10)) : '–'],
  ])
  if (ppNummer || abnehmer) {
    y = mpRaster(doc, y, [['PP-Nr.', ppNummer || '–'], ['Abnehmer', abnehmer || '–'], ['', ''], ['', '']])
  }
  y += 6

  // --- Messwerte vorbereiten --------------------------------------------------
  const gruppen = await Promise.all(typDef.gruppen.map(async (g) => {
    const zeilen = await Promise.all(g.punkte.filter((p) => (werte[p.key] || '').trim()).map(async (p): Promise<MpZeile> => {
      const url = skizzeUrl(typ, p.key)
      return {
        p,
        wert: werte[p.key].trim(),
        n: messwertZahl(werte[p.key]),
        grenze: grenzeFuer(p, werte),
        stufeLabel: gewaehlteStufe(p, werte)?.label ?? null,
        bewertung: bewerte(p, werte),
        bemerkung: (werte[bemerkungKey(p.key)] || '').trim(),
        // Kleine Vorschau (16 mm breit) — in voller Auflösung würde jede Skizze das PDF um ~80 KB vergrößern.
        skizze: url ? await skizzeAlsJpeg(url, 400) : null,
      }
    }))
    return { titel: g.titel, zeilen }
  }))
  const alle = gruppen.flatMap((g) => g.zeilen)
  const nio = alle.filter((z) => z.bewertung === 'nio')
  const nurErfasst = alle.filter((z) => z.bewertung === 'erfasst')

  // --- Ergebnis-Kasten --------------------------------------------------------
  {
    const h = 19, kastenW = 26
    doc.setFillColor(MP.tinte)
    doc.rect(MARGIN, y, kastenW, h, 'F')
    mpLabel(doc, 'Ergebnis', MARGIN + 3, y + 5, MP.hell, 6)
    doc.setFont('BigShoulders', 'normal')
    doc.setFontSize(19)
    doc.setTextColor('#ffffff')
    doc.text(alle.length ? `${nio.length} / ${alle.length}` : '–', MARGIN + 3, y + 15.2)
    doc.setDrawColor(MP.tinte)
    doc.setLineWidth(0.5)
    doc.rect(MARGIN, y, CONTENT_W, h)
    doc.setLineWidth(0.2)
    const tx = MARGIN + kastenW + 5
    let kopf: string, erklaerung: string
    if (!alle.length) {
      kopf = 'Keine Messwerte erfasst'
      erklaerung = 'Für dieses Protokoll wurden noch keine Werte eingetragen.'
    } else if (nio.length === 0) {
      kopf = 'Alle geprüften Werte innerhalb der zulässigen Abweichung'
      erklaerung = `${alle.length} Prüfpunkte gemessen.`
    } else {
      kopf = `${nio.length} ${nio.length === 1 ? 'Prüfpunkt' : 'Prüfpunkte'} über Toleranz: ${nio.map((z) => z.p.nr).join(', ')}`
      erklaerung = nio.length === alle.length ? '' : 'Alle übrigen Werte liegen innerhalb der zulässigen Abweichung.'
    }
    if (nurErfasst.length) erklaerung += `${erklaerung ? ' ' : ''}${nurErfasst.length} ${nurErfasst.length === 1 ? 'Wert' : 'Werte'} ohne automatische Prüfung (${nurErfasst.map((z) => z.p.nr).join(', ')}).`
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(MP.tinte)
    doc.text(doc.splitTextToSize(kopf, CONTENT_W - kastenW - 9), tx, y + 7.3)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.8)
    doc.setTextColor(MP.weich)
    doc.text(doc.splitTextToSize(erklaerung, CONTENT_W - kastenW - 9), tx, y + 12.6)
    y += h + 8
  }

  // --- Messtabellen -----------------------------------------------------------
  const S = MP_SPALTEN
  const x = {
    nr: MARGIN,
    punkt: MARGIN + S.nr,
    zul: MARGIN + S.nr + S.punkt,
    ist: MARGIN + S.nr + S.punkt + S.zul,
    anteil: MARGIN + S.nr + S.punkt + S.zul + S.ist,
    status: MARGIN + S.nr + S.punkt + S.zul + S.ist + S.anteil,
    skizze: MARGIN + S.nr + S.punkt + S.zul + S.ist + S.anteil + S.status,
  }
  const tabellenkopf = (yy: number): number => {
    mpLabel(doc, 'Nr.', x.nr, yy + 3.5)
    mpLabel(doc, 'Prüfpunkt · Prüfmittel', x.punkt, yy + 3.5)
    mpLabel(doc, 'Zulässig mm', x.zul, yy + 3.5)
    mpLabel(doc, 'Ist mm', x.ist, yy + 3.5)
    mpLabel(doc, 'Anteil', x.anteil, yy + 3.5)
    mpLabel(doc, 'Status', x.status, yy + 3.5)
    mpLabel(doc, 'Skizze', x.skizze, yy + 3.5)
    doc.setDrawColor(MP.tinte)
    doc.setLineWidth(0.4)
    doc.line(MARGIN, yy + 5.2, PAGE_W - MARGIN, yy + 5.2)
    doc.setLineWidth(0.2)
    return yy + 6.5
  }
  const BALKEN_W = 17 // Strich für "zulässig" steht am rechten Ende dieser Strecke

  let nummer = 0
  for (const g of gruppen) {
    if (!g.zeilen.length) continue
    nummer++
    if (y + 30 > MP_SEITENENDE) y = mpFolgeseite(doc, logo, kurzzeile)
    y = mpAbschnitt(doc, `${String(nummer).padStart(2, '0')} · ${g.titel}`, y + 2)
    y = tabellenkopf(y)

    for (const z of g.zeilen) {
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      const namenszeilen = doc.splitTextToSize(z.p.bezeichnung, S.punkt - 3) as string[]
      doc.setFontSize(7)
      const zulText = z.grenze !== null ? null : (doc.splitTextToSize(z.p.toleranz, S.zul - 3) as string[])
      const istText = z.n !== null && /^[\s\d.,-]+$/.test(z.wert) ? null : (doc.splitTextToSize(z.wert, S.ist - 2) as string[])
      const textH = 3 + namenszeilen.length * 3.5 + 3.2 + 2.5
      const h = Math.max(textH, z.skizze ? 13.5 : 10, zulText ? 3 + zulText.length * 3 + 2.5 : 0, istText ? 3 + istText.length * 3 + 2.5 : 0)
      if (y + h > MP_SEITENENDE) {
        y = mpFolgeseite(doc, logo, kurzzeile)
        y = tabellenkopf(y)
      }
      const mitte = y + h / 2

      // Nr.
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8)
      doc.setTextColor(MP.tinte)
      doc.text(z.p.nr, x.nr, y + 5.8)
      // Prüfpunkt und Prüfmittel
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      doc.text(namenszeilen, x.punkt, y + 5.8)
      doc.setFontSize(6.3)
      doc.setTextColor(MP.weich)
      doc.text(z.p.pruefmittel, x.punkt, y + 5.8 + namenszeilen.length * 3.5)
      // Zulässig
      doc.setTextColor(MP.tinte)
      if (z.grenze !== null) {
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(8)
        doc.text(mm3(z.grenze), x.zul + S.zul - 4, y + 5.8, { align: 'right' })
        if (z.stufeLabel) {
          doc.setFontSize(5.8)
          doc.setTextColor(MP.weich)
          doc.text(doc.splitTextToSize(z.stufeLabel, S.zul - 1), x.zul + S.zul - 4, y + 9, { align: 'right' })
        }
      } else if (zulText) {
        doc.setFontSize(7)
        doc.text(zulText, x.zul, y + 5.5)
      }
      // Ist
      doc.setTextColor(MP.tinte)
      if (istText) {
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(7)
        doc.text(istText, x.ist, y + 5.5)
      } else if (z.n !== null) {
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(8)
        doc.text(mm3(z.n), x.ist + S.ist - 4, y + 5.8, { align: 'right' })
      }
      // Anteil: Balken = gemessen, Strich = zulässig
      if (z.n !== null && z.grenze !== null && z.grenze > 0) {
        const laenge = Math.min(Math.abs(z.n) / z.grenze, 1.28) * BALKEN_W
        doc.setFillColor(z.bewertung === 'nio' ? MP.akzent : MP.tinte)
        doc.rect(x.anteil, mitte - 0.8, laenge, 1.6, 'F')
        doc.setDrawColor(MP.tinte)
        doc.setLineWidth(0.4)
        doc.line(x.anteil + BALKEN_W, mitte - 2.2, x.anteil + BALKEN_W, mitte + 2.2)
        doc.setLineWidth(0.2)
      }
      // Status
      if (z.bewertung === 'io' || z.bewertung === 'nio' || z.bewertung === 'erfasst') mpStatus(doc, x.status, mitte - 2.5, z.bewertung)
      // Skizze
      if (z.skizze) {
        const bw = S.skizze - 2, bh = 10
        const f = Math.min(bw, bh / z.skizze.ratio)
        const w = f, hh = f * z.skizze.ratio
        const bx = x.skizze + (bw - w) / 2, by = mitte - hh / 2
        doc.addImage(z.skizze.dataUrl, 'JPEG', bx, by, w, hh)
        doc.setDrawColor(MP.linie)
        doc.rect(bx, by, w, hh)
      }
      // Trennlinie
      doc.setDrawColor(MP.linie)
      doc.line(MARGIN, y + h, PAGE_W - MARGIN, y + h)
      y += h
    }
    y += 3
  }

  if (alle.length) {
    // Legende
    if (y + 8 > MP_SEITENENDE) y = mpFolgeseite(doc, logo, kurzzeile)
    doc.setDrawColor(MP.tinte)
    doc.setLineWidth(0.4)
    doc.line(MARGIN + 0.5, y + 0.6, MARGIN + 0.5, y + 3.4)
    doc.setLineWidth(0.2)
    mpLabel(doc, 'Strich = zulässige Abweichung', MARGIN + 3, y + 2.8, MP.weich, 5.8)
    doc.setFillColor(MP.tinte)
    doc.rect(MARGIN + 62, y + 1.3, 5, 1.4, 'F')
    mpLabel(doc, 'Balken = gemessener Wert', MARGIN + 69.5, y + 2.8, MP.weich, 5.8)
    y += 10
  } else {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(MP.weich)
    doc.text('Keine Messwerte erfasst.', MARGIN, y + 4)
    y += 12
  }

  // --- Bemerkungen · Nacharbeit ----------------------------------------------
  const eintraege: string[] = []
  nio.forEach((z) => {
    const ist = z.n !== null ? `${mm3(z.n)} mm` : z.wert
    const zul = z.grenze !== null ? ` bei ${mm3(z.grenze)} mm zulässig` : ''
    eintraege.push(`${z.p.nr} ${z.p.bezeichnung}: ${ist}${zul}.${z.bemerkung ? ' ' + z.bemerkung : ''}`)
  })
  alle.filter((z) => z.bewertung !== 'nio' && z.bemerkung).forEach((z) => eintraege.push(`${z.p.nr} ${z.p.bezeichnung}: ${z.bemerkung}`))
  const ergebnis = (werte[ERGEBNIS_KEY] || '').trim()
  if (ergebnis) eintraege.push(ergebnis)

  if (eintraege.length) {
    if (y + 20 > MP_SEITENENDE) y = mpFolgeseite(doc, logo, kurzzeile)
    y = mpAbschnitt(doc, 'Bemerkungen · Nacharbeit', y + 2)
    doc.setDrawColor(MP.tinte)
    doc.setLineWidth(0.4)
    doc.line(MARGIN, y - 1, PAGE_W - MARGIN, y - 1)
    doc.setLineWidth(0.2)
    for (const text of eintraege) {
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      const zeilen = doc.splitTextToSize(text, CONTENT_W - 8) as string[]
      const h = zeilen.length * 3.6 + 4.5
      if (y + h > MP_SEITENENDE) y = mpFolgeseite(doc, logo, kurzzeile)
      doc.setFillColor(MP.tinte)
      doc.rect(MARGIN, y + 3.4, 3, 0.5, 'F')
      doc.setTextColor(MP.tinte)
      doc.text(zeilen, MARGIN + 6, y + 4.6)
      doc.setDrawColor(MP.linie)
      doc.line(MARGIN, y + h, PAGE_W - MARGIN, y + h)
      y += h
    }
  }

  mpFuss(doc)
  return doc
}

// --- Wartungsprotokoll (Inspektionscheckliste) -------------------------------
// Gleiche Formensprache wie das Messprotokoll: dunkler Kopfblock, Raster, Gruppen mit
// Abschnitten, je Punkt Status, Reparatur, Ergebnis 1–3 und Angebot; am Ende Bemerkungen,
// Hinweis und die beiden Unterschriften.

export function wartungPdfFilename(protokoll: Wartungsprotokoll): string {
  return `Wartungsprotokoll-${protokoll.auftrag_id}-${protokoll.id.slice(0, 8)}.pdf`
}

export interface WartungPdfInput {
  protokoll: Wartungsprotokoll
  machine: Machine | null
  kunde: Customer | null
  techniker: Employee | null
  abnehmer: string
  werte: Record<string, string>
  technikerSignatureDataUrl?: string | null
  kundeSignatureDataUrl?: string | null
}

const WP_SPALTEN = { punkt: 100, status: 26, reparatur: 20, ergebnis: 20, angebot: 16 }

const WP_STATUS_TEXT: Record<WartungStatus, string> = { geprueft: 'Geprüft', nicht_moeglich: 'Nicht möglich', entfaellt: 'Entfällt' }

export async function buildWartungPdf(input: WartungPdfInput): Promise<jsPDF> {
  const { protokoll, machine, kunde, techniker, abnehmer, werte } = input
  const logo = await logoAlsDataUrl()
  const doc = neuesPdf()
  bigShouldersLaden(doc)

  const datum = formatDateDE((protokoll.abgeschlossen_am || protokoll.erstellt_am || '').slice(0, 10))
  const maschineName = machine?.bezeichnung || protokoll.maschine_id
  const kurzzeile = `Wartungsprotokoll · Auftrag #${protokoll.auftrag_id} · ${maschineName}${machine?.nummer ? ' · ' + machine.nummer : ''}`

  // Kopfblock
  doc.setFillColor(MP.papier)
  doc.rect(0, 0, PAGE_W, 30, 'F')
  doc.setFillColor(MP.tinte)
  doc.rect(0, 0, 138, 30, 'F')
  doc.triangle(138, 0, 150, 0, 138, 30, 'F')
  doc.setFillColor(MP.akzent)
  doc.rect(MARGIN, 8.6, 5, 0.7, 'F')
  mpLabel(doc, 'Wartung · Inspektion', MARGIN + 7, 9.6, MP.hell, 6.3)
  doc.setFont('BigShoulders', 'normal')
  doc.setFontSize(27)
  doc.setTextColor('#ffffff')
  doc.text('WARTUNGSPROTOKOLL', MARGIN, 20.6)
  mpLabel(doc, `Auftrag #${protokoll.auftrag_id} · ${maschineName} · ${datum}`, MARGIN, 26, '#c9d0d4', 6.8)
  const logoH = 9, logoW = logoH * LOGO_RATIO
  doc.addImage(logo, 'PNG', PAGE_W - MARGIN - logoW, 10.5, logoW, logoH, undefined, 'FAST')

  // Stammdaten
  let y = 37
  y = mpRaster(doc, y, [
    ['Kunde', kunde?.name || '–'],
    ['Maschine', maschineName],
    ['Maschinennummer', machine?.nummer || '–'],
    ['Auftragsnummer', `#${protokoll.auftrag_id}`],
  ])
  y = mpRaster(doc, y, [
    ['Techniker', techniker?.name || '–'],
    ['Erstellt am', formatDateDE(protokoll.erstellt_am?.slice(0, 10))],
    ['Abgeschlossen am', protokoll.abgeschlossen_am ? formatDateDE(protokoll.abgeschlossen_am.slice(0, 10)) : '–'],
    ['Abnehmer', abnehmer || '–'],
  ])
  y += 6

  // Legende
  {
    const h = 17
    doc.setDrawColor(MP.linie)
    doc.setLineWidth(0.3)
    doc.rect(MARGIN, y, CONTENT_W, h)
    doc.setLineWidth(0.2)
    mpLabel(doc, 'Ergebnis', MARGIN + 3, y + 5)
    ;(['1', '2', '3'] as WartungErgebnis[]).forEach((e, i) => {
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(7.5)
      doc.setTextColor(MP.tinte)
      doc.text(e, MARGIN + 24, y + 5 + i * 4)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(7.3)
      doc.text(WARTUNG_ERGEBNIS_TEXT[e], MARGIN + 28, y + 5 + i * 4)
    })
    y += h + 7
  }

  // Tabelle
  const S = WP_SPALTEN
  const x = {
    punkt: MARGIN,
    status: MARGIN + S.punkt,
    reparatur: MARGIN + S.punkt + S.status,
    ergebnis: MARGIN + S.punkt + S.status + S.reparatur,
    angebot: MARGIN + S.punkt + S.status + S.reparatur + S.ergebnis,
  }
  const tabellenkopf = (yy: number): number => {
    mpLabel(doc, 'Prüfpunkt', x.punkt, yy + 3.5)
    mpLabel(doc, 'Status', x.status, yy + 3.5)
    mpLabel(doc, 'Reparatur', x.reparatur, yy + 3.5)
    mpLabel(doc, 'Ergebnis', x.ergebnis, yy + 3.5)
    mpLabel(doc, 'Angebot', x.angebot, yy + 3.5)
    doc.setDrawColor(MP.tinte)
    doc.setLineWidth(0.4)
    doc.line(MARGIN, yy + 5.2, PAGE_W - MARGIN, yy + 5.2)
    doc.setLineWidth(0.2)
    return yy + 6.5
  }
  const neueSeite = () => { y = mpFolgeseite(doc, logo, kurzzeile); y = tabellenkopf(y) }

  const alle = alleWartungspunkte()
  const bearbeitet = alle.filter((p) => wartungStatus(werte, p.key))
  let nummer = 0
  for (const g of WARTUNG_GRUPPEN) {
    const inGruppe = g.abschnitte.flatMap((a) => a.punkte).filter((p) => wartungStatus(werte, p.key))
    if (!inGruppe.length) continue
    nummer++
    if (y + 26 > MP_SEITENENDE) y = mpFolgeseite(doc, logo, kurzzeile)
    y = mpAbschnitt(doc, `${String(nummer).padStart(2, '0')} · ${g.titel}`, y + 2)
    y = tabellenkopf(y)
    for (const a of g.abschnitte) {
      const punkte = a.punkte.filter((p) => wartungStatus(werte, p.key))
      if (!punkte.length) continue
      if (a.titel) {
        if (y + 12 > MP_SEITENENDE) neueSeite()
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(8)
        doc.setTextColor(MP.tinte)
        doc.text(a.titel, x.punkt, y + 4.2)
        doc.setDrawColor(MP.linie)
        doc.line(MARGIN, y + 6, PAGE_W - MARGIN, y + 6)
        y += 6
      }
      for (const p of punkte) {
        const status = wartungStatus(werte, p.key)!
        const ergebnis = wartungErgebnis(werte, p.key)
        const bemerkung = (werte[wBemerkungKey(p.key)] || '').trim()
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(8)
        const zeilen = doc.splitTextToSize(p.bezeichnung, S.punkt - 4) as string[]
        doc.setFontSize(6.8)
        const bemZeilen = bemerkung ? (doc.splitTextToSize(bemerkung, S.punkt - 6) as string[]) : []
        const h = Math.max(6.6, 2.4 + zeilen.length * 3.4 + bemZeilen.length * 3 + 1.6)
        if (y + h > MP_SEITENENDE) neueSeite()
        const mitte = y + h / 2
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(8)
        doc.setTextColor(MP.tinte)
        doc.text(zeilen, x.punkt + (a.titel ? 3 : 0), y + 4.4)
        if (bemZeilen.length) {
          doc.setFontSize(6.8)
          doc.setTextColor(MP.weich)
          doc.text(bemZeilen, x.punkt + (a.titel ? 5 : 2), y + 4.4 + zeilen.length * 3.4)
        }
        // Status
        if (status === 'geprueft') {
          doc.setFillColor(MP.tinte)
          doc.rect(x.status, mitte - 0.9, 1.8, 1.8, 'F')
        } else {
          doc.setDrawColor(MP.weich)
          doc.rect(x.status, mitte - 0.9, 1.8, 1.8)
        }
        mpLabel(doc, p.art === 'erledigt' && status === 'geprueft' ? 'Erledigt' : WP_STATUS_TEXT[status], x.status + 3.2, mitte + 1, status === 'geprueft' ? MP.tinte : MP.weich, 5.8)
        // Reparatur / Angebot
        const ja = (xx: number, an: boolean) => {
          doc.setFont('helvetica', an ? 'bold' : 'normal')
          doc.setFontSize(7)
          doc.setTextColor(an ? MP.tinte : MP.weich)
          doc.text(an ? 'JA' : '–', xx + 6, mitte + 1, { align: 'center' })
        }
        if (status === 'geprueft' && p.art !== 'erledigt') {
          ja(x.reparatur, werte[wReparaturKey(p.key)] === '1')
          ja(x.angebot, werte[wAngebotKey(p.key)] === '1')
          // Ergebnis: drei Kästchen, das gewählte gefüllt (3 in Akzentfarbe)
          ;(['1', '2', '3'] as WartungErgebnis[]).forEach((e, i) => {
            const bx = x.ergebnis + i * 4.6, by = mitte - 2, k = 3.8
            const aktiv = ergebnis === e
            if (aktiv) {
              doc.setFillColor(e === '3' ? MP.akzent : MP.tinte)
              doc.rect(bx, by, k, k, 'F')
            } else {
              doc.setDrawColor(MP.linie)
              doc.rect(bx, by, k, k)
            }
            doc.setFont('helvetica', 'bold')
            doc.setFontSize(6)
            doc.setTextColor(aktiv ? '#ffffff' : MP.linie)
            doc.text(e, bx + k / 2, by + 2.8, { align: 'center' })
          })
        } else if (status === 'geprueft') {
          doc.setFillColor(MP.tinte)
          doc.rect(x.ergebnis + 4.6, mitte - 2, 3.8, 3.8, 'F')
          doc.setFont('helvetica', 'bold')
          doc.setFontSize(6)
          doc.setTextColor('#ffffff')
          doc.text('1', x.ergebnis + 4.6 + 1.9, mitte + 0.8, { align: 'center' })
        }
        doc.setDrawColor(MP.linie)
        doc.line(MARGIN, y + h, PAGE_W - MARGIN, y + h)
        y += h
      }
    }
    y += 3
  }

  if (!bearbeitet.length) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(MP.weich)
    doc.text('Keine Prüfpunkte bearbeitet.', MARGIN, y + 4)
    y += 12
  }

  // Bemerkungen
  const eintraege: string[] = []
  bearbeitet.forEach((p) => {
    const e = wartungErgebnis(werte, p.key)
    if (e === '2' || e === '3') {
      const text = e === '2' ? 'erste Verschleißspuren, Austausch kurzfristig empfohlen' : 'Verschleißgrenze erreicht, Austausch schnellstmöglich erforderlich'
      const ort = p.abschnitt ? `${p.abschnitt}, ` : `${p.gruppe}, `
      eintraege.push(`${ort}${p.bezeichnung}: ${text}.${werte[wAngebotKey(p.key)] === '1' ? ' Angebot gewünscht.' : ''}${werte[wReparaturKey(p.key)] === '1' ? ' Reparatur / Tausch durchgeführt.' : ''}`)
    } else if (werte[wReparaturKey(p.key)] === '1' || werte[wAngebotKey(p.key)] === '1') {
      eintraege.push(`${p.abschnitt ? p.abschnitt + ', ' : ''}${p.bezeichnung}:${werte[wReparaturKey(p.key)] === '1' ? ' Reparatur / Tausch durchgeführt.' : ''}${werte[wAngebotKey(p.key)] === '1' ? ' Angebot gewünscht.' : ''}`)
    }
  })
  const bemerkung = (werte[WARTUNG_BEMERKUNG_KEY] || '').trim()
  if (bemerkung) eintraege.push(bemerkung)
  if (eintraege.length) {
    if (y + 20 > MP_SEITENENDE) y = mpFolgeseite(doc, logo, kurzzeile)
    y = mpAbschnitt(doc, 'Bemerkungen', y + 2)
    doc.setDrawColor(MP.tinte)
    doc.setLineWidth(0.4)
    doc.line(MARGIN, y - 1, PAGE_W - MARGIN, y - 1)
    doc.setLineWidth(0.2)
    for (const text of eintraege) {
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      const zeilen = doc.splitTextToSize(text, CONTENT_W - 8) as string[]
      const h = zeilen.length * 3.6 + 4.5
      if (y + h > MP_SEITENENDE) y = mpFolgeseite(doc, logo, kurzzeile)
      doc.setFillColor(MP.tinte)
      doc.rect(MARGIN, y + 3.4, 3, 0.5, 'F')
      doc.setTextColor(MP.tinte)
      doc.text(zeilen, MARGIN + 6, y + 4.6)
      doc.setDrawColor(MP.linie)
      doc.line(MARGIN, y + h, PAGE_W - MARGIN, y + h)
      y += h
    }
  }

  // Hinweis
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(6.8)
  const hinweis = doc.splitTextToSize(WARTUNG_HINWEIS, CONTENT_W - 16) as string[]
  if (y + hinweis.length * 3 + 8 > MP_SEITENENDE) y = mpFolgeseite(doc, logo, kurzzeile)
  y += 5
  mpLabel(doc, 'Hinweis', MARGIN, y + 2.6, MP.tinte, 6)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(6.8)
  doc.setTextColor(MP.weich)
  doc.text(hinweis, MARGIN + 16, y + 2.6)
  y += hinweis.length * 3 + 6

  // Unterschriften
  const sigH = 20
  if (y + sigH + 18 > MP_SEITENENDE) y = mpFolgeseite(doc, logo, kurzzeile)
  y += 4
  const spalteW = (CONTENT_W - 10) / 2
  const abgeschlossen = protokoll.abgeschlossen_am ? new Date(protokoll.abgeschlossen_am) : null
  const zeitText = abgeschlossen ? `${formatDateDE(protokoll.abgeschlossen_am!.slice(0, 10))} · ${abgeschlossen.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}` : ''
  const unterschrift = (xx: number, bild: string | null | undefined, rolle: string, name: string) => {
    if (bild) {
      const { width, height } = doc.getImageProperties(bild)
      const f = Math.min((spalteW - 4) / width, sigH / height)
      doc.addImage(bild, 'PNG', xx + 2, y + sigH - height * f, width * f, height * f)
    }
    doc.setDrawColor(MP.tinte)
    doc.setLineWidth(0.4)
    doc.line(xx, y + sigH + 1, xx + spalteW, y + sigH + 1)
    doc.setLineWidth(0.2)
    mpLabel(doc, `${rolle} · ${name || '–'}`, xx, y + sigH + 5)
    if (bild && zeitText) mpLabel(doc, `Digital signiert · ${zeitText}`, xx, y + sigH + 8.5, MP.weich, 5.6)
  }
  unterschrift(MARGIN, input.technikerSignatureDataUrl, 'Techniker', techniker?.name || '')
  unterschrift(MARGIN + spalteW + 10, input.kundeSignatureDataUrl, 'Auftraggeber', [kunde?.name, abnehmer].filter(Boolean).join(' · '))

  mpFuss(doc)
  return doc
}

export function pdfToFile(doc: jsPDF, filename: string): File {
  return new File([doc.output('blob')], filename, { type: 'application/pdf' })
}

export type ShareResult = 'shared' | 'unsupported' | 'cancelled' | 'error'

/**
 * Öffnet den geräteeigenen "Teilen"-Dialog (iPad/Handy: Mail, AirDrop, WhatsApp, ...) mit dem
 * PDF im Anhang. So kann der Techniker den Bericht direkt vor Ort per Mail an den Kunden schicken,
 * ohne dass wir selbst einen E-Mail-Versand betreiben müssen. Auf Geräten/Browsern ohne
 * Unterstützung (v.a. Desktop) wird 'unsupported' zurückgegeben.
 */
export async function sharePdf(doc: jsPDF, filename: string, title: string, text: string): Promise<ShareResult> {
  const file = pdfToFile(doc, filename)
  const nav = navigator as Navigator & { canShare?: (data: ShareData) => boolean }
  if (!nav.canShare || !nav.canShare({ files: [file] })) return 'unsupported'
  try {
    await navigator.share({ files: [file], title, text })
    return 'shared'
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') return 'cancelled'
    return 'error'
  }
}

/** Lädt eine öffentliche Storage-URL (z.B. Unterschrift) und wandelt sie in eine data:-URL um. */
export async function urlToDataUrl(url: string): Promise<string> {
  // Offline unterschrieben und noch nicht hochgeladen: Bild direkt vom Gerät nehmen.
  const blob = (await wartendesBild(url)) ?? await (await fetch(url)).blob()
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

export interface NachweisZeile {
  datum: string
  auftrag: string
  maschine: string
  d: DayTotals
  verpflegung: number
  hotelkosten: number
}

export async function buildNachweisPdf(args: {
  technikerName: string
  monatLabel: string
  zeilen: NachweisZeile[]
  sum: { arbeitNormal: number; arbeitUeber: number; arbeitSamstag: number; arbeitZuschlag100: number; reiseNormal: number; reiseUeber: number; reiseSamstag: number; reiseZuschlag100: number; verpflegung: number; hotel: number }
  /** Überstundenregel des Mitarbeiters: ab `ab` Stunden pro Werktag `prozent` % Zuschlag. */
  regel: { ab: number; prozent: number }
  fehltage: { krank: number; schulung: number; kurzarbeit: number; urlaub: number }
}): Promise<jsPDF> {
  const { technikerName, monatLabel, zeilen, sum, regel, fehltage } = args
  const [logo, hintergrund] = await Promise.all([logoAlsDataUrl(), bildAlsDataUrl(PDF_HINTERGRUND_URL)])
  const doc = neuesPdf()
  setupPage(doc, hintergrund)
  let y = drawHeader(doc, logo, 'STUNDENNACHWEIS', [['Zeitraum', monatLabel]], technikerName)
  y = sectionTitle(doc, 'Erfasste Tage', y)

  autoTable(doc, {
    startY: y,
    margin: { left: MARGIN, right: MARGIN },
    styles: { fontSize: 8, textColor: INK, lineColor: LINE },
    headStyles: { fillColor: GRAPHITE, textColor: '#ffffff' },
    head: [['Datum', 'Auftrag', 'Maschine', 'Stunden', 'Spesen']],
    body: zeilen.length
      ? zeilen.map((z) => [formatDateDE(z.datum), `#${z.auftrag}`, z.maschine, `${fmt(z.d.gesamt)} h`, (z.verpflegung || z.hotelkosten) ? `${(z.verpflegung + z.hotelkosten).toFixed(2)} €` : '–'])
      : [['Keine Zeiten in diesem Monat erfasst.', '', '', '', '']],
  })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  y = (doc as any).lastAutoTable.finalY + 10

  y = ensureSpace(doc, y, 40)
  y = sectionTitle(doc, 'Zusammenfassung', y)
  autoTable(doc, {
    startY: y,
    margin: { left: MARGIN, right: MARGIN },
    styles: { fontSize: 8, textColor: INK, lineColor: LINE },
    headStyles: { fillColor: GRAPHITE, textColor: '#ffffff' },
    head: [['', 'Normal', `Überstunden +${regel.prozent} %`, 'Samstag +50 %', 'Sonn-/Feiertag +100 %']],
    body: [
      ['Arbeit', `${fmt(sum.arbeitNormal)} h`, `${fmt(sum.arbeitUeber)} h`, `${fmt(sum.arbeitSamstag)} h`, `${fmt(sum.arbeitZuschlag100)} h`],
      ['Reise', `${fmt(sum.reiseNormal)} h`, `${fmt(sum.reiseUeber)} h`, `${fmt(sum.reiseSamstag)} h`, `${fmt(sum.reiseZuschlag100)} h`],
    ],
  })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  y = (doc as any).lastAutoTable.finalY + 5
  doc.setFontSize(7.5)
  doc.setTextColor(INK_SOFT)
  doc.text(`Überstunden: werktags ab ${String(regel.ab).replace('.', ',')} Stunden pro Tag (Reise und Arbeit zusammen).`, MARGIN, y)
  y += 7

  doc.setFontSize(9)
  doc.setTextColor(INK)
  doc.text(`Verpflegungsmehraufwand: ${sum.verpflegung.toFixed(2)} €   ·   Hotelkosten: ${sum.hotel.toFixed(2)} €   ·   Spesen gesamt: ${(sum.verpflegung + sum.hotel).toFixed(2)} €`, MARGIN, y)
  y += 8
  doc.text(`Krankheitstage: ${fehltage.krank}   ·   Schulungstage: ${fehltage.schulung}   ·   Kurzarbeitstage: ${fehltage.kurzarbeit}   ·   Urlaubstage: ${fehltage.urlaub}`, MARGIN, y)
  y += 10

  drawFooterAndPageNumbers(doc)
  return doc
}
