// Rechnung aus Serviceberichten in easybill anlegen.
//
// Die App rechnet die Positionen selbst aus (gleiche Zeitlogik wie im Servicebericht) und
// schickt den fertigen Plan hierher. Diese Funktion spricht mit easybill: Auftrag suchen,
// Preisstufe des Kunden lesen, Preise aus dem Artikelkatalog holen, Auftrag in einen
// Rechnungsentwurf umwandeln, Positionen und Texte setzen, Bericht-PDFs anhaengen.
// Spaeter prueft sie, ob der Entwurf abgeschlossen wurde, und setzt die Berichte auf abgerechnet.
//
// Der easybill-API-Schluessel liegt nur hier als Secret (EASYBILL_API_KEY) und verlaesst den
// Server nie. Aufrufen darf das nur das Buero (Administrator, Disposition, CEO).

import { createClient } from 'jsr:@supabase/supabase-js@2'
import { createRemoteJWKSet, jwtVerify } from 'npm:jose@5'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const EASYBILL = 'https://api.easybill.de/rest/v1'
const VORLAGE_RECHNUNG = '90597' // unser Briefpapier
const ZAHLUNGSZIEL_TAGE = 14
const BUERO = ['Administrator', 'Disposition', 'CEO']

function antwort(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })
}

const jwks = createRemoteJWKSet(new URL(`${Deno.env.get('SUPABASE_URL')}/auth/v1/.well-known/jwks.json`))

async function nutzerAusToken(admin: ReturnType<typeof createClient>, token: string): Promise<string | null> {
  const { data, error } = await admin.auth.getUser(token)
  if (!error && data?.user) return data.user.id
  try {
    const { payload } = await jwtVerify(token, jwks)
    return typeof payload.sub === 'string' ? payload.sub : null
  } catch {
    return null
  }
}

// ---------- easybill ----------

class EasybillFehler extends Error {
  status: number
  constructor(status: number, text: string) { super(text); this.status = status }
}

async function eb(pfad: string, init: RequestInit = {}) {
  const key = Deno.env.get('EASYBILL_API_KEY')
  if (!key) throw new EasybillFehler(500, 'Der easybill-API-Schlüssel ist noch nicht hinterlegt (Secret EASYBILL_API_KEY).')
  const headers = new Headers(init.headers || {})
  headers.set('Authorization', `Bearer ${key}`)
  headers.set('Accept', 'application/json')
  if (init.body && typeof init.body === 'string') headers.set('Content-Type', 'application/json')
  const res = await fetch(`${EASYBILL}${pfad}`, { ...init, headers })
  if (res.status === 429) {
    // easybill drosselt: kurz warten und einmal wiederholen
    await new Promise((r) => setTimeout(r, 1500))
    return eb(pfad, init)
  }
  const text = await res.text()
  if (!res.ok) {
    let meldung = text
    try { meldung = JSON.parse(text).message || text } catch { /* Text bleibt */ }
    throw new EasybillFehler(res.status, `easybill (${res.status}): ${meldung}`)
  }
  return text ? JSON.parse(text) : null
}

type EbPosition = {
  id: number; number: string | null; description: string; unit: string | null; archived: boolean
  type: string; vat_percent: number
  sale_price: number | null; sale_price2: number | null; sale_price3: number | null; sale_price4: number | null; sale_price5: number | null
  sale_price6: number | null; sale_price7: number | null; sale_price8: number | null; sale_price9: number | null; sale_price10: number | null
}

/** Preis eines Artikels in der Preisstufe des Kunden (easybill: SALEPRICE, SALEPRICE2 … SALEPRICE10). Cent → Euro. */
function preisFuerStufe(p: EbPosition, stufe: string): number | null {
  const n = stufe.replace('SALEPRICE', '')
  const feld = (n === '' ? 'sale_price' : `sale_price${n}`) as keyof EbPosition
  const wert = p[feld]
  return typeof wert === 'number' ? wert / 100 : null
}

async function alleArtikel(): Promise<EbPosition[]> {
  const alle: EbPosition[] = []
  for (let seite = 1; seite < 20; seite++) {
    const r = await eb(`/positions?limit=1000&page=${seite}`)
    alle.push(...(r.items || []))
    if (seite >= (r.pages || 1)) break
  }
  return alle
}

