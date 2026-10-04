import { AKTUELLES_DESIGN, wechsleZu, type Design } from '../../lib/designwahl'

/** Umschalter zwischen bisheriger App und neuem Design (Testphase). */
export function DesignSchalter({ dunkel = false }: { dunkel?: boolean }) {
  const optionen: [Design, string][] = [['alt', 'Bisher'], ['neu', 'Neu (Test)']]
  return (
    <div>
      <div className={`text-[11px] uppercase tracking-wide mb-1.5 ${dunkel ? 'text-white/60' : 'text-ink-soft'}`}>Design</div>
      <div className={`grid grid-cols-2 gap-0.5 p-0.5 ${dunkel ? 'bg-white/15' : 'bg-line'}`}>
        {optionen.map(([design, label]) => {
          const aktiv = design === AKTUELLES_DESIGN
          return (
            <button
              key={design}
              type="button"
              onClick={() => { if (!aktiv) wechsleZu(design) }}
              aria-pressed={aktiv}
              className={`min-h-[40px] text-[13px] font-semibold border-0 cursor-pointer ${
                aktiv ? 'bg-graphite text-white' : dunkel ? 'bg-transparent text-white/80' : 'bg-white text-ink'
              }`}
            >
              {label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
