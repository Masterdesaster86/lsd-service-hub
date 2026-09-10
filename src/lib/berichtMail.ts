import type { OrderWithRelations, Servicebericht } from './types'

/**
 * Vorgefertigter Begleittext zum Servicebericht.
 *
 * Landet beim Teilen im Nachrichtentext (Mail, WhatsApp, ...) und beim
 * "E-Mail vorbereiten"-Weg im Mail-Text. Bewusst schlicht gehalten, damit er
 * ohne Nacharbeit rausgehen kann.
 */
export function berichtMailBetreff(order: OrderWithRelations, bericht: Servicebericht): string {
  const maschine = order.machines[0]
  return `Servicebericht ${bericht.bericht_nummer} – Auftrag #${order.id}`
    + (maschine ? ` – ${maschine.bezeichnung}` : '')
}

/** Endet bewusst ohne Grußformel, Name und Firma — das steht schon in der
 *  Outlook-Signatur und käme sonst doppelt. */
export function berichtMailText(order: OrderWithRelations, bericht: Servicebericht): string {
  // Mit vollem Namen ansprechen statt "Herr/Frau" — die Anrede haengt sonst am
  // Geschlecht, das wir nicht kennen, und liest sich wie ein Serienbrief.
  const name = (order.ansprechpartner?.name || '').trim()
  const anrede = name ? `Guten Tag ${name},` : 'Guten Tag,'

  const maschine = order.machines[0]
  const zeilen = [
    anrede,
    '',
    `im Anhang erhalten Sie den Servicebericht ${bericht.bericht_nummer} zu unserem Einsatz`
      + (maschine ? ` an der Maschine ${maschine.bezeichnung}` : '')
      + (order.einsatzkunde?.name ? ` bei ${order.einsatzkunde.name}` : '')
      + '.',
    '',
    `Auftragsnummer: ${order.id}`,
  ]
  if (order.bestellnummer) zeilen.push(`Ihre Bestellnummer: ${order.bestellnummer}`)
  zeilen.push('', 'Bei Rückfragen melden Sie sich gerne.')
  return zeilen.filter((z, i, a) => !(z === '' && a[i - 1] === '')).join('\n')
}

/** mailto:-Adresse mit Empfänger, Betreff und Text — der einzige Weg, das
 *  Empfängerfeld vorzubefüllen. Anhänge sind dabei technisch nicht möglich. */
export function berichtMailtoUrl(order: OrderWithRelations, bericht: Servicebericht): string {
  // Die Adresse gehoert unkodiert in den mailto-Pfad — manche Mailprogramme
  // uebernehmen ein kodiertes "@" sonst woertlich.
  const empfaenger = (order.ansprechpartner?.email || '').trim()
  const betreff = encodeURIComponent(berichtMailBetreff(order, bericht))
  const text = encodeURIComponent(berichtMailText(order, bericht))
  return `mailto:${empfaenger}?subject=${betreff}&body=${text}`
}

/** Legt die Empfängeradresse in die Zwischenablage, damit sie im Mail-Fenster
 *  nur noch eingefügt werden muss. Schlägt still fehl, wenn der Browser das
 *  nicht zulässt — der Aufrufer sagt dann nur nichts von der Zwischenablage. */
export async function adresseInZwischenablage(email?: string | null): Promise<boolean> {
  if (!email || !navigator.clipboard?.writeText) return false
  try {
    await navigator.clipboard.writeText(email)
    return true
  } catch {
    return false
  }
}
