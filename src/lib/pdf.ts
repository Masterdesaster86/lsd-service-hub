// PDF-Erzeugung für Servicebericht und Monats-Stundennachweis (client-seitig, jsPDF).
// Layout/Farben orientieren sich an der Firmenvorlage (servicebericht-vorlage.pdf) und
// dem LSD-Maschinenservice-Logo, das aus dieser Vorlage extrahiert wurde.
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { LOGO_URL, PDF_HINTERGRUND_URL } from './branding'
import type { Employee, Machine, OrderWithRelations, Servicebericht, ServiceberichtErsatzteil, ServiceberichtTag } from './types'
import { calcBerichtTotals, calcDay } from './zeit'
import { customerAddress, formatDateDE, hhmm } from './format'

const GRAPHITE = '#1B1F24'
const AMBER = '#E2A63B'
const STEEL = '#4E7A96'
const INK = '#20242A'
const INK_SOFT = '#565F68'
const LINE = '#C7CBC3'

const PAGE_W = 210, PAGE_H = 297
const MARGIN = 14
const CONTENT_W = PAGE_W - MARGIN * 2

const FOOTER_TEXT = 'Simon Dirr und Manuel Lautenbacher GbR · Oblisbergstrasse 19 · DE-87629 Füssen · +49 8362 9267544 · info@LSD-Maschinenservice.de'
const AGB_TEXT = 'Die Berechnung und Durchführung der Leistungen erfolgt nach unseren aktuellen AGB. Techniker und Kunde bestätigen mit ihrer Unterschrift die Richtigkeit der oben aufgeführten Angaben. AGB auf Anfrage oder unter www.lsd-maschinenservice.de/agb-s/.'

// Logo-Seitenverhältnis (Breite/Höhe) des extrahierten PNGs.
const LOGO_RATIO = 646 / 254

const bildCache = new Map<string, Promise<string>>()
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

