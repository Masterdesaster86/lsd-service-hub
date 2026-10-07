// Checkliste für das Wartungsprotokoll (Inspektion). Eigenständig aufgebaut und formuliert,
// orientiert an den üblichen Inspektionspunkten einer Werkzeugmaschine — kein Nachbau eines
// Hersteller-Formulars.
//
// Je Prüfpunkt wird in `werte` gespeichert:
//   key                → Status: 'geprueft' | 'nicht_moeglich' | 'entfaellt' ('' = offen)
//   key__ergebnis      → '1' in Ordnung · '2' erste Verschleißspuren · '3' Verschleißgrenze erreicht
//   key__reparatur     → '1' = Reparatur / Tausch / Justage durchgeführt
//   key__angebot       → '1' = Angebot vom Kunden gewünscht
//   key__bemerkung     → freier Text
//   _bemerkung         → Bemerkung zum ganzen Protokoll

export type WartungStatus = 'geprueft' | 'nicht_moeglich' | 'entfaellt'
export type WartungErgebnis = '1' | '2' | '3'

export interface Wartungspunkt {
  key: string
  bezeichnung: string
  /** 'erledigt': nur abhaken (z.B. Inspektionsanzeige zurücksetzen), kein Ergebnis 1–3. */
  art?: 'pruefung' | 'erledigt'
}

export interface Wartungsabschnitt {
  titel?: string
  punkte: Wartungspunkt[]
}

export interface Wartungsgruppe {
  titel: string
  abschnitte: Wartungsabschnitt[]
}

export const WARTUNG_STATUS_TEXT: Record<WartungStatus, string> = {
  geprueft: 'Geprüft',
  nicht_moeglich: 'Nicht möglich',
  entfaellt: 'Entfällt',
}

export const WARTUNG_ERGEBNIS_TEXT: Record<WartungErgebnis, string> = {
  '1': 'In Ordnung',
  '2': 'In Ordnung, jedoch erste Verschleißspuren — Austausch kurzfristig empfohlen',
  '3': 'Nicht in Ordnung, Verschleißgrenze erreicht — Austausch schnellstmöglich erforderlich',
}

export const WARTUNG_HINWEIS =
  'Die Inspektion stellt den Zustand der Maschine zum Zeitpunkt der Inspektion fest. Reparaturen sowie die ' +
  'Lieferung von Ersatz-, Verschleiß- oder sonstigen Teilen sind nicht Bestandteil dieses Auftrags; dafür ' +
  'erstellen wir auf Wunsch ein gesondertes Angebot. Wir empfehlen, Wartungs- und Austauscharbeiten nach den ' +
  'Herstellervorgaben in der Betriebsanleitung der Maschine durchzuführen. Es gelten die Allgemeinen ' +
  'Geschäftsbedingungen der LSD Maschinenservice (www.lsd-maschinenservice.de/agb-s/).'

const p = (key: string, bezeichnung: string, art?: 'erledigt'): Wartungspunkt => (art ? { key, bezeichnung, art } : { key, bezeichnung })

