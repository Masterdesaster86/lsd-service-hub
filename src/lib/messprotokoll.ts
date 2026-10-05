// Prüfpunkt-Kataloge für die geometrische Abnahme (Messprotokoll).
//
// Bewusst eigenständig formuliert und eigenständig aufgebaut — orientiert an
// den in der Werkzeugmaschinen-Metrologie üblichen Prüfarten (Rundlauf,
// Planlauf, Rechtwinkligkeit, Parallelität usw., vgl. z.B. ISO 230), aber
// nicht als Nachbau eines bestimmten Hersteller-Formulars. Toleranzwerte sind
// als Richtwerte hinterlegt und im Einzelfall zu prüfen.

export type MessprotokollTyp = 'schwenkkopf' | 'h_maschine'

export interface Messpunkt {
  /** Eindeutiger Schlüssel, unter dem der gemessene Wert gespeichert wird. */
  key: string
  /** Anzeige-Nummer, z.B. "4a". */
  nr: string
  bezeichnung: string
  pruefmittel: string
  /** Zulässige Abweichung als Richtwert, freier Text. */
  toleranz: string
}

export interface Messgruppe {
  titel: string
  punkte: Messpunkt[]
}

export interface MessprotokollTypDefinition {
  label: string
  kurzbeschreibung: string
  gruppen: Messgruppe[]
}

