import type { Customer } from './types'

export function customerAddress(c: Customer | null | undefined): string {
  if (!c) return '–'
  return `${c.strasse ?? ''}, ${c.plz ?? ''} ${c.ort ?? ''}`.trim()
}

export function mapsLink(address: string): string {
  return `https://maps.apple.com/?q=${encodeURIComponent(address)}`
}

export function telHref(tel: string | null | undefined): string {
  return `tel:${(tel || '').replace(/[^+\d]/g, '')}`
}

export function formatDateDE(isoDate: string | null | undefined): string {
  if (!isoDate) return '–'
  const [y, m, d] = isoDate.split('-')
  return `${d}.${m}.${y}`
}

/** Postgres `time` columns come back as "HH:MM:SS" — trim to "HH:MM" for display. */
export function hhmm(t: string | null | undefined): string | null {
  if (!t) return null
  return t.slice(0, 5)
}