/** Den easybill-Serviceauftrag (Typ CHARGE) mit unserer Auftragsnummer finden. */
async function auftragSuchen(nummer: string) {
  const r = await eb(`/documents?type=CHARGE&number=${encodeURIComponent(nummer)}&limit=10`)
  const treffer = (r.items || []).filter((d: { number: string }) => d.number === nummer)
  if (treffer.length === 0) return null
  // Bei mehreren den juengsten nehmen
  treffer.sort((a: { id: number }, b: { id: number }) => b.id - a.id)
  return treffer[0]
}

// ---------- Aktionen ----------

type PlanPosition = {
  typ: 'TEXT' | 'POSITION'
  text?: string
  position_id?: number
  menge?: number
  einheit?: string
  /** Fester Preis (Euro) statt Katalogpreis, z. B. Hotelkosten oder die Vils-Pauschale. */
  preis?: number | null
}

type Plan = {
  auftrag_id: string
  titel: string
  text_prefix: string
  text: string
  leistung_von: string
  leistung_bis: string
  positionen: PlanPosition[]
  bericht_ids: string[]
  pdfs?: { name: string; base64: string }[]
}

/** Preise aus dem Katalog holen und fehlende melden. Gibt die easybill-Items zurueck. */
async function itemsAusPlan(plan: Plan, preisstufe: string, vatProzent: number) {
  const ids = [...new Set(plan.positionen.filter((p) => p.typ === 'POSITION' && p.position_id).map((p) => p.position_id!))]
  const artikel = new Map<number, EbPosition>()
  await Promise.all(ids.map(async (id) => { artikel.set(id, await eb(`/positions/${id}`)) }))

  const fehlend: string[] = []
  const items = plan.positionen.map((p, i) => {
    if (p.typ === 'TEXT') return { type: 'TEXT', position: i + 1, description: p.text || '', quantity: 0, vat_percent: 0 }
    const a = artikel.get(p.position_id!)
    if (!a) { fehlend.push(`Artikel ${p.position_id} nicht in easybill gefunden`); return null }
    let preis = p.preis ?? preisFuerStufe(a, preisstufe)
    if (preis == null) {
      // Ersatzteile und Pauschalen haben oft nur den Standardpreis
      preis = typeof a.sale_price === 'number' ? a.sale_price / 100 : null
      if (preis == null || (preis === 0 && p.preis == null)) { fehlend.push(`${a.description.replace(/\s+/g, ' ')}: kein Preis in Preisstufe ${preisstufe.replace('SALEPRICE', '') || '1'}`); }
    }
    return {
      type: 'POSITION',
      position: i + 1,
      position_id: a.id,
      number: a.number,
      description: a.description,
      quantity: p.menge || 0,
      unit: p.einheit || a.unit || 'Stück',
      single_price_net: Math.round((preis || 0) * 100),
      vat_percent: vatProzent,
    }
  })
  return { items: items.filter(Boolean), fehlend, artikel }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  try {
    const url = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return antwort({ fehler: 'Nicht angemeldet.' }, 401)
    const admin = createClient(url, serviceKey)
    const authUserId = await nutzerAusToken(admin, authHeader.replace(/^Bearer\s+/i, ''))
    if (!authUserId) return antwort({ fehler: 'Nicht angemeldet.' }, 401)
    const { data: aufrufer } = await admin.from('employees').select('id, role, aktiv').eq('auth_user_id', authUserId).maybeSingle()
    if (!aufrufer || !aufrufer.aktiv || !BUERO.includes(aufrufer.role)) return antwort({ fehler: 'Dafür fehlt dir die Berechtigung.' }, 403)

    const body = await req.json()
    const aktion = body.aktion as string

    // --- Auftrag und Kunde in easybill nachsehen, Preise fuer den Plan holen ---
    if (aktion === 'vorbereiten') {
      const plan = body.plan as Plan
      const auftrag = await auftragSuchen(plan.auftrag_id)
      if (!auftrag) return antwort({ fehler: `In easybill gibt es keinen Serviceauftrag mit der Nummer ${plan.auftrag_id}.` }, 404)
      const kunde = await eb(`/customers/${auftrag.customer_id}`)
      const preisstufe: string = kunde.sale_price_level || 'SALEPRICE'
      // Steuer: Reverse Charge o. ae. kommt vom Kundenstamm (Umsatzsteuer-Option), sonst 19 %
      const vatProzent = kunde.tax_options && kunde.tax_options !== 'NULL' ? 0 : 19
      const { items, fehlend } = await itemsAusPlan(plan, preisstufe, vatProzent)
      const { data: vorhandene } = await admin.from('easybill_rechnungen').select('*').eq('auftrag_id', plan.auftrag_id).order('erstellt_am', { ascending: false })
      return antwort({
        easybill_auftrag_id: auftrag.id,
        kunde: { id: kunde.id, name: kunde.company_name || kunde.display_name, preisstufe, vat_prozent: vatProzent, tax_options: kunde.tax_options || null },
        items,
        fehlend,
        vorhandene: vorhandene || [],
      })
    }

    // --- Auftrag in Rechnungsentwurf umwandeln, fuellen, PDFs anhaengen ---
    if (aktion === 'anlegen') {
      const plan = body.plan as Plan
      const auftrag = await auftragSuchen(plan.auftrag_id)
      if (!auftrag) return antwort({ fehler: `In easybill gibt es keinen Serviceauftrag mit der Nummer ${plan.auftrag_id}.` }, 404)
      const kunde = await eb(`/customers/${auftrag.customer_id}`)
      const preisstufe: string = kunde.sale_price_level || 'SALEPRICE'
      const vatProzent = kunde.tax_options && kunde.tax_options !== 'NULL' ? 0 : 19
      const { items, fehlend } = await itemsAusPlan(plan, preisstufe, vatProzent)
      if (fehlend.length && !body.trotzdem) return antwort({ fehler: 'Es fehlen Preise: ' + fehlend.join('; ') }, 400)

      // 1. Umwandeln: ergibt einen neuen Rechnungsentwurf mit ref_id = Auftrag
      const entwurf = await eb(`/documents/${auftrag.id}/INVOICE?pdf_template=${VORLAGE_RECHNUNG}`, { method: 'POST' })

      // 2. Kopf, Texte, Leistungszeitraum, Positionen setzen
      await eb(`/documents/${entwurf.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          title: plan.titel,
          text_prefix: plan.text_prefix,
          text: plan.text,
          pdf_template: VORLAGE_RECHNUNG,
          due_in_days: ZAHLUNGSZIEL_TAGE,
          service_date: plan.leistung_von === plan.leistung_bis
            ? { type: 'SERVICE', date: plan.leistung_von }
            : { type: 'SERVICE', date_from: plan.leistung_von, date_to: plan.leistung_bis },
          items,
        }),
      })

      // 3. Bericht-PDFs anhaengen
      const anhaenge: string[] = []
      for (const pdf of plan.pdfs || []) {
        const bytes = Uint8Array.from(atob(pdf.base64), (c) => c.charCodeAt(0))
        const form = new FormData()
        form.append('file', new Blob([bytes], { type: 'application/pdf' }), pdf.name)
        const a = await eb('/attachments', { method: 'POST', body: form })
        await eb(`/attachments/${a.id}`, { method: 'PUT', body: JSON.stringify({ document_id: entwurf.id }) })
        anhaenge.push(pdf.name)
      }

      // 4. Merken, damit die App spaeter den Abschluss erkennt
      const fertig = await eb(`/documents/${entwurf.id}`)
      await admin.from('easybill_rechnungen').insert({
        auftrag_id: plan.auftrag_id,
        easybill_auftrag_id: auftrag.id,
        easybill_rechnung_id: entwurf.id,
        bericht_ids: plan.bericht_ids,
        erstellt_von: aufrufer.id,
        netto_cent: fertig.amount_net ?? null,
      })
      return antwort({ ok: true, rechnung_id: entwurf.id, netto: (fertig.amount_net || 0) / 100, brutto: (fertig.amount || 0) / 100, anhaenge, fehlend })
    }

    // --- Entwuerfe nachsehen: abgeschlossen? Dann Berichte auf abgerechnet setzen ---
    if (aktion === 'abgleichen') {
      let q = admin.from('easybill_rechnungen').select('*').is('rechnung_nummer', null).is('verworfen_am', null)
      if (body.auftrag_id) q = q.eq('auftrag_id', body.auftrag_id)
      const { data: offen } = await q
      const ergebnis: { auftrag_id: string; nummer: string | null; verworfen?: boolean }[] = []
      for (const r of offen || []) {
        let doc
        try { doc = await eb(`/documents/${r.easybill_rechnung_id}`) } catch (e) {
          if (e instanceof EasybillFehler && e.status === 404) {
            // Entwurf in easybill geloescht: Eintrag schliessen, Berichte bleiben offen
            await admin.from('easybill_rechnungen').update({ verworfen_am: new Date().toISOString() }).eq('id', r.id)
            ergebnis.push({ auftrag_id: r.auftrag_id, nummer: null, verworfen: true })
            continue
          }
          throw e
        }
        if (!doc.is_draft && doc.number) {
          const jetzt = new Date().toISOString()
          await admin.from('serviceberichte').update({ abgerechnet: true, abgerechnet_am: jetzt }).in('id', r.bericht_ids).eq('abgerechnet', false)
          await admin.from('easybill_rechnungen').update({ rechnung_nummer: doc.number, abgeschlossen_am: jetzt, netto_cent: doc.amount_net ?? null }).eq('id', r.id)
          ergebnis.push({ auftrag_id: r.auftrag_id, nummer: doc.number })
        }
      }
      return antwort({ ok: true, abgeschlossen: ergebnis })
    }

    // --- Artikel fuer Ersatzteile suchen (nach Nummer oder Bezeichnung) ---
    if (aktion === 'artikel_suchen') {
      const suche = String(body.suche || '').trim().toLowerCase()
      const woerter = suche.split(/\s+/).filter(Boolean)
      const alle = await alleArtikel()
      const treffer = alle
        .filter((a) => !a.archived)
        .filter((a) => woerter.length === 0 || woerter.every((w) => (a.description || '').toLowerCase().includes(w) || (a.number || '').toLowerCase().includes(w)))
        .slice(0, 30)
        .map((a) => ({ id: a.id, nummer: a.number, bezeichnung: a.description.replace(/\s+/g, ' '), einheit: a.unit, preis: typeof a.sale_price === 'number' ? a.sale_price / 100 : null }))
      return antwort({ treffer })
    }

    // --- Neuen Ersatzteil-Artikel anlegen (Nummer 24xxxxx, naechste freie) ---
    if (aktion === 'artikel_anlegen') {
      const bezeichnung = String(body.bezeichnung || '').trim()
      const preis = Number(body.preis)
      if (!bezeichnung || !(preis >= 0)) return antwort({ fehler: 'Bezeichnung und Preis angeben.' }, 400)
      const alle = await alleArtikel()
      const nummern = alle.map((a) => Number(a.number)).filter((n) => Number.isInteger(n) && n >= 2400000 && n <= 2499999)
      const naechste = String(Math.max(2400010, ...nummern) + 1)
      const neu = await eb('/positions', {
        method: 'POST',
        body: JSON.stringify({ number: naechste, description: bezeichnung, type: 'PRODUCT', unit: 'Stück', vat_percent: 19, sale_price: Math.round(preis * 100) }),
      })
      return antwort({ id: neu.id, nummer: neu.number, bezeichnung: neu.description, preis })
    }

    // --- Ersatzteil im Bericht mit einem easybill-Artikel verknuepfen ---
    // (laeuft hier, weil das Buero Ersatzteile sonst nicht aendern darf)
    if (aktion === 'ersatzteil_zuordnen') {
      const { ersatzteil_id, position_id } = body
      if (!ersatzteil_id || !position_id) return antwort({ fehler: 'Unvollständige Anfrage.' }, 400)
      const { error } = await admin.from('servicebericht_ersatzteile').update({ easybill_position_id: Number(position_id) }).eq('id', ersatzteil_id)
      if (error) return antwort({ fehler: error.message }, 400)
      return antwort({ ok: true })
    }

    // --- Ersatzteil mit Preis in easybill anlegen bzw. ueber die Artikelnummer verknuepfen ---
    // Laeuft nach dem Speichern (wenn online) oder spaetestens beim Rechnung-Anlegen.
    if (aktion === 'ersatzteil_easybill') {
      const { data: teil } = await admin.from('servicebericht_ersatzteile').select('*').eq('id', String(body.ersatzteil_id)).maybeSingle()
      if (!teil) return antwort({ fehler: 'Ersatzteil nicht gefunden.' }, 404)
      if (teil.easybill_position_id) return antwort({ ok: true, position_id: teil.easybill_position_id, angelegt: false })
      const nummer = String(teil.artikelnummer || '').trim()
      // Vorhandenen Artikel ueber die Nummer finden
      if (nummer) {
        const r = await eb(`/positions?number=${encodeURIComponent(nummer)}&limit=5`)
        const treffer = (r.items || []).find((a: EbPosition) => a.number === nummer && !a.archived)
        if (treffer) {
          await admin.from('servicebericht_ersatzteile').update({ easybill_position_id: treffer.id }).eq('id', teil.id)
          return antwort({ ok: true, position_id: treffer.id, nummer: treffer.number, angelegt: false })
        }
      }
      if (teil.verkaufspreis == null) return antwort({ ok: false, grund: 'kein Preis' })
      // Neu anlegen: naechste freie Nummer ab 2400011
      const alle = await alleArtikel()
      const nummern = alle.map((a) => Number(a.number)).filter((n) => Number.isInteger(n) && n >= 2400000 && n <= 2499999)
      const naechste = String(Math.max(2400010, ...nummern) + 1)
      const bezeichnung = `${teil.bezeichnung}${teil.id_nummer ? ' ' + teil.id_nummer : ''}`.trim()
      const neu = await eb('/positions', {
        method: 'POST',
        body: JSON.stringify({
          number: naechste, description: bezeichnung, type: 'PRODUCT', unit: 'Stück', vat_percent: 19,
          sale_price: Math.round(Number(teil.verkaufspreis) * 100),
          cost_price: teil.einkaufspreis != null ? Math.round(Number(teil.einkaufspreis) * 100) : null,
        }),
      })
      await admin.from('servicebericht_ersatzteile').update({ easybill_position_id: neu.id }).eq('id', teil.id)
      return antwort({ ok: true, position_id: neu.id, nummer: neu.number, angelegt: true })
    }

    // ---------- Kunden und Auftraege in easybill anlegen ----------

    type AppKunde = { id: string; name: string; strasse: string | null; plz: string | null; ort: string | null; rechnungs_email: string | null; easybill_id: number | null; kundennummer: string | null; preisstufe: string | null }
    const kundenFelder = (k: AppKunde) => {
      const plz = (k.plz || '').trim()
      const oesterreich = /^A-?\s*\d/i.test(plz)
      return {
        company_name: k.name,
        personal: false,
        street: k.strasse || '',
        zip_code: plz.replace(/^A-?\s*/i, ''),
        city: k.ort || '',
        country: oesterreich ? 'AT' : 'DE',
        sale_price_level: k.preisstufe && k.preisstufe !== 'SALEPRICE' ? k.preisstufe : null,
        emails: k.rechnungs_email ? [k.rechnungs_email] : [],
      }
    }
    /** Sorgt dafuer, dass der App-Kunde in easybill existiert; legt ihn sonst an. */
    async function kundeSicherstellen(customerId: string): Promise<{ easybill_id: number; kundennummer: string; angelegt: boolean }> {
      const { data: k } = await admin.from('customers').select('*').eq('id', customerId).maybeSingle()
      if (!k) throw new Error('Kunde in der App nicht gefunden.')
      const kunde = k as AppKunde
      if (kunde.easybill_id) return { easybill_id: kunde.easybill_id, kundennummer: kunde.kundennummer || '', angelegt: false }
      const neu = await eb('/customers', { method: 'POST', body: JSON.stringify(kundenFelder(kunde)) })
      await admin.from('customers').update({ easybill_id: neu.id, kundennummer: neu.number }).eq('id', customerId)
      return { easybill_id: neu.id, kundennummer: neu.number, angelegt: true }
    }

    // --- Kunde in easybill anlegen (nach dem Anlegen in der App) ---
    if (aktion === 'kunde_anlegen') {
      return antwort(await kundeSicherstellen(String(body.customer_id)))
    }

    // --- Kundendaten (Name, Adresse, Preisstufe, Rechnungs-E-Mail) nach easybill uebertragen ---
    if (aktion === 'kunde_aktualisieren') {
      const { data: k } = await admin.from('customers').select('*').eq('id', String(body.customer_id)).maybeSingle()
      if (!k) return antwort({ fehler: 'Kunde nicht gefunden.' }, 404)
      const kunde = k as AppKunde
      if (!kunde.easybill_id) return antwort(await kundeSicherstellen(kunde.id))
      await eb(`/customers/${kunde.easybill_id}`, { method: 'PUT', body: JSON.stringify(kundenFelder(kunde)) })
      return antwort({ ok: true, easybill_id: kunde.easybill_id, kundennummer: kunde.kundennummer })
    }

    // --- Bestehende App-Kunden ueber die easybill-Kundennummer verknuepfen ---
    if (aktion === 'kunden_verknuepfen') {
      const liste = (body.zuordnung || []) as { customer_id: string; kundennummer: string }[]
      const ergebnis: { customer_id: string; kundennummer: string; ok: boolean; name?: string; fehler?: string }[] = []
      for (const z of liste) {
        const r = await eb(`/customers?number=${encodeURIComponent(z.kundennummer)}&limit=5`)
        const treffer = (r.items || []).find((c: { number: string }) => c.number === z.kundennummer)
        if (!treffer) { ergebnis.push({ ...z, ok: false, fehler: 'Kundennummer nicht in easybill gefunden' }); continue }
        const { error } = await admin.from('customers').update({ easybill_id: treffer.id, kundennummer: treffer.number, preisstufe: treffer.sale_price_level || null }).eq('id', z.customer_id)
        ergebnis.push({ ...z, ok: !error, name: treffer.company_name || treffer.display_name, fehler: error?.message })
      }
      return antwort({ ergebnis })
    }

    // --- Serviceauftrag in easybill anlegen; easybill vergibt die Auftragsnummer ---
    if (aktion === 'auftrag_anlegen') {
      const auftraggeber = await kundeSicherstellen(String(body.auftraggeber_id))
      // Bestell-, Referenz- und Kundenauftragsnummer stehen fett im Kopf des easybill-Auftrags
      const zeilen = [
        body.bestellnummer ? `Ihre Bestellnummer: ${body.bestellnummer}` : '',
        body.kundenreferenznr ? `Kundenreferenznummer: ${body.kundenreferenznr}` : '',
        body.auftragsnr_kunde ? `Auftragsnummer Kunde: ${body.auftragsnr_kunde}` : '',
      ].filter(Boolean)
      const kopf = zeilen.length ? `<strong>${zeilen.join('<br>')}</strong>` : '<br>'
      const neu = await eb('/documents', { method: 'POST', body: JSON.stringify({ type: 'CHARGE', customer_id: auftraggeber.easybill_id, pdf_template: '90602', text_prefix: kopf, text: '<br>' }) })
      // Erst mit dem Abschliessen bekommt der Auftrag seine Nummer
      await eb(`/documents/${neu.id}/done`, { method: 'PUT' })
      const fertig = await eb(`/documents/${neu.id}`)
      if (!fertig.number) return antwort({ fehler: 'easybill hat keine Auftragsnummer vergeben.' }, 502)
      return antwort({ nummer: String(fertig.number), easybill_id: neu.id, kunde_angelegt: auftraggeber.angelegt })
    }

    // --- Serviceauftrag in easybill stornieren (Status CANCEL; bleibt dort sichtbar) ---
    if (aktion === 'auftrag_stornieren') {
      const auftrag = await auftragSuchen(String(body.auftrag_id))
      if (!auftrag) return antwort({ fehler: `In easybill gibt es keinen Serviceauftrag mit der Nummer ${body.auftrag_id}.` }, 404)
      // Nur solange noch kein Servicebericht angelegt ist (Manuels Regel vom 09.10.2026)
      const { data: berichte } = await admin.from('serviceberichte').select('bericht_nummer').eq('auftrag_id', String(body.auftrag_id))
      if (berichte && berichte.length) return antwort({ fehler: `Nicht möglich: zu diesem Auftrag gibt es schon ${berichte.map((b: { bericht_nummer: string }) => b.bericht_nummer).join(', ')}.` }, 400)
      if (auftrag.status !== 'CANCEL') {
        await eb(`/documents/${auftrag.id}`, { method: 'PUT', body: JSON.stringify({ status: 'CANCEL' }) })
        const danach = await eb(`/documents/${auftrag.id}`)
        if (danach.status !== 'CANCEL') return antwort({ fehler: 'easybill hat den Auftrag nicht auf storniert gesetzt.' }, 502)
      }
      // In der App: storniert_am setzen, der Status-Trigger macht daraus „storniert“
      const { error } = await admin.from('orders').update({ storniert_am: new Date().toISOString() }).eq('id', String(body.auftrag_id))
      if (error) return antwort({ fehler: 'In easybill storniert, aber in der App nicht: ' + error.message }, 500)
      return antwort({ ok: true })
    }

    return antwort({ fehler: 'Unbekannte Aktion.' }, 400)
  } catch (e) {
    const status = e instanceof EasybillFehler ? (e.status >= 500 ? 502 : 400) : 500
    return antwort({ fehler: e instanceof Error ? e.message : 'Unbekannter Fehler.' }, status)
  }
})
