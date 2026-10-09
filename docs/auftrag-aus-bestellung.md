---
name: auftrag-aus-bestellung
description: Serviceauftrag für LSD Maschinenservice aus einer Bestell-E-Mail anlegen (easybill + Service-App) und auf Wunsch die Auftragsbestätigung erstellen. Immer anwenden, wenn Manuel sagt, dass eine neue Bestellung in den E-Mails liegt, ein Auftrag angelegt werden soll oder eine Bestellung bestätigt werden soll.
---

# Auftrag aus einer Bestell-E-Mail anlegen

Gilt in jedem Chat und Projekt. Manuel meldet „neue Bestellung in den E-Mails“ (oder nennt den
Kunden). Claude liest die Mail, legt den Serviceauftrag in easybill und in der Service-App an und
meldet die Auftragsnummer zurück. Auf Wunsch folgt die Auftragsbestätigung.

Systeme:
- Service-App: Supabase-Projekt `cyvjcskxqluqmerjxqty` (nur Produktion), Code in
  `C:\Users\Manue\Documents\lsd-service-hub`. Schreiben nur, wenn Manuel den Auftrag will;
  vorher die Mail und die Zuordnung kurz zusammenfassen.
- easybill: Connector „Easybill“ (Kunden, Artikel, Belege). Der Connector legt Belege nur als
  Entwurf an und kann nicht abschließen → über ihn gibt es keine Auftragsnummer (siehe Schritt 3).
- E-Mails: Microsoft-365-Connector (Postfach von Manuel / info@).

## 1. Aus der Mail herauslesen

| Feld | Woher in der Mail | Wohin |
|---|---|---|
| Auftraggeber (Rechnungsempfänger) | Absenderfirma bzw. Besteller | `orders.auftraggeber_id`; easybill-Auftrag läuft auf diesen Kunden |
| Einsatzkunde (wo gearbeitet wird) | Lieferadresse / Einsatzort; fehlt sie, = Auftraggeber | `orders.einsatzkunde_id` |
| Bestellnummer | „Bestellung Nr.“, „PO“, „Purchase Order“ | `orders.bestellnummer` |
| Kundenreferenznummer | „Referenz“, „Ihre Referenz“, PSG: „Kundenreferenznummer“ | `orders.kundenreferenznr` |
| Auftragsnummer des Kunden | eigene „Auftrag Nr.“ des Kunden, falls getrennt von der Bestellnummer | `orders.auftragsnr_kunde` |
| Einsatzbeginn, Dauer | Termin, KW, „ab dem …“ | `orders.einsatzbeginn` (Datum), `orders.dauer_tage` |
| Maschine(n) | Typ und Maschinennummer | `order_machines`; Maschine muss beim Einsatzkunden existieren, sonst anlegen (`machines`) |
| Meldetext | Was zu tun ist, kurz in eigenen Worten | `orders.meldetext` |
| Ansprechpartner | Name, Telefon, Mail aus der Signatur | `ansprechpartner` beim Einsatzkunden, `orders.ansprechpartner_id` |
| Techniker | steht meist nicht in der Mail → Manuel fragen oder leer lassen | `order_techniker` |

Beträge und Positionen aus der Bestellung gehören NICHT in den Auftrag, sondern in die
Auftragsbestätigung (Schritt 5).

## 2. Kunde finden oder anlegen

- App: `customers` nach Name suchen (Teilstring reicht, z. B. „PSG“, „Walther“). Jeder App-Kunde
  trägt `kundennummer` (easybill) und `easybill_id`; fehlen sie, in easybill suchen
  (`list_customers`, Firmenname) und beide IDs in der App nachtragen.
- Gleicher Name, zwei Kunden (Bosch Rexroth Elchingen = easybill 10065, Bosch Rexroth Horb =
  10132): nach Adresse entscheiden.
