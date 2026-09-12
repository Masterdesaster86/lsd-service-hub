import { useState } from 'react'
import { supabase } from '../../lib/supabase'

type Treffer = {
  dateiname: string
  maschinenmodell: string
  ordnerpfad: string
  ausschnitt: string
  aehnlichkeit: number
  webseitenUrl: string | null
}

/** Ruft die Serverfunktion auf, die die Frage bei Voyage in einen Vektor
 * umwandelt und die ähnlichsten Textstellen aus der Wissens-Datenbank holt.
 * Muss serverseitig laufen — der Voyage-Key darf nie in den Browser. */
async function suchen(frage: string) {
  const { data, error } = await supabase.functions.invoke('wissen-suche', {
    body: { frage },
  })
  if (error) {
    let text = error.message
    try {
      const body = await (error as { context?: Response }).context?.json()
      if (body?.fehler) text = body.fehler
    } catch { /* Body war kein JSON — dann bleibt error.message */ }
    throw new Error(text)
  }
  return (data?.ergebnisse || []) as Treffer[]
}

export function WissensSuche() {
  const [frage, setFrage] = useState('')
  const [ladend, setLadend] = useState(false)
  const [ergebnisse, setErgebnisse] = useState<Treffer[] | null>(null)
  const [fehler, setFehler] = useState<string | null>(null)

  async function absenden(e: React.FormEvent) {
    e.preventDefault()
    if (!frage.trim() || ladend) return
    setLadend(true)
    setFehler(null)
    try {
      setErgebnisse(await suchen(frage.trim()))
    } catch (err) {
      setFehler(err instanceof Error ? err.message : 'Unbekannter Fehler.')
      setErgebnisse(null)
    } finally {
      setLadend(false)
    }
  }

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-xl font-semibold m-0">Wissens-Suche</h1>
        <p className="text-sm text-ink-soft mt-1">
          Pilot über die DMU/DMC-Baureihe — durchsucht Servicedokumentation aus SharePoint.
        </p>
      </div>

      <form onSubmit={absenden} className="flex gap-2 mb-5 flex-wrap">
        <input
          type="text"
          value={frage}
          onChange={(e) => setFrage(e.target.value)}
          placeholder="z.B. Wie tausche ich die Spindel bei der DMU 60P?"
          className="flex-1 min-w-[240px]"
        />
        <button type="submit" className="btn btn-amber" disabled={ladend || !frage.trim()}>
          {ladend ? 'Suche…' : 'Suchen'}
        </button>
      </form>

      {fehler && <div className="text-sm text-red-700 border border-red-300 bg-red-50 p-3 mb-4">{fehler}</div>}

      {ergebnisse === null && !fehler && !ladend && (
        <div className="text-sm text-ink-soft border border-dashed border-line p-6 text-center">
          Stell eine Frage, um in der Servicedokumentation zu suchen.
        </div>
      )}

      {ergebnisse !== null && ergebnisse.length === 0 && (
        <div className="text-sm text-ink-soft border border-dashed border-line p-6 text-center">
          Keine passenden Textstellen gefunden.
        </div>
      )}

      {ergebnisse !== null && ergebnisse.length > 0 && (
        <div className="flex flex-col gap-3">
          {ergebnisse.map((t, i) => (
            <div key={i} className="card p-4">
              <div className="flex items-start justify-between gap-3 flex-wrap mb-1.5">
                <div>
                  {t.webseitenUrl ? (
                    <a
                      href={t.webseitenUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="font-semibold text-steel no-underline hover:underline"
                    >
                      {t.dateiname}
                    </a>
                  ) : (
                    <div className="font-semibold">{t.dateiname}</div>
                  )}
                  <div className="text-[12px] text-ink-soft">
                    {t.maschinenmodell}{t.ordnerpfad ? ` · ${t.ordnerpfad}` : ''}
                  </div>
                </div>
                <span className="text-[11px] bg-paper-2 border border-line px-2 py-0.5 shrink-0">
                  {Math.round(t.aehnlichkeit * 100)}% Treffer
                </span>
              </div>
              <p className="text-[13px] text-ink whitespace-pre-wrap m-0">{t.ausschnitt}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
