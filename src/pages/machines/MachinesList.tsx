import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import type { Customer, Machine } from '../../lib/types'

type SortMode = 'bezeichnung' | 'kunde'

const SORT_OPTIONS: { key: SortMode; label: string }[] = [
  { key: 'bezeichnung', label: 'Bezeichnung (A–Z)' },
  { key: 'kunde', label: 'Kunde (A–Z)' },
]

const SORT_SPEICHER_KEY = 'lsd-maschinen-sortierung'

export function MachinesList() {
  const navigate = useNavigate()
  const [machines, setMachines] = useState<Machine[] | null>(null)
  const [customers, setCustomers] = useState<Record<string, Customer>>({})
  const [sortMode, setSortMode] = useState<SortMode>(() => {
    const gespeichert = localStorage.getItem(SORT_SPEICHER_KEY)
    return SORT_OPTIONS.some((o) => o.key === gespeichert) ? (gespeichert as SortMode) : 'bezeichnung'
  })
  useEffect(() => { localStorage.setItem(SORT_SPEICHER_KEY, sortMode) }, [sortMode])

  useEffect(() => {
    Promise.all([
      supabase.from('machines').select('*'),
      supabase.from('customers').select('*'),
    ]).then(([{ data: m }, { data: c }]) => {
      setMachines(m || [])
      setCustomers(Object.fromEntries((c || []).map((x) => [x.id, x])))
    })
  }, [])

  const sortierteMachines = useMemo(() => {
    if (!machines) return null
    const liste = [...machines]
    if (sortMode === 'kunde') {
      liste.sort((a, b) => {
        const kundeA = customers[a.kunde_id]?.name || ''
        const kundeB = customers[b.kunde_id]?.name || ''
        return kundeA.localeCompare(kundeB) || a.bezeichnung.localeCompare(b.bezeichnung)
      })
    } else {
      liste.sort((a, b) => a.bezeichnung.localeCompare(b.bezeichnung))
    }
    return liste
  }, [machines, customers, sortMode])

  return (
    <div>
      <div className="flex items-end justify-between gap-3 flex-wrap mb-4">
        <div>
          <h1 className="text-xl font-semibold m-0">Maschinen</h1>
          <p className="text-sm text-ink-soft mt-1">Maschinenstamm aller Kunden</p>
        </div>
        <div className="max-w-[220px]">
          <select value={sortMode} onChange={(e) => setSortMode(e.target.value as SortMode)}>
            {SORT_OPTIONS.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
          </select>
        </div>
      </div>

      {sortierteMachines === null ? (
        <div className="text-sm text-ink-soft">Lädt…</div>
      ) : (
        <div className="flex flex-col gap-2">
          {sortierteMachines.map((m) => (
            <div key={m.id} onClick={() => navigate(`/maschinen/${m.id}`)} className="card p-4 cursor-pointer hover:border-amber transition-colors flex items-center gap-4 flex-wrap">
              <div className="font-semibold min-w-[160px]">{m.bezeichnung}</div>
              <div className="text-[13px] text-ink-soft">{m.hersteller} · Nr. {m.nummer}</div>
              <div className="text-[13px] text-ink-soft">Kunde: {customers[m.kunde_id]?.name || '–'}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