export const MESSPROTOKOLL_TYPEN: Record<MessprotokollTyp, MessprotokollTypDefinition> = {
  schwenkkopf: {
    label: 'Universalmaschine mit Schwenkkopf',
    kurzbeschreibung: 'Fräs-/Bohrmaschine mit Palettenwechsler und schwenkbarem Frässpindelkopf.',
    gruppen: [
      {
        titel: 'Tisch- und Palettengeometrie',
        punkte: [
          { key: 'planlauf_p1', nr: '1a', bezeichnung: 'Planlauf der Aufspannfläche — Palette 1', pruefmittel: 'Messuhr', toleranz: '0,01 mm bis Ø 500 mm / 0,02 mm bis Ø 1000 mm' },
          { key: 'planlauf_p2', nr: '1b', bezeichnung: 'Planlauf der Aufspannfläche — Palette 2', pruefmittel: 'Messuhr', toleranz: '0,01 mm bis Ø 500 mm / 0,02 mm bis Ø 1000 mm' },
          { key: 'rundlauf_zentrierbuchse_p1', nr: '2a', bezeichnung: 'Rundlauf der Zentrierbuchse — Palette 1', pruefmittel: 'Fühlhebelmessgerät', toleranz: '0,01 mm' },
          { key: 'rundlauf_zentrierbuchse_p2', nr: '2b', bezeichnung: 'Rundlauf der Zentrierbuchse — Palette 2', pruefmittel: 'Fühlhebelmessgerät', toleranz: '0,01 mm' },
          { key: 'parallel_aufspann_quer', nr: '3', bezeichnung: 'Parallelität der Aufspannfläche zur Querachse', pruefmittel: 'Messuhr', toleranz: '0,02 mm/500 mm — 0,03 mm/1000 mm' },
          { key: 'parallel_aufspann_laengs', nr: '4a', bezeichnung: 'Parallelität der Aufspannfläche zur Längsachse', pruefmittel: 'Messuhr', toleranz: '0,02 mm/500 mm — 0,03 mm/1000 mm' },
          { key: 'parallel_referenznut_p1', nr: '4b/1', bezeichnung: 'Parallelität der Referenznut zur Längsachse — Palette 1', pruefmittel: 'Fühlhebelmessgerät', toleranz: 'nach Herstellerangabe' },
          { key: 'parallel_referenznut_p2', nr: '4b/2', bezeichnung: 'Parallelität der Referenznut zur Längsachse — Palette 2', pruefmittel: 'Fühlhebelmessgerät', toleranz: 'nach Herstellerangabe' },
          { key: 'rechtwinklig_laengs_quer', nr: '5', bezeichnung: 'Rechtwinkligkeit Längsachse zu Querachse', pruefmittel: 'Messuhr, Messwinkel', toleranz: '0,02 mm/500 mm' },
          { key: 'rechtwinklig_senkr_quer', nr: '6a', bezeichnung: 'Rechtwinkligkeit der Aufspannfläche zur Senkrechtachse (Querrichtung)', pruefmittel: 'Messuhr, Messwinkel', toleranz: '0,02 mm/300 mm — 0,03 mm/500 mm' },
          { key: 'rechtwinklig_senkr_laengs', nr: '6b', bezeichnung: 'Rechtwinkligkeit der Aufspannfläche zur Senkrechtachse (Längsrichtung)', pruefmittel: 'Messuhr, Messwinkel', toleranz: '0,02 mm/300 mm — 0,03 mm/500 mm' },
        ],
      },
      {
        titel: 'Arbeitsspindel',
        punkte: [
          { key: 'axialruhe_spindel', nr: '7', bezeichnung: 'Axialruhe der Arbeitsspindel', pruefmittel: 'Messuhr, Prüfdorn', toleranz: '0,01 mm' },
          { key: 'rundlauf_innenkegel_nah', nr: '8a', bezeichnung: 'Rundlauf des Spindel-Innenkegels, nahe Spindelnase', pruefmittel: 'Messuhr, Prüfdorn', toleranz: '0,01 mm' },
          { key: 'rundlauf_innenkegel_fern', nr: '8b', bezeichnung: 'Rundlauf des Spindel-Innenkegels, im Abstand 300 mm (150 mm bei HSK 32/40/50)', pruefmittel: 'Messuhr, Prüfdorn', toleranz: '0,02 mm (0,015 mm bei HSK 32/40/50)' },
          { key: 'parallel_spindel_quer_a', nr: '9a', bezeichnung: 'Parallelität der Arbeitsspindel zur Querachse (Ebene A)', pruefmittel: 'Messuhr, Prüfdorn', toleranz: '0,02 mm/300 mm' },
          { key: 'parallel_spindel_quer_b', nr: '9b', bezeichnung: 'Parallelität der Arbeitsspindel zur Querachse (Ebene B)', pruefmittel: 'Messuhr, Prüfdorn', toleranz: '0,02 mm/300 mm' },
          { key: 'umschlag_senkrecht', nr: '10', bezeichnung: 'Umschlagmessung in senkrechter Richtung', pruefmittel: 'Messuhr, Umschlagarm, Messwinkel', toleranz: '0,02 mm bei Ø 300 mm' },
          { key: 'umschlag_waagrecht', nr: '11', bezeichnung: 'Umschlagmessung in waagrechter Richtung', pruefmittel: 'Messuhr, Umschlagarm, Messwinkel', toleranz: '0,02 mm bei Ø 300 mm' },
          { key: 'parallel_spindel_senkr_a', nr: '12a', bezeichnung: 'Parallelität der Arbeitsspindel zur Senkrechtachse (Ebene A)', pruefmittel: 'Messuhr, Prüfdorn', toleranz: '0,02 mm/300 mm' },
          { key: 'parallel_spindel_senkr_b', nr: '12b', bezeichnung: 'Parallelität der Arbeitsspindel zur Senkrechtachse (Ebene B)', pruefmittel: 'Messuhr, Prüfdorn', toleranz: '0,02 mm/300 mm' },
        ],
      },
      {
        titel: 'Schwenkkopf',
        punkte: [
          { key: 'umschlag_schwenk_laengs', nr: '13a', bezeichnung: 'Umschlagmessung mit dem Schwenkkopf, Längsrichtung', pruefmittel: 'Messuhr, Umschlagarm', toleranz: '0,02 mm bei Ø 300 mm' },
          { key: 'umschlag_schwenk_quer', nr: '13b', bezeichnung: 'Umschlagmessung mit dem Schwenkkopf, Querrichtung', pruefmittel: 'Messuhr, Umschlagarm', toleranz: '0,02 mm bei Ø 300 mm' },
        ],
      },
      {
        titel: 'Referenzmaße für die Programmierung (nur Schwenkkopf)',
        punkte: [
          { key: 'ref_14', nr: '14', bezeichnung: 'Abstand Frässpindel — Referenzpunkt Längsachse', pruefmittel: 'Messmittel n. Wahl', toleranz: '–' },
          { key: 'ref_15', nr: '15', bezeichnung: 'Abstand Frässpindel — Referenzpunkt Querachse', pruefmittel: 'Messmittel n. Wahl', toleranz: '–' },
          { key: 'ref_16', nr: '16', bezeichnung: 'Abstand Frässpindelkonus — Referenzpunkt Senkrechtachse', pruefmittel: 'Messmittel n. Wahl', toleranz: '–' },
          { key: 'ref_17', nr: '17', bezeichnung: 'Abstand Frässpindel — Referenzpunkt Längsachse, geschwenkte Ebene', pruefmittel: 'Messmittel n. Wahl', toleranz: '–' },
          { key: 'ref_18', nr: '18', bezeichnung: 'Abstand Frässpindelkonus — Referenzpunkt Querachse, geschwenkte Ebene', pruefmittel: 'Messmittel n. Wahl', toleranz: '–' },
          { key: 'ref_19', nr: '19', bezeichnung: 'Abstand Frässpindel — Referenzpunkt Senkrechtachse, geschwenkte Ebene', pruefmittel: 'Messmittel n. Wahl', toleranz: '–' },
          { key: 'ref_20a', nr: '20a', bezeichnung: 'Schnittpunkt Schwenk-/Arbeitsspindelachse, waagrecht (errechnet: 15 − 18)', pruefmittel: 'errechnet', toleranz: '–' },
          { key: 'ref_20b', nr: '20b', bezeichnung: 'Schnittpunkt Schwenk-/Arbeitsspindelachse, senkrecht (errechnet: 19 − 16)', pruefmittel: 'errechnet', toleranz: '–' },
          { key: 'ref_21', nr: '21', bezeichnung: 'Abstand Schwenkachse — Referenzpunkt Längsachse (errechnet: (14 + 17) / 2)', pruefmittel: 'errechnet', toleranz: '–' },
        ],
      },
    ],
  },
  h_maschine: {
    label: 'H-Maschine (Horizontal-Bohr-/Fräsmaschine)',
    kurzbeschreibung: 'Horizontale Bohr-/Fräsmaschine mit NC-Rundtisch und Paletten.',
    gruppen: [
      {
        titel: 'Tisch- und Palettengeometrie',
        punkte: [
          { key: 'planlauf_p1', nr: '1a', bezeichnung: 'Planlauf der Aufspannfläche — Palette 1', pruefmittel: 'Messuhr', toleranz: '0,012 mm bis Ø 500 mm / 0,025 mm bis Ø 1000 mm' },
          { key: 'planlauf_p2', nr: '1b', bezeichnung: 'Planlauf der Aufspannfläche — Palette 2', pruefmittel: 'Messuhr', toleranz: '0,012 mm bis Ø 500 mm / 0,025 mm bis Ø 1000 mm' },
          { key: 'rundlauf_zentrierbuchse_p1', nr: '2a', bezeichnung: 'Rundlauf der Zentrierbuchse — Palette 1', pruefmittel: 'Fühlhebelmessgerät', toleranz: '0,01 mm' },
          { key: 'rundlauf_zentrierbuchse_p2', nr: '2b', bezeichnung: 'Rundlauf der Zentrierbuchse — Palette 2', pruefmittel: 'Fühlhebelmessgerät', toleranz: '0,01 mm' },
          { key: 'parallel_aufspann_quer', nr: '3', bezeichnung: 'Parallelität der Aufspannfläche zur Querachse', pruefmittel: 'Messuhr', toleranz: '0,02 mm/500 mm — 0,03 mm/1000 mm' },
          { key: 'parallel_aufspann_laengs', nr: '4a', bezeichnung: 'Parallelität der Aufspannfläche zur Längsachse', pruefmittel: 'Messuhr', toleranz: '0,02 mm/500 mm — 0,03 mm/1000 mm' },
          { key: 'parallel_referenznut_p1', nr: '4b/1', bezeichnung: 'Parallelität der Referenznut zur Längsachse — Palette 1 (entfällt bei Paletten ohne Nut)', pruefmittel: 'Fühlhebelmessgerät', toleranz: 'nach Herstellerangabe' },
          { key: 'parallel_referenznut_p2', nr: '4b/2', bezeichnung: 'Parallelität der Referenznut zur Längsachse — Palette 2 (entfällt bei Paletten ohne Nut)', pruefmittel: 'Fühlhebelmessgerät', toleranz: 'nach Herstellerangabe' },
          { key: 'rechtwinklig_laengs_quer', nr: '5', bezeichnung: 'Rechtwinkligkeit Längsachse zu Querachse', pruefmittel: 'Messuhr, Messwinkel', toleranz: '0,02 mm/500 mm' },
          { key: 'rechtwinklig_senkr_quer', nr: '6a', bezeichnung: 'Rechtwinkligkeit der Senkrechtachse zur Querachse', pruefmittel: 'Messuhr, Messwinkel', toleranz: '0,02 mm/500 mm' },
          { key: 'rechtwinklig_senkr_aufspann_quer', nr: '6b', bezeichnung: 'Rechtwinkligkeit der Senkrechtachse zur Aufspannfläche (Querrichtung)', pruefmittel: 'Messuhr, Messwinkel', toleranz: '0,02 mm/500 mm' },
          { key: 'rechtwinklig_senkr_laengs', nr: '7a', bezeichnung: 'Rechtwinkligkeit der Senkrechtachse zur Längsachse', pruefmittel: 'Messuhr, Messwinkel', toleranz: '0,02 mm/500 mm' },
          { key: 'rechtwinklig_senkr_aufspann_laengs', nr: '7b', bezeichnung: 'Rechtwinkligkeit der Senkrechtachse zur Aufspannfläche (Längsrichtung)', pruefmittel: 'Messuhr, Messwinkel', toleranz: '0,02 mm/500 mm' },
        ],
      },
      {
        titel: 'Arbeitsspindel',
        punkte: [
          { key: 'axialruhe_spindel', nr: '8', bezeichnung: 'Axialruhe der Arbeitsspindel', pruefmittel: 'Messuhr, Prüfdorn', toleranz: '0,01 mm' },
          { key: 'rundlauf_innenkegel_nah', nr: '9a', bezeichnung: 'Rundlauf des Spindel-Innenkegels, nahe Spindelnase', pruefmittel: 'Messuhr, Prüfdorn', toleranz: '0,01 mm' },
          { key: 'rundlauf_innenkegel_fern', nr: '9b', bezeichnung: 'Rundlauf des Spindel-Innenkegels, im Abstand 300 mm (150 mm bei HSK 32/40/50)', pruefmittel: 'Messuhr, Prüfdorn', toleranz: '0,02 mm (0,015 mm bei HSK 32/40/50)' },
          { key: 'parallel_spindel_quer_a', nr: '10a', bezeichnung: 'Parallelität der Arbeitsspindel zur Querachse (Ebene A)', pruefmittel: 'Messuhr, Prüfdorn', toleranz: '0,02 mm/300 mm' },
          { key: 'parallel_spindel_quer_b', nr: '10b', bezeichnung: 'Parallelität der Arbeitsspindel zur Querachse (Ebene B)', pruefmittel: 'Messuhr, Prüfdorn', toleranz: '0,02 mm/300 mm' },
          { key: 'umschlag_senkrecht', nr: '11', bezeichnung: 'Umschlagmessung in senkrechter Richtung', pruefmittel: 'Messuhr, Umschlagarm, Messwinkel', toleranz: '0,02 mm bei Ø 300 mm' },
          { key: 'umschlag_waagrecht', nr: '12', bezeichnung: 'Umschlagmessung in waagrechter Richtung', pruefmittel: 'Messuhr, Umschlagarm, Messwinkel', toleranz: '0,02 mm bei Ø 300 mm' },
        ],
      },
      {
        titel: 'Referenzmaße für die Programmierung',
        punkte: [
          { key: 'ref_13', nr: '13', bezeichnung: 'Abstand Frässpindel — Referenzpunkt Längsachse', pruefmittel: 'Messmittel n. Wahl', toleranz: '–' },
          { key: 'ref_14', nr: '14', bezeichnung: 'Abstand Frässpindelkonus — Referenzpunkt Querachse', pruefmittel: 'Messmittel n. Wahl', toleranz: '–' },
          { key: 'ref_15', nr: '15', bezeichnung: 'Abstand Frässpindel — Referenzpunkt Senkrechtachse', pruefmittel: 'Messmittel n. Wahl', toleranz: '–' },
        ],
      },
    ],
  },
}

