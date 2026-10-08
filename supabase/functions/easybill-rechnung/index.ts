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

    return antwort({ fehler: 'Unbekannte Aktion.' }, 400)
  } catch (e) {
    const status = e instanceof EasybillFehler ? (e.status >= 500 ? 502 : 400) : 500
    return antwort({ fehler: e instanceof Error ? e.message : 'Unbekannter Fehler.' }, status)
  }
})
