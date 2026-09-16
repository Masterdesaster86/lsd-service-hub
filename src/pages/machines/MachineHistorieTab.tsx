import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { MESSPROTOKOLL_TYPEN } from '../../lib/messprotokoll'

interface HistRow {
  id: string
  bericht_nummer: string
  auftrag_id: string
  status: string
  ist_nachtrag: boolean
  abgeschlossen_am: string | null
  durchgefuehrte_arbeiten: string | null
  fehlerbeschreibung: string | null
  techniker: { name: string } | null
}

interface MessprotokollRow {
  id: string
  auftrag_id: string
  typ: string
  status: string
  erstellt_am: string
  abgeschlossen_am: string | null
  techniker: { name: string } | null
}

export function MachineHistorieTab({ maschineId }: { maschineId: string }) {
  const navigate = useNavigate()
  const [rows, setRows] = useState<HistRow[] | null>(null)
  const [protokolle, setProtokolle] = useState<MessprotokollRow[] | null>(null)

  useEffect(() => {
    supabase
      .from('serviceberichte')
      .select('id, bericht_nummer, auftrag_id, status, ist_nachtrag, abgeschlossen_am, durchgefuehrte_arbeiten, fehlerbeschreibung, techniker:employees(name)')
      .eq('maschine_id', maschineId)
      .order('bericht_nummer', { ascending: false })
      .then(({ data }) => setRows((data as unknown as HistRow[]) || []))
    supabase
      .from('messprotokolle')
      .select('id, auftrag_id, typ, status, erstellt_am, abgeschlossen_am, techniker:employees(name)')
      .eq('maschine_id', maschineId)
      .order('erstellt_am', { ascending: false })
      .then(({ data }) => setProtokolle((data as unknown as MessprotokollRow[]) || []))
  }, [maschineId])

  if (rows === null || protokolle === null) return <div className="text-sm text-ink-soft">Lädt…</div>

  return (
    <div>
      {protokolle.length > 0 && (
        <div className="mb-4">
          <div className="font-semibold text-sm uppercase tracking-wide text-ink-soft mb-1.5">Messprotokolle</div>
          <div className="flex flex-col gap-1.5">
            {protokolle.map((p) => (
              <div key={p.id} onClick={() => navigate(`/messprotokolle/${p.id}`)} className="card p-3 flex items-center justify-between gap-3 flex-wrap cursor-pointer hover:border-amber transition-colors">
                <div>
                  <div className="font-semibold text-sm">Messprotokoll · #{p.auftrag_id} — {MESSPROTOKOLL_TYPEN[p.typ as keyof typeof MESSPROTOKOLL_TYPEN]?.label || p.typ}</div>
                  <div className="text-[13px] text-ink-soft">{new Date(p.abgeschlossen_am || p.erstellt_am).toLocaleDateString('de-DE')} · {p.techniker?.name || '–'}</div>
                </div>
                <span className={`tag ${p.status === 'abgeschlossen' ? 'tag-abgeschlossen' : 'tag-offen'}`}>{p.status === 'abgeschlossen' ? 'Abgeschlossen' : 'Offen'}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="font-semibold text-sm uppercase tracking-wide text-ink-soft mb-1.5">Serviceberichte</div>
      {rows.length === 0 ? (
        <div className="text-sm text-ink-soft border border-dashed border-line p-4 text-center">Noch keine Serviceberichte für diese Maschine.</div>
      ) : (
        <div className="flex flex-col gap-1.5">
          {rows.map((h) => (
            <div key={h.id} className="card p-3 flex items-center justify-between gap-3 flex-wrap">
              <div>
                <div className="font-semibold text-sm">{h.bericht_nummer} · #{h.auftrag_id} — {h.durchgefuehrte_arbeiten || h.fehlerbeschreibung || 'Servicebericht'}</div>
                <div className="text-[13px] text-ink-soft">{h.abgeschlossen_am ? new Date(h.abgeschlossen_am).toLocaleDateString('de-DE') : 'offen'} · {h.techniker?.name || '–'}</div>
              </div>
              <span className="tag tag-arbeit">{h.ist_nachtrag ? 'Nachtrag' : h.status === 'abgeschlossen' ? 'Servicebericht' : 'Offen'}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
