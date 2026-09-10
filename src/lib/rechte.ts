import type { Employee } from './types'

/**
 * Darf dieser Mitarbeiter bestehende Stammdaten ändern oder löschen?
 *
 * Techniker dürfen Kunden, Ansprechpartner und Maschinen **anlegen** — sie
 * stehen beim Kunden und brauchen den Datensatz sofort, etwa wenn vor Ort erst
 * feststeht, an welcher Maschine gearbeitet wird. Bestehende Datensätze ändern
 * oder löschen dürfen sie bewusst nicht; das macht die Leitung, wenn nötig.
 *
 * Die Datenbank erzwingt dasselbe über RLS — das hier blendet die Knöpfe aus,
 * damit niemand in eine Fehlermeldung läuft.
 */
export function darfStammdatenAendern(employee: Employee | null | undefined): boolean {
  return employee?.role === 'Administrator' || employee?.role === 'Disposition' || employee?.role === 'CEO'
}
