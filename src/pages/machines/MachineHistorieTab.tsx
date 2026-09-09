import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

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

export function MachineHistorieTab({ maschineId }: { maschineId: string }) {
  const [rows, setRows] = useState<HistRow[] | null>(null)

  useEffect(() => {
    supabase
      .from('serviceberichte')
      .select('id, bericht_nummer, auftrag_id, status, ist_nachtrag, abgeschlossen_am, durchgefuehrte_arbeiten, fehlerbeschreibung, techniker:employees(name)')
      .eq('maschine_id', maschineId)
      .order('bericht_nummer', { ascending: false })
      .then(({ data }) => setRows((data as unknown as HistRow[]) || []))
  }, [maschineId])

  if (rows === null) return <div className="text-sm text-ink-soft">Lädt…</div>
  if (rows.length === 0) return <div className="text-sm text-ink-soft border border-dashed border-line p-4 text-center">Noch keine Serviceberichte für diese Maschine.</div>

  return (
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
  )
}