/** Alle Messpunkte eines Typs als flache Liste, mit Gruppentitel dabei. */
export function alleMesspunkte(typ: MessprotokollTyp): (Messpunkt & { gruppe: string })[] {
  return MESSPROTOKOLL_TYPEN[typ].gruppen.flatMap((g) => g.punkte.map((p) => ({ ...p, gruppe: g.titel })))
}

// --- Bewertung der Messwerte ---------------------------------------------

/** Unter diesem Schlüssel steht in `werte` die Bemerkung zu einem Prüfpunkt. */
export const bemerkungKey = (key: string) => `${key}__bemerkung`
/** Ergebnis / Bemerkung zum ganzen Protokoll, ebenfalls in `werte`. */
export const ERGEBNIS_KEY = '_ergebnis'

/** Unter diesem Schlüssel steht in `werte` die gewählte Toleranz-Stufe (Index). */
export const stufeKey = (key: string) => `${key}__stufe`

/**
 * Zulässige Abweichung als Zahl in mm — nur wenn die Angabe eindeutig ist
 * ("0,01 mm", "0,02 mm/500 mm", "0,02 mm bei Ø 300 mm"). Gestaffelte Angaben
 * und Maße ohne Toleranz geben null (siehe toleranzstufen).
 */
export function grenzwertMm(toleranz: string): number | null {
  const m = toleranz.match(/^\s*(\d+(?:,\d+)?)\s*mm(?:\s*\/\s*\d+\s*mm|\s+bei\s+Ø\s*\d+\s*mm)?\s*$/)
  return m ? parseFloat(m[1].replace(',', '.')) : null
}

