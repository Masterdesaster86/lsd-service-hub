import { useNavigate } from 'react-router-dom'
import type { Wartungsprotokoll } from '../../lib/types'
import { formatDateDE } from '../../lib/format'

/** Liste der Wartungsprotokolle (im Servicebericht und im Auftrag). Antippen öffnet sie. */
export function WartungsprotokollListe({ protokolle, maschinen }: { protokolle: Wartungsprotokoll[]; maschinen?: Record<string, string> }) {
  const navigate = useNavigate()
  if (protokolle.length === 0) return null
  return (
    <div className="flex flex-col gap-1.5 mb-4">
      {protokolle.map((p) => {
        const abgeschlossen = p.status === 'abgeschlossen'
        return (
          <button
            key={p.id}
            onClick={() => navigate(`/wartungsprotokolle/${p.id}`)}
            className="card p-3 text-left flex items-center justify-between gap-3 flex-wrap cursor-pointer hover:border-amber"
          >
            <div>
              <div className="font-semibold">Wartungsprotokoll</div>
              <div className="text-[13px] text-ink-soft">
                {maschinen?.[p.maschine_id] ? `${maschinen[p.maschine_id]} · ` : ''}
                {abgeschlossen && p.abgeschlossen_am ? `abgeschlossen am ${formatDateDE(p.abgeschlossen_am.slice(0, 10))}` : `angelegt am ${formatDateDE(p.erstellt_am.slice(0, 10))}`}
              </div>
            </div>
            <span className={`tag ${abgeschlossen ? 'tag-abgeschlossen' : 'tag-offen'}`}>{abgeschlossen ? 'Abgeschlossen' : 'Offen'}</span>
          </button>
        )
      })}
    </div>
  )
}