- Neuer Kunde: Preisstufe bei Manuel erfragen (Stundensatz Arbeitszeit 79 Standard / 84 Stufe 2 /
  89 Stufe 3 / 99 Stufe 4 / 94 Stufe 5 / 135 Stufe 6 / 105 Stufe 7 €). Dann in easybill anlegen
  (`create_customer`, `sale_price_level` als „SALEPRICE2“ … „SALEPRICE7“, Standard leer) und in der
  App (`customers` mit `name, strasse, plz, ort, rechnungs_email, preisstufe, easybill_id,
  kundennummer`). Österreichische PLZ in der App als „A-6682“.

## 3. Auftrag anlegen – Reihenfolge einhalten

1. **easybill zuerst**, weil easybill die Auftragsnummer vergibt: Serviceauftrag (Typ CHARGE) auf
   den Auftraggeber, Vorlage 90602, Kopftext fett mit den Zeilen, die vorhanden sind:
   „Ihre Bestellnummer: …“, „Kundenreferenznummer: …“, „Auftragsnummer Kunde: …“. Dann abschließen.
   - Das macht die Datenbankfunktion, aufgerufen per Supabase-Connector (SQL ausführen):
     ```sql
     select public.easybill_auftrag_anlegen(
       '<uuid des Auftraggebers aus customers>',
       '<Bestellnummer oder null>', '<Kundenreferenznummer oder null>', '<Auftragsnummer Kunde oder null>'
     );
     ```
     Antwort: `{"nummer": "10112", "easybill_id": …, "kunde_easybill_id": …}`. Die `nummer` ist die
     Auftragsnummer. Fehlt der Kunde in easybill, legt die Funktion ihn dort mit an.
   - Der easybill-Connector selbst kann das nicht (er legt nur Entwürfe ohne Nummer an); deshalb
     nie den Auftrag über `create_document` anlegen. Niemals selbst eine Nummer ausdenken.
   - Schlägt die Funktion fehl (z. B. „Schlüssel fehlt im Vault“): Manuel sagen, was fehlt, und
     ihn um die Nummer aus easybill bitten.
2. **App**: `orders` mit `id` = easybill-Nummer (Text), `auftraggeber_id`, `einsatzkunde_id`,
   `bestellnummer`, `kundenreferenznr`, `auftragsnr_kunde`, `einsatzbeginn`, `dauer_tage`,
   `meldetext`, `ansprechpartner_id`. Den Status setzt ein Trigger, nicht selbst setzen.
   Danach `order_machines (order_id, machine_id)` und `order_techniker (order_id, techniker_id)`.
3. **Zurückmelden**: Auftragsnummer, Auftraggeber/Einsatzkunde, Maschine, Termin, Techniker,
   und was noch fehlt.

### Auftrag stornieren (nur ohne Servicebericht, nicht umkehrbar)

```sql
select public.easybill_auftrag_stornieren('<Auftragsnummer>');
```
Setzt den Auftrag in easybill auf storniert und in der App auf Status „storniert“ (die Nummer
bleibt vergeben). Nur auf Manuels ausdrückliche Bitte.

## 4. Nachfragen statt raten

- Unklar: Einsatzkunde, Maschine nicht im Stamm, Termin, Preisstufe eines neuen Kunden,
  Techniker → kurz bei Manuel nachfragen. Den Auftrag trotzdem schon anlegen, wenn Auftraggeber
  und Kunde klar sind; Fehlendes nachtragen.
- Nie Beträge erfinden, nie Nummern selbst vergeben, nie Testdaten in der Produktion lassen.

## 5. Auftragsbestätigung (wenn Manuel sie will)

- easybill-Beleg Typ Auftragsbestätigung (CHARGE_CONFIRM) aus dem Serviceauftrag, Vorlage 90607.
  Kopftext fett: „Kundenreferenznummer: …“ und „PSG-Bestellnummer: …“ bzw. „Ihre Bestellnummer: …“.
  Positionen, Beträge und Zeitraum genau so, wie sie in der Bestellung stehen (z. B. „DL Techniker,
  1 Leistungseinheit, KW 42“ mit dem bestellten Nettobetrag).
- Versand per E-Mail aus easybill an die Adresse aus der Bestellung; vorher Manuel die Vorschau
  zeigen (Empfänger, Betrag, Nummern). Manuel schließt Rechnungen immer selbst ab; die
  Auftragsbestätigung darf nach seinem Okay versendet werden.