export interface Toleranzstufe {
  /** Wovon die Stufe abhängt, z.B. "bis Ø 500 mm" oder "Messlänge 1000 mm". */
  label: string
  grenze: number
}

const zahlAus = (s: string) => parseFloat(s.replace(',', '.'))

/**
 * Stufen einer gestaffelten Toleranz, aus denen der Techniker die passende
 * wählt — danach prüft die App wie bei einer eindeutigen Angabe.
 */
export function toleranzstufen(toleranz: string): Toleranzstufe[] {
  let m = toleranz.match(/^(\d+,\d+) mm bis (Ø \d+ mm) \/ (\d+,\d+) mm bis (Ø \d+ mm)$/)
  if (m) return [{ label: `bis ${m[2]}`, grenze: zahlAus(m[1]) }, { label: `bis ${m[4]}`, grenze: zahlAus(m[3]) }]
  m = toleranz.match(/^(\d+,\d+) mm\/(\d+ mm) — (\d+,\d+) mm\/(\d+ mm)$/)
  if (m) return [{ label: `Messlänge ${m[2]}`, grenze: zahlAus(m[1]) }, { label: `Messlänge ${m[4]}`, grenze: zahlAus(m[3]) }]
  m = toleranz.match(/^(\d+,\d+) mm \((\d+,\d+) mm bei (.+)\)$/)
  if (m) return [{ label: 'Standard', grenze: zahlAus(m[1]) }, { label: m[3], grenze: zahlAus(m[2]) }]
  return []
}

