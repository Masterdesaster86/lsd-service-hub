// Prüfpunkt-Kataloge für die geometrische Abnahme (Messprotokoll).
//
// Bewusst eigenständig formuliert und eigenständig aufgebaut — orientiert an
// den in der Werkzeugmaschinen-Metrologie üblichen Prüfarten (Rundlauf,
// Planlauf, Rechtwinkligkeit, Parallelität usw., vgl. z.B. ISO 230), aber
// nicht als Nachbau eines bestimmten Hersteller-Formulars. Toleranzwerte sind
// als Richtwerte hinterlegt und im Einzelfall zu prüfen.

export type MessprotokollTyp = 'schwenkkopf' | 'h_maschine' | 't_maschine'

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
          { key: 'parallel_referenznut_p1', nr: '4b/1', bezeichnung: 'Parallelität der Referenznut zur Längsachse — Palette 1', pruefmittel: 'Fühlhebelmessgerät', toleranz: '0,02 mm/500 mm — 0,03 mm/1000 mm' },
          { key: 'parallel_referenznut_p2', nr: '4b/2', bezeichnung: 'Parallelität der Referenznut zur Längsachse — Palette 2', pruefmittel: 'Fühlhebelmessgerät', toleranz: '0,02 mm/500 mm — 0,03 mm/1000 mm' },
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
          { key: 'parallel_referenznut_p1', nr: '4b/1', bezeichnung: 'Parallelität der Referenznut zur Längsachse — Palette 1 (entfällt bei Paletten ohne Nut)', pruefmittel: 'Fühlhebelmessgerät', toleranz: '0,02 mm/500 mm — 0,03 mm/1000 mm' },
          { key: 'parallel_referenznut_p2', nr: '4b/2', bezeichnung: 'Parallelität der Referenznut zur Längsachse — Palette 2 (entfällt bei Paletten ohne Nut)', pruefmittel: 'Fühlhebelmessgerät', toleranz: '0,02 mm/500 mm — 0,03 mm/1000 mm' },
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
  t_maschine: {
    label: 'Universalmaschine mit Einbaurundtisch (T-Maschine)',
    kurzbeschreibung:
      'Universal-Fräs-/Bohrmaschine mit NC-Einbaurundtisch und Starrtisch, z.B. DMU 60/80/100 T. ' +
      'Messungen am Rundtisch, am Starrtisch und auf dem Tischaufsatz. Bei Fräskopf mit hydraulischer ' +
      'Klemmung geklemmt und ungeklemmt messen; 19 und 20 nur bei Fräskopf mit Drehgeber.',
    gruppen: [
      {
        titel: 'Rundtisch, Starrtisch und Aufsatz',
        punkte: [
          { key: 'planlauf_rundtisch', nr: '1a', bezeichnung: 'Planlauf der Aufspannfläche — Rundtisch', pruefmittel: 'Messuhr', toleranz: '0,02 mm bei Ø 500 mm' },
          { key: 'planlauf_aufsatz', nr: '1a/A', bezeichnung: 'Planlauf der Aufspannfläche — Aufsatz', pruefmittel: 'Messuhr', toleranz: '0,02 mm bei Ø 500 mm' },
          { key: 'rundlauf_zentrierbuchse_rundtisch', nr: '1b', bezeichnung: 'Rundlauf der Zentrierbuchse — Rundtisch', pruefmittel: 'Fühlhebelmessgerät', toleranz: '0,02 mm' },
          { key: 'rundlauf_zentrierbuchse_aufsatz', nr: '1b/A', bezeichnung: 'Rundlauf der Zentrierbuchse — Aufsatz', pruefmittel: 'Fühlhebelmessgerät', toleranz: '0,02 mm' },
          { key: 'parallel_referenznut_starrtisch', nr: '2a', bezeichnung: 'Parallelität der Referenznut zur Längsachse — Starrtisch', pruefmittel: 'Fühlhebelmessgerät', toleranz: '0,02 mm/500 mm' },
          { key: 'parallel_referenznut_rundtisch', nr: '2b', bezeichnung: 'Parallelität der Referenznut zur Längsachse — Rundtisch', pruefmittel: 'Fühlhebelmessgerät', toleranz: '0,02 mm/500 mm' },
          { key: 'parallel_referenznut_aufsatz', nr: '2b/A', bezeichnung: 'Parallelität der Referenznut zur Längsachse — Aufsatz', pruefmittel: 'Fühlhebelmessgerät', toleranz: '0,02 mm/500 mm' },
          { key: 'parallel_aufspann_laengs_starrtisch', nr: '3a', bezeichnung: 'Parallelität der Aufspannfläche zur Längsachse — Starrtisch', pruefmittel: 'Messuhr', toleranz: '0,02 mm/500 mm — 0,03 mm/1000 mm' },
          { key: 'parallel_aufspann_laengs_rundtisch', nr: '3b', bezeichnung: 'Parallelität der Aufspannfläche zur Längsachse — Rundtisch', pruefmittel: 'Messuhr', toleranz: '0,02 mm/500 mm — 0,03 mm/1000 mm' },
          { key: 'parallel_aufspann_laengs_aufsatz', nr: '3b/A', bezeichnung: 'Parallelität der Aufspannfläche zur Längsachse — Aufsatz', pruefmittel: 'Messuhr', toleranz: '0,02 mm/500 mm — 0,03 mm/1000 mm' },
          { key: 'parallel_aufspann_quer_starrtisch_a', nr: '4a', bezeichnung: 'Parallelität der Aufspannfläche zur Querachse — Starrtisch, vordere Position', pruefmittel: 'Messuhr', toleranz: '0,02 mm/500 mm — 0,03 mm/1000 mm' },
          { key: 'parallel_aufspann_quer_rundtisch', nr: '4b', bezeichnung: 'Parallelität der Aufspannfläche zur Querachse — Rundtisch', pruefmittel: 'Messuhr', toleranz: '0,02 mm/500 mm — 0,03 mm/1000 mm' },
          { key: 'parallel_aufspann_quer_aufsatz', nr: '4b/A', bezeichnung: 'Parallelität der Aufspannfläche zur Querachse — Aufsatz', pruefmittel: 'Messuhr', toleranz: '0,02 mm/500 mm — 0,03 mm/1000 mm' },
          { key: 'parallel_aufspann_quer_starrtisch_c', nr: '4c', bezeichnung: 'Parallelität der Aufspannfläche zur Querachse — Starrtisch, hintere Position', pruefmittel: 'Messuhr', toleranz: '0,02 mm/500 mm — 0,03 mm/1000 mm' },
          { key: 'rechtwinklig_senkr_quer_rundtisch', nr: '5a', bezeichnung: 'Rechtwinkligkeit der Aufspannfläche zur Senkrechtachse, Querrichtung — Rundtisch', pruefmittel: 'Messuhr, Messwinkel', toleranz: '0,02 mm/300 mm' },
          { key: 'rechtwinklig_senkr_quer_aufsatz', nr: '5a/A', bezeichnung: 'Rechtwinkligkeit der Aufspannfläche zur Senkrechtachse, Querrichtung — Aufsatz', pruefmittel: 'Messuhr, Messwinkel', toleranz: '0,02 mm/300 mm' },
          { key: 'rechtwinklig_senkr_laengs_rundtisch', nr: '5b', bezeichnung: 'Rechtwinkligkeit der Aufspannfläche zur Senkrechtachse, Längsrichtung — Rundtisch', pruefmittel: 'Messuhr, Messwinkel', toleranz: '0,02 mm/300 mm' },
          { key: 'rechtwinklig_senkr_laengs_aufsatz', nr: '5b/A', bezeichnung: 'Rechtwinkligkeit der Aufspannfläche zur Senkrechtachse, Längsrichtung — Aufsatz', pruefmittel: 'Messuhr, Messwinkel', toleranz: '0,02 mm/300 mm' },
          { key: 'rechtwinklig_quer_laengs_a', nr: '6a', bezeichnung: 'Rechtwinkligkeit Querachse zu Längsachse — Messwinkel längs ausgerichtet', pruefmittel: 'Messuhr, Messwinkel', toleranz: '0,02 mm/300 mm' },
          { key: 'rechtwinklig_quer_laengs_b', nr: '6b', bezeichnung: 'Rechtwinkligkeit Querachse zu Längsachse — Messuhr am Messwinkel, quer verfahren', pruefmittel: 'Messuhr, Messwinkel', toleranz: '0,02 mm/300 mm' },
        ],
      },
      {
        titel: 'Arbeitsspindel',
        punkte: [
          { key: 'axialruhe_spindel', nr: '7', bezeichnung: 'Axialruhe der Arbeitsspindel', pruefmittel: 'Messuhr, Prüfdorn', toleranz: '0,01 mm' },
          { key: 'rundlauf_innenkegel_nah', nr: '8a', bezeichnung: 'Rundlauf des Spindel-Innenkegels, nahe Spindelnase', pruefmittel: 'Messuhr, Prüfdorn', toleranz: '0,01 mm' },
          { key: 'rundlauf_innenkegel_fern', nr: '8b', bezeichnung: 'Rundlauf des Spindel-Innenkegels, im Abstand 300 mm (150 mm bei HSK 32/40/50)', pruefmittel: 'Messuhr, Prüfdorn', toleranz: '0,02 mm (0,015 mm bei HSK 32/40/50)' },
          { key: 'parallel_waag_spindel_laengs_a_geklemmt', nr: '9a', bezeichnung: 'Parallelität der waagrechten Arbeitsspindel zur Längsachse (Ebene A) — geklemmt', pruefmittel: 'Messuhr, Prüfdorn 300 mm', toleranz: '0,02 mm/300 mm' },
          { key: 'parallel_waag_spindel_laengs_a_offen', nr: '9a/U', bezeichnung: 'Parallelität der waagrechten Arbeitsspindel zur Längsachse (Ebene A) — ungeklemmt', pruefmittel: 'Messuhr, Prüfdorn 300 mm', toleranz: '0,02 mm/300 mm' },
          { key: 'parallel_waag_spindel_laengs_b_geklemmt', nr: '9b', bezeichnung: 'Parallelität der waagrechten Arbeitsspindel zur Längsachse (Ebene B) — geklemmt', pruefmittel: 'Messuhr, Prüfdorn 300 mm', toleranz: '0,02 mm/300 mm' },
          { key: 'parallel_waag_spindel_laengs_b_offen', nr: '9b/U', bezeichnung: 'Parallelität der waagrechten Arbeitsspindel zur Längsachse (Ebene B) — ungeklemmt', pruefmittel: 'Messuhr, Prüfdorn 300 mm', toleranz: '0,02 mm/300 mm' },
          { key: 'umschlag_waag_spindel_a_geklemmt', nr: '10a', bezeichnung: 'Umschlagmessung mit waagrechter Arbeitsspindel, Messleiste auf der Aufspannfläche — geklemmt', pruefmittel: 'Messuhr, Messleiste 500 mm, Umschlagarm 150 mm', toleranz: '0,02 mm/300 mm' },
          { key: 'umschlag_waag_spindel_a_offen', nr: '10a/U', bezeichnung: 'Umschlagmessung mit waagrechter Arbeitsspindel, Messleiste auf der Aufspannfläche — ungeklemmt', pruefmittel: 'Messuhr, Messleiste 500 mm, Umschlagarm 150 mm', toleranz: '0,02 mm/300 mm' },
          { key: 'umschlag_waag_spindel_b_geklemmt', nr: '10b', bezeichnung: 'Umschlagmessung mit waagrechter Arbeitsspindel, Fräskopf mittig zum Tisch — geklemmt', pruefmittel: 'Messuhr, Messleiste 500 mm, Umschlagarm 150 mm', toleranz: '0,02 mm/300 mm' },
          { key: 'umschlag_waag_spindel_b_offen', nr: '10b/U', bezeichnung: 'Umschlagmessung mit waagrechter Arbeitsspindel, Fräskopf mittig zum Tisch — ungeklemmt', pruefmittel: 'Messuhr, Messleiste 500 mm, Umschlagarm 150 mm', toleranz: '0,02 mm/300 mm' },
          { key: 'parallel_spindel_senkr_a_geklemmt', nr: '11a', bezeichnung: 'Parallelität der Arbeitsspindel zur Senkrechtachse (Ebene A) — geklemmt', pruefmittel: 'Messuhr, Prüfdorn 300 mm', toleranz: '0,02 mm/300 mm' },
          { key: 'parallel_spindel_senkr_a_offen', nr: '11a/U', bezeichnung: 'Parallelität der Arbeitsspindel zur Senkrechtachse (Ebene A) — ungeklemmt', pruefmittel: 'Messuhr, Prüfdorn 300 mm', toleranz: '0,02 mm/300 mm' },
          { key: 'parallel_spindel_senkr_b_geklemmt', nr: '11b', bezeichnung: 'Parallelität der Arbeitsspindel zur Senkrechtachse (Ebene B) — geklemmt', pruefmittel: 'Messuhr, Prüfdorn 300 mm', toleranz: '0,02 mm/300 mm' },
          { key: 'parallel_spindel_senkr_b_offen', nr: '11b/U', bezeichnung: 'Parallelität der Arbeitsspindel zur Senkrechtachse (Ebene B) — ungeklemmt', pruefmittel: 'Messuhr, Prüfdorn 300 mm', toleranz: '0,02 mm/300 mm' },
          { key: 'umschlag_rundtisch_laengs_geklemmt', nr: '12a', bezeichnung: 'Umschlagmessung Arbeitsspindel zum Rundtisch, Längsrichtung — geklemmt', pruefmittel: 'Messuhr, Umschlagarm 150 mm', toleranz: '0,02 mm bei Ø 300 mm' },
          { key: 'umschlag_rundtisch_laengs_offen', nr: '12a/U', bezeichnung: 'Umschlagmessung Arbeitsspindel zum Rundtisch, Längsrichtung — ungeklemmt', pruefmittel: 'Messuhr, Umschlagarm 150 mm', toleranz: '0,02 mm bei Ø 300 mm' },
          { key: 'umschlag_rundtisch_quer_geklemmt', nr: '12b', bezeichnung: 'Umschlagmessung Arbeitsspindel zum Rundtisch, Querrichtung — geklemmt', pruefmittel: 'Messuhr, Umschlagarm 150 mm', toleranz: '0,02 mm bei Ø 300 mm' },
          { key: 'umschlag_rundtisch_quer_offen', nr: '12b/U', bezeichnung: 'Umschlagmessung Arbeitsspindel zum Rundtisch, Querrichtung — ungeklemmt', pruefmittel: 'Messuhr, Umschlagarm 150 mm', toleranz: '0,02 mm bei Ø 300 mm' },
          { key: 'umschlag_aufsatz_laengs_geklemmt', nr: '12a/A', bezeichnung: 'Umschlagmessung Arbeitsspindel zum Aufsatz, Längsrichtung — geklemmt', pruefmittel: 'Messuhr, Umschlagarm 150 mm', toleranz: '0,02 mm bei Ø 300 mm' },
          { key: 'umschlag_aufsatz_laengs_offen', nr: '12a/AU', bezeichnung: 'Umschlagmessung Arbeitsspindel zum Aufsatz, Längsrichtung — ungeklemmt', pruefmittel: 'Messuhr, Umschlagarm 150 mm', toleranz: '0,02 mm bei Ø 300 mm' },
          { key: 'umschlag_aufsatz_quer_geklemmt', nr: '12b/A', bezeichnung: 'Umschlagmessung Arbeitsspindel zum Aufsatz, Querrichtung — geklemmt', pruefmittel: 'Messuhr, Umschlagarm 150 mm', toleranz: '0,02 mm bei Ø 300 mm' },
          { key: 'umschlag_aufsatz_quer_offen', nr: '12b/AU', bezeichnung: 'Umschlagmessung Arbeitsspindel zum Aufsatz, Querrichtung — ungeklemmt', pruefmittel: 'Messuhr, Umschlagarm 150 mm', toleranz: '0,02 mm bei Ø 300 mm' },
        ],
      },
      {
        titel: 'Referenzmaße für die Programmierung',
        punkte: [
          { key: 'ref_13', nr: '13', bezeichnung: 'Abstand Frässpindel — Referenzpunkt Längsachse (Bezug Zentrierbuchse)', pruefmittel: 'Messmittel n. Wahl', toleranz: '–' },
          { key: 'ref_13_aufsatz', nr: '13/A', bezeichnung: 'Abstand Frässpindel — Referenzpunkt Längsachse, Aufsatz', pruefmittel: 'Messmittel n. Wahl', toleranz: '–' },
          { key: 'ref_14', nr: '14', bezeichnung: 'Abstand Frässpindel — Referenzpunkt Querachse (Bezug Zentrierbuchse)', pruefmittel: 'Messmittel n. Wahl', toleranz: '–' },
          { key: 'ref_14_aufsatz', nr: '14/A', bezeichnung: 'Abstand Frässpindel — Referenzpunkt Querachse, Aufsatz', pruefmittel: 'Messmittel n. Wahl', toleranz: '–' },
          { key: 'ref_15', nr: '15', bezeichnung: 'Abstand Frässpindelkonus — Referenzpunkt Senkrechtachse (Bezug Aufspannfläche nahe Zentrierbuchse)', pruefmittel: 'Messmittel n. Wahl', toleranz: '–' },
          { key: 'ref_15_aufsatz', nr: '15/A', bezeichnung: 'Abstand Frässpindelkonus — Referenzpunkt Senkrechtachse, Aufsatz', pruefmittel: 'Messmittel n. Wahl', toleranz: '–' },
          { key: 'ref_16', nr: '16', bezeichnung: 'Abstand Frässpindelkonus — Referenzpunkt Längsachse, Spindel waagrecht (Bezug Zentrierbuchse)', pruefmittel: 'Messmittel n. Wahl', toleranz: '–' },
          { key: 'ref_16_aufsatz', nr: '16/A', bezeichnung: 'Abstand Frässpindelkonus — Referenzpunkt Längsachse, Spindel waagrecht, Aufsatz', pruefmittel: 'Messmittel n. Wahl', toleranz: '–' },
          { key: 'ref_17', nr: '17', bezeichnung: 'Abstand Frässpindel — Referenzpunkt Querachse, Spindel waagrecht (Bezug Zentrierbuchse)', pruefmittel: 'Messmittel n. Wahl', toleranz: '–' },
          { key: 'ref_17_aufsatz', nr: '17/A', bezeichnung: 'Abstand Frässpindel — Referenzpunkt Querachse, Spindel waagrecht, Aufsatz', pruefmittel: 'Messmittel n. Wahl', toleranz: '–' },
          { key: 'ref_18', nr: '18', bezeichnung: 'Abstand Frässpindel — Referenzpunkt Senkrechtachse, Spindel waagrecht (Bezug Aufspannfläche nahe Zentrierbuchse)', pruefmittel: 'Messmittel n. Wahl', toleranz: '–' },
          { key: 'ref_18_aufsatz', nr: '18/A', bezeichnung: 'Abstand Frässpindel — Referenzpunkt Senkrechtachse, Spindel waagrecht, Aufsatz', pruefmittel: 'Messmittel n. Wahl', toleranz: '–' },
          { key: 'ref_19', nr: '19', bezeichnung: 'Abstand Frässpindelkonus — Schwenkachse des Fräskopfs (nur Fräskopf mit Drehgeber)', pruefmittel: 'Messmittel n. Wahl', toleranz: '–' },
          { key: 'ref_20a', nr: '20a', bezeichnung: 'Versatz der Arbeitsspindelachse zur Schwenkachse, nach links (nur Fräskopf mit Drehgeber)', pruefmittel: 'Messmittel n. Wahl', toleranz: '–' },
          { key: 'ref_20b', nr: '20b', bezeichnung: 'Versatz der Arbeitsspindelachse zur Schwenkachse, nach rechts (nur Fräskopf mit Drehgeber)', pruefmittel: 'Messmittel n. Wahl', toleranz: '–' },
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
  if (m) return [{ label: `bis Messlänge ${m[2]}`, grenze: zahlAus(m[1]) }, { label: `bis Messlänge ${m[4]}`, grenze: zahlAus(m[3]) }]
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
    rundlauf_innenkegel_nah: 'h-maschine/09-rundlauf-innenkegel-arbeitsspindel.png',
    rundlauf_innenkegel_fern: 'h-maschine/09-rundlauf-innenkegel-arbeitsspindel.png',
    parallel_spindel_quer_a: 'h-maschine/10-parallelitaet-spindel-quer.png',
    parallel_spindel_quer_b: 'h-maschine/10-parallelitaet-spindel-quer.png',
    umschlag_senkrecht: 'h-maschine/11-umschlagmessung-senkrecht.png',
    umschlag_waagrecht: 'h-maschine/12-umschlagmessung-waagerecht.png',
    ref_13: 'h-maschine/13-abstand-fraesspindel-laengsachse.png',
    ref_14: 'h-maschine/14-abstand-spindelkonus-querachse.png',
    ref_15: 'h-maschine/15-abstand-fraesspindel-senkrechte-achse.png',
  },
  // T-Maschine: eigene Skizzen in t-maschine/, Nummer = Prüfung; 12 hat je eine für Rundtisch und Aufsatz.
  t_maschine: (() => {
    const t = (datei: string) => `t-maschine/${datei}`
    const je = (keys: string[], datei: string) => Object.fromEntries(keys.map((k) => [k, t(datei)]))
    return {
      ...je(['planlauf_rundtisch', 'planlauf_aufsatz', 'rundlauf_zentrierbuchse_rundtisch', 'rundlauf_zentrierbuchse_aufsatz'], '01-planlauf-rundlauf-aufspannflaeche.png'),
      ...je(['parallel_referenznut_starrtisch', 'parallel_referenznut_rundtisch', 'parallel_referenznut_aufsatz'], '02-parallelitaet-referenznut-laengs.png'),
      ...je(['parallel_aufspann_laengs_starrtisch', 'parallel_aufspann_laengs_rundtisch', 'parallel_aufspann_laengs_aufsatz'], '03-parallelitaet-aufspannflaeche-laengs.png'),
      ...je(['parallel_aufspann_quer_starrtisch_a', 'parallel_aufspann_quer_rundtisch', 'parallel_aufspann_quer_aufsatz', 'parallel_aufspann_quer_starrtisch_c'], '04-parallelitaet-aufspannflaeche-quer.png'),
      ...je(['rechtwinklig_senkr_quer_rundtisch', 'rechtwinklig_senkr_quer_aufsatz', 'rechtwinklig_senkr_laengs_rundtisch', 'rechtwinklig_senkr_laengs_aufsatz'], '05-rechtwinkligkeit-aufspannflaeche-senkrecht.png'),
      ...je(['rechtwinklig_quer_laengs_a', 'rechtwinklig_quer_laengs_b'], '06-rechtwinkligkeit-quer-laengs.png'),
      axialruhe_spindel: t('07-axialruhe-arbeitsspindel.png'),
      ...je(['rundlauf_innenkegel_nah', 'rundlauf_innenkegel_fern'], '08-rundlauf-innenkegel-arbeitsspindel.png'),
      ...je(['parallel_waag_spindel_laengs_a_geklemmt', 'parallel_waag_spindel_laengs_a_offen', 'parallel_waag_spindel_laengs_b_geklemmt', 'parallel_waag_spindel_laengs_b_offen'], '09-parallelitaet-waagrechte-spindel-laengs.png'),
      ...je(['umschlag_waag_spindel_a_geklemmt', 'umschlag_waag_spindel_a_offen', 'umschlag_waag_spindel_b_geklemmt', 'umschlag_waag_spindel_b_offen'], '10-umschlagmessung-waagrechte-spindel.png'),
      ...je(['parallel_spindel_senkr_a_geklemmt', 'parallel_spindel_senkr_a_offen', 'parallel_spindel_senkr_b_geklemmt', 'parallel_spindel_senkr_b_offen'], '11-parallelitaet-spindel-senkrecht.png'),
      ...je(['umschlag_rundtisch_laengs_geklemmt', 'umschlag_rundtisch_laengs_offen', 'umschlag_rundtisch_quer_geklemmt', 'umschlag_rundtisch_quer_offen'], '12-umschlagmessung-rundtisch.png'),
      ...je(['umschlag_aufsatz_laengs_geklemmt', 'umschlag_aufsatz_laengs_offen', 'umschlag_aufsatz_quer_geklemmt', 'umschlag_aufsatz_quer_offen'], '12-umschlagmessung-aufsatz.png'),
      ...je(['ref_13', 'ref_13_aufsatz'], '13-abstand-fraesspindel-laengsachse.png'),
      ...je(['ref_14', 'ref_14_aufsatz'], '14-abstand-fraesspindel-querachse.png'),
      ...je(['ref_15', 'ref_15_aufsatz'], '15-abstand-spindelkonus-senkrechte-achse.png'),
      ...je(['ref_16', 'ref_16_aufsatz'], '16-abstand-spindelkonus-laengsachse.png'),
      ...je(['ref_17', 'ref_17_aufsatz'], '17-abstand-fraesspindel-querachse.png'),
      ...je(['ref_18', 'ref_18_aufsatz'], '18-abstand-fraesspindel-senkrechte-achse.png'),
      ref_19: t('19-abstand-spindelkonus-schwenkachse.png'),
      ...je(['ref_20a', 'ref_20b'], '20-versatz-spindelachse-schwenkachse.png'),
    }
  })(),
}

/** Adresse der Skizze zu einem Prüfpunkt (berücksichtigt den Unterordner /neu/) — oder null. */
export function skizzeUrl(typ: MessprotokollTyp, key: string): string | null {
  const datei = SKIZZEN[typ]?.[key]
  return datei ? `${import.meta.env.BASE_URL}messprotokoll/skizzen/${datei}` : null
}