export const WARTUNG_GRUPPEN: Wartungsgruppe[] = [
  {
    titel: 'Medienversorgung',
    abschnitte: [
      {
        titel: 'Pneumatik',
        punkte: [
          p('pneu_filter_versorgung', 'Filterelement Versorgungseinheit'),
          p('pneu_filter_hauptantrieb', 'Filterelement Hauptantrieb / Motorspindel'),
          p('pneu_filter_messsysteme', 'Filterelement Messsysteme / Sperrluft'),
          p('pneu_filter_sonstige', 'Weitere Filterelemente'),
          p('pneu_druck', 'Druckeinstellungen nach Pneumatikplan'),
          p('pneu_wasserabscheider', 'Automatischer Wasserabscheider (Sichtprüfung)'),
        ],
      },
      {
        titel: 'Hydraulik',
        punkte: [
          p('hyd_fuellstand', 'Füllstand'),
          p('hyd_druckspeicher', 'Druckspeicher nach Vorgabe geprüft'),
          p('hyd_druck', 'Systemdruck und Schaltintervall der Pumpe nach Hydraulikplan'),
        ],
      },
      {
        titel: 'Kühler und Lüfter',
        punkte: [
          p('kuehl_fuellstand', 'Füllstand'),
          p('kuehl_temperatur', 'Temperatureinstellung nach Herstellerangabe'),
          p('kuehl_mischung', 'Mischungsverhältnis nach Herstellerangabe'),
          p('kuehl_filtermatten', 'Zustand Filtermatten'),
          p('kuehl_medium', 'Kühlmedium (Sorte) nach Herstellerangabe'),
        ],
      },
      {
        titel: 'Zentralschmierung',
        punkte: [
          p('schmier_fuehrungen', 'Schmierung Führungsbahnen (Fettaustritt, Dichtheit)'),
          p('schmier_zustand', 'Zustand Schmiermedium'),
          p('schmier_fuellstand', 'Füllstand'),
          p('schmier_medium', 'Schmiermedium nach Herstellerangabe'),
        ],
      },
    ],
  },
  {
    titel: 'Abdeckungen',
    abschnitte: [
      {
        titel: 'Zustand Abdeckungen',
        punkte: [p('abd_jalousien', 'Jalousien / Schiebebleche'), p('abd_abstreifer', 'Abstreifer')],
      },
    ],
  },
  {
    titel: 'Achsantriebe',
    abschnitte: [
      {
        titel: 'Kugelgewindetrieb / Linearantrieb / Antriebe Rundachsen',
        punkte: [p('achs_sicht', 'Sichtprüfung'), p('achs_geraeusche', 'Geräusche'), p('achs_vibration', 'Vibrationen')],
      },
    ],
  },
  {
    titel: 'Hauptantrieb',
    abschnitte: [
      {
        titel: 'Motorspindel',
        punkte: [
          p('sp_einzug', 'Einzugskraft und Ausstoßmaß'),
          p('sp_rundlauf', 'Rundlauf Spindelkonus (300 mm von der Spindelnase)'),
          p('sp_konus', 'Sichtprüfung Spindelkonus'),
          p('sp_nutenstein', 'Sichtprüfung Nutenstein'),
          p('sp_oelnebel', 'Funktion Öl-/Nebelschmierung'),
          p('sp_sperrluft', 'Funktion Sperrluft'),
          p('sp_filtermatten', 'Filtermatten Lüfter (nur bei luftgekühlter Spindel)'),
        ],
      },
      {
        titel: 'Leckageprüfung',
        punkte: [p('leck_ueberwachung', 'Ansprechverhalten der Leckageüberwachung'), p('leck_volumen', 'Kontrolle Leckagevolumen')],
      },
    ],
  },
  {
    titel: 'Werkzeugwechsler und Werkzeugmagazin',
    abschnitte: [
      {
        titel: 'Werkzeugwechsler',
        punkte: [
          p('ww_funktion', 'Allgemeine Funktion des Wechslers (Sichtprüfung)'),
          p('ww_greifer', 'Verschleißzustand Werkzeuggreifer'),
          p('ww_sensoren', 'Sensoreinstellungen'),
        ],
      },
      {
        titel: 'Werkzeugmagazin',
        punkte: [
          p('wm_sensoren', 'Sensoreinstellungen'),
          p('wm_oeffnen', 'Öffnungs- und Schließmechanismus'),
          p('wm_plaetze', 'Bezeichnung der Magazinplätze'),
          p('wm_halter', 'Köcher und Werkzeugklammern / -halter'),
        ],
      },
    ],
  },
  {
    titel: 'Kühlschmierstoffanlage',
    abschnitte: [
      {
        punkte: [
          p('kss_behaelter', 'Verschmutzung des Kühlschmierstoffbehälters'),
          p('kss_druck', 'Pumpendruck der Hochdruckpumpen'),
          p('kss_fuellstand', 'Füllstandsüberwachung'),
          p('kss_filter', 'Überwachung Rollenende / Papierbandfilter'),
        ],
      },
    ],
  },
  {
    titel: 'Maschinenverkleidung und Schaltschrank',
    abschnitte: [
      {
        titel: 'Maschinenverkleidung',
        punkte: [p('verk_scheiben', 'Sichtprüfung Scheiben'), p('verk_tuerschalter', 'Funktion Türschalter'), p('verk_notaus', 'Funktion NOT-HALT-Taster')],
      },
      {
        titel: 'Schaltschrank',
        punkte: [
          p('ss_abdichtung', 'Abdichtung'),
          p('ss_kuehler', 'Funktion Schaltschrankkühler / Filterlüfter'),
          p('ss_luefter', 'Lüfter und Filter sauber, Stellerentwärmung'),
          p('ss_filtermatten', 'Zustand Filtermatten'),
        ],
      },
    ],
  },
  {
    titel: 'Optionen',
    abschnitte: [
      {
        punkte: [
          p('opt_handling', 'Werkstückhandling'),
          p('opt_messtaster', 'Werkstückmessung / Messtaster'),
          p('opt_wzmess', 'Werkzeugmessung'),
          p('opt_oelnebel', 'Ölnebelabsaugung'),
          p('opt_1', 'Weitere Option 1 (Bezeichnung in der Bemerkung)'),
          p('opt_2', 'Weitere Option 2 (Bezeichnung in der Bemerkung)'),
        ],
      },
    ],
  },
  {
    titel: 'Inspektionsanzeige',
    abschnitte: [
      {
        punkte: [
          p('insp_reset', 'Inspektionsanzeige an der Steuerung zurückgesetzt', 'erledigt'),
          p('insp_erlaeutert', 'Inspektionsergebnis mit dem Kunden besprochen', 'erledigt'),
        ],
      },
    ],
  },
]

export const WARTUNG_BEMERKUNG_KEY = '_bemerkung'
export const wErgebnisKey = (key: string) => `${key}__ergebnis`
export const wReparaturKey = (key: string) => `${key}__reparatur`
export const wAngebotKey = (key: string) => `${key}__angebot`
export const wBemerkungKey = (key: string) => `${key}__bemerkung`

/** Alle Prüfpunkte als flache Liste, mit Gruppe und Abschnitt. */
export function alleWartungspunkte(): (Wartungspunkt & { gruppe: string; abschnitt?: string })[] {
  return WARTUNG_GRUPPEN.flatMap((g) => g.abschnitte.flatMap((a) => a.punkte.map((pt) => ({ ...pt, gruppe: g.titel, abschnitt: a.titel }))))
}

export function wartungStatus(werte: Record<string, string>, key: string): WartungStatus | null {
  const s = werte[key]
  return s === 'geprueft' || s === 'nicht_moeglich' || s === 'entfaellt' ? s : null
}

export function wartungErgebnis(werte: Record<string, string>, key: string): WartungErgebnis | null {
  const e = werte[wErgebnisKey(key)]
  return e === '1' || e === '2' || e === '3' ? e : null
}
