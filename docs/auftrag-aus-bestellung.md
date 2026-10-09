# Anleitung: Auftrag aus einer Bestell-E-Mail anlegen (für Claude im Projekt)

Stand 09.10.2026, Entwurf. Manuel schreibt in den Projekt-Chat, dass eine neue Bestellung in den
E-Mails liegt. Claude liest die Mail (Microsoft-365-Connector, Postfach info@ / Manuel), legt den
Serviceauftrag in easybill und in der Service-App an und meldet die Auftragsnummer zurück.
Auf Wunsch folgt die Auftragsbestätigung.

## 1. Aus der Mail herauslesen

| Feld | Woher | Wohin |
|---|---|---|
| Auftraggeber (Rechnungsempfänger) | Absenderfirma bzw. Besteller | `orders.auftraggeber_id`, easybill-Auftrag läuft auf diesen Kunden |
| Einsatzkunde (wo gearbeitet wird) | Lieferadresse / Einsatzort; fehlt sie, = Auftraggeber | `orders.einsatzkunde_id` |
| Bestellnummer | „Bestellung Nr.“, „PO“, „Purchase Order“ | `orders.bestellnummer` |
| Kundenreferenznummer | „Referenz“, „Ihre Referenz“, PSG: „Kundenreferenznummer“ | `orders.kundenreferenznr` |
| Auftragsnummer des Kunden | „Auftrag Nr.“ des Kunden, falls getrennt von der Bestellnummer | `orders.auftragsnr_kunde` |
| Einsatzbeginn, Dauer | Termin / KW / „ab dem …“ | `orders.einsatzbeginn` (Datum), `orders.dauer_tage` |
| Maschine(n) | Typ und Maschinennummer | `order_machines` (Maschine muss beim Einsatzkunden existieren, sonst anlegen) |
| Meldetext | Was zu tun ist, in Manuels Worten kurz zusammengefasst | `orders.meldetext` |
| Ansprechpartner | Name, Telefon, Mail aus der Signatur | `ansprechpartner` beim Einsatzkunden, `orders.ansprechpartner_id` |
| Techniker | steht meist nicht in der Mail → Manuel fragen oder leer lassen | `order_techniker` |

Beträge und Positionen aus der Bestellung gehören NICHT in den Auftrag, sondern später in die
Auftragsbestätigung.

## 2. Kunde finden oder anlegen

- In der App: `customers` nach Name suchen (auch Teilstring, z. B. „PSG“, „Walther“).
- Jeder App-Kunde hat `kundennummer` (easybill) und `easybill_id`. Fehlen sie, Kunde zuerst in
  easybill suchen (`list_customers`, Firmenname) und die IDs in der App nachtragen.
- Neuer Kunde: Preisstufe bei Manuel erfragen (Stundensatz 79/84/89/99/94/135/105 €), dann in der
  App anlegen (`customers` mit `preisstufe`) und in easybill (`create_customer`, `sale_price_level`
  als „SALEPRICEn“), IDs zurückschreiben.
- Zwei Kunden mit gleichem Namen (Bosch Elchingen 10065 / Bosch Horb 10132): nach Adresse wählen.

## 3. Auftrag anlegen (Reihenfolge wichtig)

1. easybill zuerst: Serviceauftrag (Typ CHARGE) auf den Auftraggeber, Vorlage 90602, abschließen,
   damit easybill die Nummer vergibt. Bestellnummer / Kundenreferenz / Kundenauftragsnummer mit
   in den Auftrag schreiben (Kopftext).
   → Ab morgen über die Datenbankfunktion `easybill_auftrag_anlegen(...)` (geplant, siehe unten);
     solange die nicht existiert: Manuel bitten, den Auftrag in easybill anzulegen und die Nummer zu nennen.
2. App: `orders` mit `id` = easybill-Nummer anlegen (Status setzt der Trigger), dann
   `order_machines`, `order_techniker`.
3. Zurückmelden: Auftragsnummer, Kunde, Maschine, Termin, offene Punkte.

## 4. Nachfragen statt raten

- Einsatzkunde unklar, Maschine nicht im Stamm, Termin fehlt, Preisstufe eines neuen Kunden,
  Techniker: kurz bei Manuel nachfragen, Auftrag trotzdem schon anlegen, wenn Kunde und
  Auftraggeber klar sind.
- Nie Beträge erfinden. Nie eine Auftragsnummer selbst vergeben.

## 5. Geplant (noch nicht gebaut)

- `easybill_auftrag_anlegen(kunde_id, bestellnummer, kundenreferenz, auftragsnr_kunde)` als
  Postgres-Funktion mit pg_net/http und dem easybill-Schlüssel aus dem Vault, damit Claude-Threads
  per SQL den Auftrag mit Nummer anlegen können (die App nutzt dafür die Edge Function
  `easybill-rechnung`).
- Auftragsbestätigung aus der Bestell-E-Mail: Positionen/Beträge/Zeitraum übernehmen, easybill-Beleg
  CHARGE_CONFIRM (Vorlage 90607, Kopf fett mit Kundenreferenz und Bestellnummer), Versand per E-Mail.