/** Die gewählte Stufe eines Prüfpunkts, sonst null. */
export function gewaehlteStufe(p: Messpunkt, werte: Record<string, string>): Toleranzstufe | null {
  const w = werte[stufeKey(p.key)]
  if (w === undefined || w === '') return null
  return toleranzstufen(p.toleranz)[Number(w)] ?? null
}

/** Grenzwert für die Prüfung: eindeutige Angabe oder gewählte Stufe. */
export function grenzeFuer(p: Messpunkt, werte: Record<string, string>): number | null {
  return grenzwertMm(p.toleranz) ?? gewaehlteStufe(p, werte)?.grenze ?? null
}

/** Eingegebenen Messwert als Zahl lesen ("0,015", "0.015 mm"); sonst null. */
export function messwertZahl(wert: string | undefined): number | null {
  const s = (wert || '').replace(/mm/i, '').replace(',', '.').trim()
  if (!s) return null
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

export type Bewertung = 'offen' | 'io' | 'nio' | 'erfasst'

/** offen = nichts eingetragen, io/nio = gegen die Toleranz geprüft,
 * erfasst = Wert steht da, aber ohne automatische Prüfung. */
export function bewerte(p: Messpunkt, werte: Record<string, string>): Bewertung {
  const wert = werte[p.key]
  if (!(wert || '').trim()) return 'offen'
  const g = grenzeFuer(p, werte)
  const n = messwertZahl(wert)
  if (g === null || n === null) return 'erfasst'
  return Math.abs(n) <= g + 1e-9 ? 'io' : 'nio'
}

/** Zahl deutsch formatiert, ohne überflüssige Nullen. */
export const mm = (n: number) => n.toLocaleString('de-DE', { maximumFractionDigits: 4 })

// --- Skizzen ----------------------------------------------------------------

// Eigene Skizzen von LSD (public/messprotokoll/skizzen), je Typ und Prüfpunkt.
// Die nummerierten Skizzen im Hauptordner folgen der Schwenkkopf-Nummerierung,
// die der H-Maschine liegen in h-maschine/ (eigene Nummern, z.B. 10 = Spindel quer).
const SKIZZE = {
  planlauf: 'rundtisch-draufsicht-messuhr-aussen.png',
  rundlauf: 'rundtisch-draufsicht-messuhr-mitte.png',
  quer: 'tisch-seitenansicht-messuhr-spindel.png',
  p4: '04-parallelitaet-aufspannflaeche-referenznut-laengs.png',
  p5: '05-rechtwinkligkeit-laengs-quer.png',
  p6: '06-rechtwinkligkeit-aufspannflaeche-senkrecht.png',
  axial: 'detail-messuhr-pruefkoerper.png',
  p8: '08-rundlauf-innenkegel-arbeitsspindel.png',
  p9: '09-parallelitaet-spindel-quer.png',
  p10: '10-umschlagmessung-senkrecht.png',
  p11: '11-umschlagmessung-waagerecht.png',
  p12: '12-parallelitaet-spindel-senkrecht.png',
  p13: '13-umschlagmessung-arbeitsspindel.png',
  p14: '14-abstand-fraesspindel-laengsachse.png',
  p15: '15-abstand-fraesspindel-querachse.png',
  p16: '16-abstand-spindelkonus-senkrechte-achse.png',
  p17: '17-abstand-fraesspindel-laengsachse-bezug.png',
  p18: '18-abstand-spindelkonus-querachse.png',
  p19: '19-abstand-fraesspindel-senkrechte-achse.png',
  p20: '20-abstand-spindelkonus-schwenkachse.png',
  p21: '21-abstand-schwenkachse-laengsachse.png',
}

const GEMEINSAME_SKIZZEN: Record<string, string> = {
  planlauf_p1: SKIZZE.planlauf,
  planlauf_p2: SKIZZE.planlauf,
  rundlauf_zentrierbuchse_p1: SKIZZE.rundlauf,
  rundlauf_zentrierbuchse_p2: SKIZZE.rundlauf,
  parallel_aufspann_quer: SKIZZE.quer,
  parallel_aufspann_laengs: SKIZZE.p4,
  parallel_referenznut_p1: SKIZZE.p4,
  parallel_referenznut_p2: SKIZZE.p4,
  rechtwinklig_laengs_quer: SKIZZE.p5,
  axialruhe_spindel: SKIZZE.axial,
}

const SKIZZEN: Record<MessprotokollTyp, Record<string, string>> = {
  schwenkkopf: {
    ...GEMEINSAME_SKIZZEN,
    rechtwinklig_senkr_quer: SKIZZE.p6,
    rechtwinklig_senkr_laengs: SKIZZE.p6,
    parallel_spindel_quer_a: SKIZZE.p9,
    parallel_spindel_quer_b: SKIZZE.p9,
    parallel_spindel_senkr_a: SKIZZE.p12,
    parallel_spindel_senkr_b: SKIZZE.p12,
    rundlauf_innenkegel_nah: SKIZZE.p8,
    rundlauf_innenkegel_fern: SKIZZE.p8,
    umschlag_senkrecht: SKIZZE.p10,
    umschlag_waagrecht: SKIZZE.p11,
    umschlag_schwenk_laengs: SKIZZE.p13,
    umschlag_schwenk_quer: SKIZZE.p13,
    ref_14: SKIZZE.p14,
    ref_15: SKIZZE.p15,
    ref_16: SKIZZE.p16,
    ref_17: SKIZZE.p17,
    ref_18: SKIZZE.p18,
    ref_19: SKIZZE.p19,
    ref_20a: SKIZZE.p20,
    ref_20b: SKIZZE.p20,
    ref_21: SKIZZE.p21,
  },
  h_maschine: {
    ...GEMEINSAME_SKIZZEN,
    parallel_aufspann_quer: 'h-maschine/03-parallelitaet-aufspannflaeche-quer.png',
    parallel_aufspann_laengs: 'h-maschine/04-parallelitaet-aufspannflaeche-referenznut-laengs.png',
    parallel_referenznut_p1: 'h-maschine/04-parallelitaet-aufspannflaeche-referenznut-laengs.png',
    parallel_referenznut_p2: 'h-maschine/04-parallelitaet-aufspannflaeche-referenznut-laengs.png',
    rechtwinklig_senkr_quer: 'h-maschine/06-rechtwinkligkeit-senkrechtbewegung.png',
    rechtwinklig_senkr_aufspann_quer: 'h-maschine/06-rechtwinkligkeit-senkrechtbewegung.png',
    rechtwinklig_senkr_laengs: 'h-maschine/07-rechtwinkligkeit-senkrechtbewegung-laengs.png',
    rechtwinklig_senkr_aufspann_laengs: 'h-maschine/07-rechtwinkligkeit-senkrechtbewegung-laengs.png',
    parallel_spindel_quer_a: 'h-maschine/10-parallelitaet-spindel-quer.png',
    parallel_spindel_quer_b: 'h-maschine/10-parallelitaet-spindel-quer.png',
    umschlag_senkrecht: 'h-maschine/11-umschlagmessung-senkrecht.png',
    umschlag_waagrecht: 'h-maschine/12-umschlagmessung-waagerecht.png',
    ref_13: 'h-maschine/13-abstand-fraesspindel-laengsachse.png',
    ref_14: 'h-maschine/14-abstand-spindelkonus-querachse.png',
    ref_15: 'h-maschine/15-abstand-fraesspindel-senkrechte-achse.png',
  },
}

/** Adresse der Skizze zu einem Prüfpunkt (berücksichtigt den Unterordner /neu/) — oder null. */
export function skizzeUrl(typ: MessprotokollTyp, key: string): string | null {
  const datei = SKIZZEN[typ]?.[key]
  return datei ? `${import.meta.env.BASE_URL}messprotokoll/skizzen/${datei}` : null
}
