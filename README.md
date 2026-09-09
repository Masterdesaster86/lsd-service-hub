# LSD Service Hub

React-App (Vite + React 19 + TypeScript + Tailwind v4) für den internen Serviceprozess von LSD Maschinenservice — Kunden, Maschinen, Serviceaufträge, Serviceberichte mit digitaler Unterschrift, Plantafel und Mitarbeiterverwaltung. Datenbank & Auth laufen über Supabase (Projekt "Servicehub", `cyvjcskxqluqmerjxqty`).

## Starten

```bash
npm install
npm run dev
```

Die Supabase-URL und der Anon-Key liegen in `.env.local` (nicht eingecheckt).

## Login (Testzugänge)

Für alle 5 bestehenden Mitarbeiter wurden Supabase-Auth-Konten mit folgendem Test-Passwort angelegt:

```
LSDService2026!
```

E-Mails: `admin@lsd-maschinenservice.de`, `manuel.lautenbacher@lsd-maschinenservice.de`, `daniel.schimpf@lsd-maschinenservice.de`, `simon.dirr@lsd-maschinenservice.de`, `lena.kobold@lsd-maschinenservice.de`.

**Bitte die Passwörter zeitnah im Supabase-Dashboard (Authentication → Users) ändern**, bevor die App produktiv genutzt wird.

## Was gebaut wurde

- Login (Supabase Auth) mit rollenbasierter Navigation (Administrator / Disposition / Techniker), Rollen/Sichtbarkeit vollständig über Postgres RLS gesteuert, nicht im Frontend.
- Serviceaufträge: Liste mit Status-Tabs, Anlegen/Bearbeiten/Löschen (nur Admin/Disposition), Detailansicht.
- Serviceberichte: Zeiterfassung im 15-Minuten-Raster mit automatischer Überstunden-/Zuschlagsberechnung (10h-Schwelle, Samstag +50 %, Sonn-/Feiertag +100 %), Verpflegungsmehraufwand, Ersatzteile, digitale Unterschrift (Canvas → Supabase Storage), Rückreise-Nachtrag als separater Bericht.
- Kunden, Ansprechpartner, Maschinen (inkl. Stammdaten, Serviceberichts-Historie, offene Arbeiten, interne Notizen, Fotos in Supabase Storage).
- Plantafel: Wochenraster mit Drag & Drop, Abwesenheiten blockieren Tage, Urlaubsanträge genehmigen/ablehnen.
- Meine Verwaltung (Techniker): Fehlzeiten melden, Urlaub beantragen, Monats-Stundennachweis.
- Mitarbeiterverwaltung (Administrator): Anlegen/Bearbeiten/Deaktivieren.

## Während des Aufbaus behobene Punkte im Supabase-Schema

- **RLS-Rekursion**: Die SELECT-Policy von `order_techniker` verwies auf `orders`, dessen eigene Policy wiederum `order_techniker` abfragte → Postgres-Fehler „infinite recursion" bei jeder Abfrage, die Aufträge mit Technikern lud. Durch eine eigenständige Policy auf `order_techniker` behoben (Migration `fix_order_techniker_rls_recursion`).
- `search_path` für alle `SECURITY DEFINER`/Trigger-Funktionen explizit auf `public` gesetzt (Supabase-Linter-Empfehlung, keine Verhaltensänderung).
- Zwei Storage-Buckets angelegt: `signatures` (Servicebericht-Unterschriften) und `machine-photos` (Maschinenbilder), beide mit Policies (öffentlich lesbar, nur eingeloggte Mitarbeiter dürfen hochladen).

## Bekannte offene Punkte

- **Mitarbeiter-Login anlegen**: Das Formular "Neuer Mitarbeiter" legt nur den `employees`-Datensatz an. Für einen echten Login muss zusätzlich im Supabase-Dashboard unter Authentication ein Benutzerkonto mit derselben E-Mail angelegt und dessen Auth-User-ID in `employees.auth_user_id` eingetragen werden (SQL: `update employees set auth_user_id = '<uuid>' where email = '...'`). Automatisieren ließe sich das über eine Supabase Edge Function mit der Admin-API.
- **PDF-Export** (Servicebericht, Stundennachweis) ist im Prototyp nur angedeutet und hier noch nicht implementiert (Platzhalter-Meldung).
- **Leaked Password Protection** ist in Supabase Auth noch deaktiviert — Empfehlung: unter Authentication → Policies aktivieren.
- Es lohnt sich, den Datenbank-Build (`npm run build`) meldet einen Hinweis auf ein großes JS-Bundle (>500 kB) — für den aktuellen internen Nutzerkreis unkritisch, bei Bedarf per Code-Splitting (`React.lazy`) optimierbar.
