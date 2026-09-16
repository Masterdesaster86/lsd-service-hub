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
