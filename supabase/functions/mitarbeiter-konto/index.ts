// Setzt das Login-Passwort eines Mitarbeiters, bzw. legt beim ersten Mal das
// Login-Konto an.
//
// Das muss serverseitig laufen: fremde Passwoerter darf nur der Service-Role-
// Schluessel setzen, und der darf niemals in die App gebundelt werden. Hier ist
// er als Umgebungsvariable verfuegbar und verlaesst den Server nicht.
//
// Aufrufen darf das nur, wer selbst als Administrator oder CEO eingetragen ist.

import { createClient } from 'jsr:@supabase/supabase-js@2'
import { createRemoteJWKSet, jwtVerify } from 'npm:jose@5'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const MIN_LAENGE = 8

function antwort(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

// Oeffentliche Signaturschluessel des Projekts, von jose zwischengespeichert.
const jwks = createRemoteJWKSet(
  new URL(`${Deno.env.get('SUPABASE_URL')}/auth/v1/.well-known/jwks.json`),
)

/**
 * Liefert die Auth-User-ID zum mitgeschickten Token — oder null.
 *
 * Zuerst ueber die Auth-API, das ist die strengste Pruefung. Die schlaegt aber
 * fehl, sobald die Sitzung serverseitig nicht mehr existiert, obwohl das Token
 * selbst noch gueltig und unverfaelscht ist. Fuer diesen Fall wird die Signatur
 * direkt gegen die oeffentlichen Schluessel des Projekts geprueft.
 */
async function nutzerAusToken(
  admin: ReturnType<typeof createClient>,
  token: string,
): Promise<string | null> {
  const { data, error } = await admin.auth.getUser(token)
  if (!error && data?.user) return data.user.id

  try {
    const { payload } = await jwtVerify(token, jwks)
    return typeof payload.sub === 'string' ? payload.sub : null
  } catch {
    return null
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const url = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return antwort({ fehler: 'Nicht angemeldet.' }, 401)

    const admin = createClient(url, serviceKey)

    // Wer ruft an? Das Token ausdruecklich uebergeben — ein Client ohne eigene
    // Sitzung wertet einen mitgeschickten Authorization-Header nicht aus.
    const token = authHeader.replace(/^Bearer\s+/i, '')
    const authUserId = await nutzerAusToken(admin, token)
    if (!authUserId) return antwort({ fehler: 'Nicht angemeldet.' }, 401)

    const { data: aufrufer } = await admin
      .from('employees')
      .select('id, role, aktiv')
      .eq('auth_user_id', authUserId)
      .maybeSingle()

    if (!aufrufer || !aufrufer.aktiv || !['Administrator', 'CEO'].includes(aufrufer.role)) {
      return antwort({ fehler: 'Dafür fehlt dir die Berechtigung.' }, 403)
    }

    const { employee_id, passwort } = await req.json()
    if (!employee_id || typeof passwort !== 'string') {
      return antwort({ fehler: 'Unvollständige Anfrage.' }, 400)
    }
    if (passwort.length < MIN_LAENGE) {
      return antwort({ fehler: `Das Passwort muss mindestens ${MIN_LAENGE} Zeichen haben.` }, 400)
    }

    const { data: ziel } = await admin
      .from('employees')
      .select('id, name, email, auth_user_id')
      .eq('id', employee_id)
      .maybeSingle()

    if (!ziel) return antwort({ fehler: 'Mitarbeiter nicht gefunden.' }, 404)

    // Konto existiert schon: nur das Passwort tauschen.
    if (ziel.auth_user_id) {
      const { error } = await admin.auth.admin.updateUserById(ziel.auth_user_id, {
        password: passwort,
      })
      if (error) return antwort({ fehler: error.message }, 400)
      return antwort({ ok: true, angelegt: false })
    }

    // Noch kein Login vorhanden: Konto anlegen und mit dem Mitarbeiter verknüpfen.
    const { data: neu, error: anlegenFehler } = await admin.auth.admin.createUser({
      email: ziel.email,
      password: passwort,
      email_confirm: true,
    })
    if (anlegenFehler || !neu?.user) {
      return antwort({ fehler: anlegenFehler?.message || 'Konto konnte nicht angelegt werden.' }, 400)
    }

    const { error: verknuepfFehler } = await admin
      .from('employees')
      .update({ auth_user_id: neu.user.id })
      .eq('id', ziel.id)

    if (verknuepfFehler) {
      // Verwaistes Konto wieder entfernen, sonst blockiert die E-Mail-Adresse
      // jeden weiteren Versuch.
      await admin.auth.admin.deleteUser(neu.user.id)
      return antwort({ fehler: verknuepfFehler.message }, 400)
    }

    return antwort({ ok: true, angelegt: true })
  } catch (e) {
    return antwort({ fehler: e instanceof Error ? e.message : 'Unbekannter Fehler.' }, 500)
  }
})
