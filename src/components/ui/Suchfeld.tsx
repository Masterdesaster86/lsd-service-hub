import { Icon } from './Icon'

/** Suchfeld für Listen: Lupe links, Löschen-Kreuz rechts sobald etwas drinsteht. */
export function Suchfeld({ wert, onChange, platzhalter }: { wert: string; onChange: (v: string) => void; platzhalter: string }) {
  return (
    <div className="flex items-center bg-white border-[1.5px] border-ink-soft focus-within:border-ink focus-within:outline-2 focus-within:outline-blueprint focus-within:outline-offset-1">
      <span className="pl-3 text-ink-soft"><Icon name="suche" size={20} /></span>
      <input
        type="search"
        value={wert}
        onChange={(e) => onChange(e.target.value)}
        placeholder={platzhalter}
        className="!border-0 !outline-none flex-1 min-w-0"
        aria-label={platzhalter}
      />
      {wert && (
        <button type="button" aria-label="Suche leeren" onClick={() => onChange('')} className="w-11 h-11 grid place-items-center border-0 bg-transparent text-ink-soft cursor-pointer">
          <Icon name="schliessen" size={18} />
        </button>
      )}
    </div>
  )
}

/** Trifft die Suche auf einen der Texte zu? Groß-/Kleinschreibung egal, mehrere Wörter = alle müssen vorkommen. */
export function passtZurSuche(suche: string, ...texte: (string | null | undefined)[]): boolean {
  const woerter = suche.toLowerCase().split(/\s+/).filter(Boolean)
  if (woerter.length === 0) return true
  const heuhaufen = texte.filter(Boolean).join(' ').toLowerCase()
  return woerter.every((w) => heuhaufen.includes(w))
}
