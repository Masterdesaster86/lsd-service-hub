// Verschickt Push-Nachrichten "Neuer Auftrag" an die Handys der Techniker.
//
// Aufruf 1 (ohne Anmeldung, vom Datenbank-Trigger per pg_net): arbeitet die Warteschlange
// push_meldungen ab. Der Aufruf selbst ist harmlos — er verschickt nur, was ohnehin wartet,
// und jede Meldung genau einmal. Deshalb ist die JWT-Prüfung für diese Funktion aus.
//
// Aufruf 2 { "test": true } mit Anmelde-Token: schickt eine Probe-Nachricht an die eigenen
// Geräte (Knopf "Probe senden" in der App).
//
// Der private VAPID-Schlüssel liegt im Vault und wird über push_vapid_privat() gelesen
// (nur mit Service-Role ausführbar).

import { createClient } from 'jsr:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

const VAPID_PUBLIC = 'BPmkLL8aMgccIZM5VPCoygGFFal_8lI6pUJUVNwKZW4tnzVnRIGOa0YFNKQJDJ7hzZxVXxuOaXxeyKq4yw6AN1E'
const VAPID_SUBJECT = 'https://www.lsd-maschinenservice.de'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function antwort(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })
}

interface Abo { id: string; endpoint: string; p256dh: string; auth: string }
interface Nachricht { title: string; body: string; url: string; tag: string }

const datumDE = (iso: string | null) => {
  if (!iso) return ''
  const [j, m, t] = iso.split('-')
  return `${t}.${m}.${j}`
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return antwort({ fehler: 'nur POST' }, 405)

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  })

  const { data: privat, error: vErr } = await admin.rpc('push_vapid_privat')
  if (vErr || !privat) return antwort({ fehler: 'Schlüssel fehlt' }, 500)
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, privat as string)

  /** Schickt an alle Geräte eines Mitarbeiters; ungültige Geräte werden entfernt. */
  async function anMitarbeiter(employeeId: string, n: Nachricht) {
    const { data: abos } = await admin.from('push_abos').select('id, endpoint, p256dh, auth').eq('employee_id', employeeId)
    let ok = 0
    const fehler: string[] = []
    for (const a of (abos || []) as Abo[]) {
      try {
        await webpush.sendNotification(
          { endpoint: a.endpoint, keys: { p256dh: a.p256dh, auth: a.auth } },
          JSON.stringify(n),
          { TTL: 60 * 60 * 24 * 3, urgency: 'high' },
        )
        ok++
        await admin.from('push_abos').update({ zuletzt_ok: new Date().toISOString() }).eq('id', a.id)
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode
        // 404/410: Gerät hat das Abo beendet (App gelöscht, Erlaubnis entzogen).
        if (status === 404 || status === 410) await admin.from('push_abos').delete().eq('id', a.id)
        fehler.push(`${status ?? ''} ${(e as Error).message}`.trim().slice(0, 200))
      }
    }
    return { geraete: (abos || []).length, ok, fehler }
  }

  let body: { test?: boolean } = {}
  try { body = await req.json() } catch { /* leer */ }

  // --- Probe an die eigenen Geräte ---
  if (body.test) {
    const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '')
    const { data: u } = await admin.auth.getUser(token)
    if (!u?.user) return antwort({ fehler: 'nicht angemeldet' }, 401)
    const { data: emp } = await admin.from('employees').select('id, aktiv').eq('auth_user_id', u.user.id).maybeSingle()
    if (!emp?.aktiv) return antwort({ fehler: 'kein aktiver Mitarbeiter' }, 403)
    const erg = await anMitarbeiter(emp.id, {
      title: 'LSD Service Hub',
      body: 'Probe: Push-Nachrichten sind auf diesem Gerät eingeschaltet.',
      url: '/auftraege',
      tag: 'lsd-probe',
    })
    return antwort(erg)
  }

  // --- Warteschlange abarbeiten ---
  const seit = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const { data: offen } = await admin.from('push_meldungen').select('id').is('gesendet_am', null).gte('created_at', seit).limit(50)
  const ergebnisse: unknown[] = []
  for (const { id } of offen || []) {
    // Meldung für sich beanspruchen, damit parallele Aufrufe nichts doppelt schicken.
    const { data: m } = await admin.from('push_meldungen')
      .update({ gesendet_am: new Date().toISOString() })
      .eq('id', id).is('gesendet_am', null)
      .select('id, order_id, techniker_id').maybeSingle()
    if (!m) continue

    const { data: o } = await admin.from('orders')
      .select('id, einsatzbeginn, meldetext, kunde:customers!orders_einsatzkunde_id_fkey(name, ort)')
      .eq('id', m.order_id).maybeSingle()
    const kunde = (o?.kunde as { name?: string; ort?: string } | null)
    const teile = [kunde?.name, kunde?.ort].filter(Boolean).join(', ')
    const wann = o?.einsatzbeginn ? `Einsatz ab ${datumDE(o.einsatzbeginn)}` : ''
    const n: Nachricht = {
      title: `Neuer Auftrag ${m.order_id}`,
      body: [teile, wann].filter(Boolean).join(' · ') || 'Ein neuer Auftrag ist dir zugewiesen.',
      url: `/auftraege/${encodeURIComponent(m.order_id)}`,
      tag: `auftrag-${m.order_id}`,
    }
    const erg = await anMitarbeiter(m.techniker_id, n)
    const text = erg.geraete === 0 ? 'kein Gerät angemeldet' : `${erg.ok}/${erg.geraete} zugestellt${erg.fehler.length ? ': ' + erg.fehler.join('; ') : ''}`
    await admin.from('push_meldungen').update({ ergebnis: text.slice(0, 500) }).eq('id', m.id)
    ergebnisse.push({ id: m.id, ergebnis: text })
  }
  return antwort({ verarbeitet: ergebnisse.length, ergebnisse })
})
