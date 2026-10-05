import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'
import { offlineFetch, setzeTokenQuelle } from './offline'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  throw new Error('Supabase-Umgebungsvariablen fehlen (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY).')
}

// Alle Datenbank- und Upload-Anfragen laufen über die Offline-Schicht (siehe offline.ts).
export const supabase = createClient<Database>(url, anonKey, { global: { fetch: offlineFetch } })

// Zum Hochladen der Warteschlange braucht die Offline-Schicht ein frisches Zugangs-Token.
setzeTokenQuelle(async () => (await supabase.auth.getSession()).data.session?.access_token ?? null)
