// Übergangsweise laufen zwei Fassungen der App nebeneinander: die bisherige
// unter "/" und das neue Design unter "/neu/". Beide nutzen dieselbe
// Anmeldung und dieselben Daten. Die Wahl merkt sich das Gerät, damit auch das
// Symbol auf dem Home-Bildschirm in der gewählten Fassung startet.

const SCHLUESSEL = 'lsd-design'

export type Design = 'alt' | 'neu'

/** Welche Fassung gerade läuft — ergibt sich aus dem Pfad, unter dem sie gebaut wurde. */
export const AKTUELLES_DESIGN: Design = import.meta.env.BASE_URL.startsWith('/neu') ? 'neu' : 'alt'

function gespeicherteWahl(): Design | null {
  try {
    const v = localStorage.getItem(SCHLUESSEL)
    return v === 'neu' || v === 'alt' ? v : null
  } catch {
    return null
  }
}

/** Zur anderen Fassung wechseln, dieselbe Seite bleibt geöffnet. */
export function wechsleZu(design: Design, merken = true) {
  if (merken) {
    try { localStorage.setItem(SCHLUESSEL, design) } catch { /* ohne Speicher eben ohne Merken */ }
  }
  const pfad = location.pathname.replace(/^\/neu(?=\/|$)/, '') || '/'
  const ziel = design === 'neu' ? `/neu${pfad}` : pfad
  location.replace(ziel + location.search)
}

/**
 * Beim Start: Läuft gerade nicht die gewählte Fassung, dorthin umleiten.
 * Gibt true zurück, wenn umgeleitet wird (dann nichts mehr rendern).
 * Im Entwicklungsserver gibt es nur eine Fassung — dort nie umleiten.
 */
export function zurGewaehltenFassung(): boolean {
  if (import.meta.env.DEV) return false
  const wahl = gespeicherteWahl()
  if (!wahl || wahl === AKTUELLES_DESIGN) return false
  wechsleZu(wahl, false)
  return true
}
