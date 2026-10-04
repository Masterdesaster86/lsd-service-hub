const SCHRITT = 15 // Minuten

const zuText = (minuten: number) => {
  const m = ((minuten % 1440) + 1440) % 1440
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}

/** Uhrzeit im 15-Minuten-Raster: − / + verstellen um 15 Minuten, Antippen der
 * Uhrzeit öffnet die Zeitauswahl des Geräts (am Handy das Rad). */
export function TimeSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [h, m] = value ? value.split(':').map(Number) : [7, 0]
  const minuten = (h ?? 7) * 60 + (Number.isFinite(m) ? Math.round(m / SCHRITT) * SCHRITT : 0)

  function setzeText(text: string) {
    if (!text) return
    const [nh, nm] = text.split(':').map(Number)
    if (!Number.isFinite(nh) || !Number.isFinite(nm)) return
    onChange(zuText(nh * 60 + Math.round(nm / SCHRITT) * SCHRITT))
  }

  return (
    <div className="flex items-stretch border-[1.5px] border-ink-soft bg-white h-12">
      <button
        type="button"
        aria-label="15 Minuten früher"
        onClick={() => onChange(zuText(minuten - SCHRITT))}
        className="w-12 shrink-0 border-0 border-r border-line bg-white text-ink text-[22px] font-mono cursor-pointer active:bg-paper-2"
      >
        −
      </button>
      <input
        type="time"
        step={SCHRITT * 60}
        value={zuText(minuten)}
        onChange={(e) => setzeText(e.target.value)}
        className="!border-0 !min-h-0 !h-full !p-0 text-center font-mono !text-[19px] font-semibold bg-paper-2/40 flex-1 min-w-0"
      />
      <button
        type="button"
        aria-label="15 Minuten später"
        onClick={() => onChange(zuText(minuten + SCHRITT))}
        className="w-12 shrink-0 border-0 border-l border-line bg-white text-ink text-[22px] font-mono cursor-pointer active:bg-paper-2"
      >
        +
      </button>
    </div>
  )
}
