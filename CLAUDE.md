# LSD Service Hub — Hinweise für Claude

Interne Service-App von LSD Maschinenservice (Aufträge, Serviceberichte mit Unterschrift,
Messprotokolle, Plantafel, Verwaltung). Ansprechpartner ist Manuel Lautenbacher (CEO, kein
Entwickler): auf Deutsch antworten, verständlich erklären, Ergebnisse knapp zusammenfassen.

## Technik

- React 19 + TypeScript + Vite + React Router 7, Tailwind v4 (Tokens per `@theme` in `src/index.css`).
- Supabase-Projekt `cyvjcskxqluqmerjxqty` — **es gibt nur die Produktivdatenbank**. Testdaten nach
  dem Testen wieder entfernen, bei Schreibzugriffen vorher kurz nachfragen.
- Typprüfung: `npx tsc -b`. Dev-Server über die Vorschau (`.claude/launch.json`, Name `lsd-dev`,
  läuft mit `--host`, damit Manuel vom Handy unter der LAN-Adresse testen kann).
- Unter Windows bemerkt der Vite-Dev-Server Dateiänderungen manchmal nicht — wenn die Vorschau
  alten Code zeigt, Server neu starten.
- Mehrzeiligen Code nicht per Bash-Heredoc schreiben (Backticks/`${}` gehen kaputt), sondern mit
  Write/Edit. Dateien haben teils CRLF-Zeilenenden.

## Zweige und Auslieferung (IONOS, per GitHub Action `.github/workflows/deploy-ionos.yml`)

- `main` → https://lsd-maschinenservice-app.de/ (die App, die alle benutzen)
- `redesign` → https://lsd-maschinenservice-app.de/neu/ (neues Design, Testphase)
- Push genügt, die Action baut und lädt hoch (ca. 1–3 Minuten).
- Umschalter „Bisher / Neu (Test)“ (`src/lib/designwahl.ts`, `DesignSchalter`) — Wahl wird pro
  Gerät gemerkt. Neue Arbeit gehört auf `redesign`. Erst nach Manuels Freigabe `redesign` nach
  `main` mergen und Umschalter + `/neu` entfernen. Dringende Fixes für alle einzeln auf `main`.

## Design (Zweig `redesign`)

- Handy zuerst für alle Seiten; die Plantafel ist für den Desktop (`PlantafelDesktop`), am Handy
  gibt es `PlantafelMobil`. Unterschrift ist fürs Tablet optimiert.
- Farben: Tinte `#14181d`, Papier `#eef0ee`, Akzent `#2764ad` (heißt im Code noch „amber“),
  Linien `#ccd3d2`. Schriften Big Shoulders Display / IBM Plex Sans / IBM Plex Mono (@fontsource).
- Bausteine: `.btn`, `.btn-amber`, `.btn-outline`, `.tag …` in `@layer components`;
  `ui/Icon`, `ui/Typenschild`, `ui/Suchfeld`, `ui/Modal` (Bottom-Sheet am Handy), `ui/TimeSelect`.
- PDFs (Servicebericht, Messprotokoll, Stundennachweis) nutzen seit 06.10.2026 das neue Logo (Rechnungen sind umgestellt).

## Offline-Modus (seit 06.10.2026 auf `redesign`)

- `src/lib/offline.ts` ist die `global.fetch` des Supabase-Clients: GET/rpc werden in IndexedDB
  gemerkt und ohne Netz von dort beantwortet; insert/update/delete und Storage-Uploads gehen ohne
  Netz in eine Warteschlange (synthetische Erfolgsantwort) und werden mit Netz der Reihe nach
  hochgeladen. Wartende Änderungen werden beim Lesen über die Antworten gelegt.
- Neue Zeilen in `serviceberichte`, `servicebericht_tage`, `servicebericht_ersatzteile`,
  `messprotokolle` bekommen ihre UUID auf dem Gerät (doppeltes Hochladen → 23505 = erledigt).
- `public/sw.js` + `precache.json` (Vite-Plugin in `vite.config.ts`): App startet ohne Netz.
- Anzeige/Dialog: `components/OfflineStatus.tsx`; „Für Einsatz vorbereiten“ (`lib/vorbereiten.ts`)
  öffnet die relevanten Seiten in unsichtbaren iframes, damit ihre Abfragen gespeichert werden.
- AuthContext nutzt offline die gespeicherte Anmeldung, auch wenn das Token abgelaufen ist.
- Am 06.10.2026 von Manuel mit echtem Login getestet (Bericht + 2 Tage offline angelegt, mit Netz korrekt hochgeladen).

## Messprotokoll

- Prüfpunkt-Kataloge (Schwenkkopf, H-Maschine) in `src/lib/messprotokoll.ts`. Eigene
  Formulierungen — **keine Texte, Skizzen oder Formularnummern vom Hersteller übernehmen**.
- Werte liegen in `messprotokolle.werte` (JSON): Messwert unter `key`, Bemerkung `key__bemerkung`,
  gewählte Toleranzstufe `key__stufe`, Ergebnis zum Protokoll `_ergebnis`.
- Gestaffelte Toleranzen: Auswahl per `toleranzstufen()`, danach automatische Prüfung.
- Skizzen: `public/messprotokoll/skizzen/` (Schwenkkopf-Nummerierung) und `…/skizzen/h-maschine/`.
  Manuel zeichnet sie selbst, Quellen liegen in `D:\lsd-protokoll\skizzen`. Format PNG 2400×1440.
- Beim Blättern zwischen Messungen wird automatisch gespeichert (echte Datenbank!).

## Regeln

- Nie Passwörter oder Schlüssel eintippen oder im Chat ausgeben — das macht Manuel selbst.
- Downloads nur nach Rückfrage.

## Offene Punkte (Stand 05.10.2026)

- Neues Design testen und dann freigeben (redesign → main).
- Texte im Messprotokoll will Manuel später noch überarbeiten.
- Skizzen 8 und 9: Text „8b/9b nur bei HSK-32, 40, 50“ passt nicht zum Katalog (dort: Abstand
  150 statt 300 mm bei HSK 32/40/50) — Manuel prüft.
- Offene Frage: zweites offenes Messprotokoll am SB-2026-0030 (04.10.) — behalten oder löschen?
- Offene Frage: soll „Genehmigen“ in der Plantafel ohne Rückfrage gehen?
- `D:\lsd-protokoll\skizzen\quellen\` (verworfene Entwürfe von Claude) kann gelöscht werden.