function drawHeader(doc: jsPDF, logo: string, title: string, idLine: [string, string]) {
  doc.setFillColor(GRAPHITE)
  doc.rect(0, 0, PAGE_W, 28, 'F')

  doc.setTextColor('#ffffff')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(17)
  doc.text(title, MARGIN, 13)

  doc.setTextColor(AMBER)
  doc.setFontSize(13)
  doc.text(idLine[0], MARGIN, 22)
  const idWidth = doc.getTextWidth(idLine[0])
  doc.setTextColor('#C7CBC3')
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.text(idLine[1], MARGIN + idWidth + 4, 22)

  const logoH = 15, logoW = logoH * LOGO_RATIO
  doc.addImage(logo, 'PNG', PAGE_W - MARGIN - logoW, 6.5, logoW, logoH)

  doc.setTextColor(INK)
  doc.setFont('helvetica', 'normal')
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
  doc.setTextColor(STEEL)
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

/** Dreispaltiges Label/Wert-Raster für Stammdaten. Leere [label,value]-Paare werden übersprungen. */
function fieldRow(doc: jsPDF, y: number, fields: [string, string][]): number {
  const colW = CONTENT_W / fields.length
  let maxLines = 1
  fields.forEach(([label, value], i) => {
    if (!label && !value) return
    const x = MARGIN + i * colW
    doc.setFontSize(7)
    doc.setTextColor(INK_SOFT)
    doc.text(label.toUpperCase(), x, y)
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(INK)
    const lines = doc.splitTextToSize(value || '–', colW - 4)
    doc.text(lines, x, y + 4.5)
    maxLines = Math.max(maxLines, lines.length)
    doc.setFont('helvetica', 'normal')
  })
  return y + 4.5 + maxLines * 4 + 2
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
  ersatzteile: ServiceberichtErsatzteil[]
  machine: Machine | undefined
  techniker: Employee | undefined
  order: OrderWithRelations
  technikerSignatureDataUrl?: string | null
  kundeSignatureDataUrl?: string | null
}

export async function buildBerichtPdf(input: BerichtPdfInput): Promise<jsPDF> {
  const { bericht, tage, ersatzteile, machine, techniker, order } = input
  const [logo, hintergrund] = await Promise.all([bildAlsDataUrl(LOGO_URL), bildAlsDataUrl(PDF_HINTERGRUND_URL)])
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const totals = calcBerichtTotals(tage)

  setupPage(doc, hintergrund)
  drawHeader(doc, logo, 'SERVICEBERICHT', [`#${order.id}`, 'Auftragsnummer'])

  let y = 35
  y = fieldRow(doc, y, [
    ['Auftraggeber', order.auftraggeber?.name || '–'],
    ['Einsatzkunde', order.einsatzkunde?.name || '–'],
    ['Techniker', techniker?.name || '–'],
  ])
  y = fieldRow(doc, y, [
    ['Adresse', customerAddress(order.einsatzkunde)],
    ['Ansprechpartner', order.ansprechpartner ? `${order.ansprechpartner.name}${order.ansprechpartner.telefon ? ' · ' + order.ansprechpartner.telefon : ''}` : '–'],
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
        const d = calcDay(t)
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
        const pauseWithUeb = t.uebernachtung ? `${pause}\n🏨 Übernachtung` : pause
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
    doc.setTextColor(AMBER)
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
  if (input.technikerSignatureDataUrl) doc.addImage(input.technikerSignatureDataUrl, 'PNG', MARGIN + 1, y + 1, sigW - 2, sigH - 2)
  if (input.kundeSignatureDataUrl) doc.addImage(input.kundeSignatureDataUrl, 'PNG', MARGIN + sigW + 11, y + 1, sigW - 2, sigH - 2)
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
  const res = await fetch(url)
  const blob = await res.blob()
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
  d: ReturnType<typeof calcDay>
  verpflegung: number
  hotelkosten: number
}

export async function buildNachweisPdf(args: {
  technikerName: string
  monatLabel: string
  zeilen: NachweisZeile[]
  sum: { arbeitNormal: number; arbeitZuschlag50: number; arbeitZuschlag100: number; reiseNormal: number; reiseZuschlag50: number; reiseZuschlag100: number; verpflegung: number; hotel: number }
  fehltage: { krank: number; schulung: number; kurzarbeit: number; urlaub: number }
}): Promise<jsPDF> {
  const { technikerName, monatLabel, zeilen, sum, fehltage } = args
  const [logo, hintergrund] = await Promise.all([bildAlsDataUrl(LOGO_URL), bildAlsDataUrl(PDF_HINTERGRUND_URL)])
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  setupPage(doc, hintergrund)
  drawHeader(doc, logo, 'STUNDENNACHWEIS', [monatLabel, technikerName])

  let y = 38
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
    head: [['', 'Normal', '+50%', '+100%']],
    body: [
      ['Arbeit', `${fmt(sum.arbeitNormal)} h`, `${fmt(sum.arbeitZuschlag50)} h`, `${fmt(sum.arbeitZuschlag100)} h`],
      ['Reise', `${fmt(sum.reiseNormal)} h`, `${fmt(sum.reiseZuschlag50)} h`, `${fmt(sum.reiseZuschlag100)} h`],
    ],
  })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  y = (doc as any).lastAutoTable.finalY + 8

  doc.setFontSize(9)
  doc.setTextColor(INK)
  doc.text(`Verpflegungsmehraufwand: ${sum.verpflegung.toFixed(2)} €   ·   Hotelkosten: ${sum.hotel.toFixed(2)} €   ·   Spesen gesamt: ${(sum.verpflegung + sum.hotel).toFixed(2)} €`, MARGIN, y)
  y += 8
  doc.text(`Krankheitstage: ${fehltage.krank}   ·   Schulungstage: ${fehltage.schulung}   ·   Kurzarbeitstage: ${fehltage.kurzarbeit}   ·   Urlaubstage: ${fehltage.urlaub}`, MARGIN, y)
  y += 10

  drawFooterAndPageNumbers(doc)
  return doc
}
