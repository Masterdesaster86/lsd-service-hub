import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import type { Customer, Machine } from '../../lib/types'
import { CustomerFormModal } from './CustomerFormModal'

type SortMode = 'name' | 'ort'

const SORT_OPTIONS: { key: SortMode; label: string }[] = [
  { key: 'name', label: 'Name (A–Z)' },
  { key: 'ort', label: 'Ort (A–Z)' },
]

const SORT_SPEICHER_KEY = 'lsd-kunden-sortierung'

export function CustomersList() {
  const navigate = useNavigate()
  const [customers, setCustomers] = useState<Customer[] | null>(null)
  const [machines, setMachines] = useState<Machine[]>([])
  const [showNew, setShowNew] = useState(false)
  const [sortMode, setSortMode] = useState<SortMode>(() => {
    const gespeichert = localStorage.getItem(SORT_SPEICHER_KEY)
    return SORT_OPTIONS.some((o) => o.key === gespeichert) ? (gespeichert as SortMode) : 'name'
  })
  useEffect(() => { localStorage.setItem(SORT_SPEICHER_KEY, sortMode) }, [sortMode])

  async function load() {
    const [{ data: c }, { data: m }] = await Promise.all([
      supabase.from('customers').select('*'),
      supabase.from('machines').select('*'),
    ])
    setCustomers(c || [])
    setMachines(m || [])
  }

  useEffect(() => { load() }, [])

  const sortierteCustomers = useMemo(() => {
    if (!customers) return null
    const liste = [...customers]
    if (sortMode === 'ort') {
      liste.sort((a, b) => (a.ort || '').localeCompare(b.ort || '') || a.name.localeCompare(b.name))
    } else {
      liste.sort((a, b) => a.name.localeCompare(b.name))
    }
    return liste
  }, [customers, sortMode])

  return (
    <div>
      <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
        <div>
          <h1 className="text-xl font-semibold m-0">Kunden</h1>
          <p className="text-sm text-ink-soft mt-1">Firmenstamm mit Ansprechpartnern und Maschinen</p>
        </div>
        <button className="btn btn-amber" onClick={() => setShowNew(true)}>+ Neuer Kunde</button>
      </div>

      <div className="flex justify-end mb-3">
        <div className="max-w-[220px]">
          <select value={sortMode} onChange={(e) => setSortMode(e.target.value as SortMode)}>
            {SORT_OPTIONS.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
          </select>
        </div>
      </div>

      {sortierteCustomers === null ? (
        <div className="text-sm text-ink-soft">Lädt…</div>
      ) : (
        <div className="flex flex-col gap-2">
          {sortierteCustomers.map((c) => (
            <div key={c.id} onClick={() => navigate(`/kunden/${c.id}`)} className="card p-4 cursor-pointer hover:border-amber transition-colors">
              <div className="font-semibold">{c.name}</div>
              <div className="text-[13px] text-ink-soft">{c.strasse}, {c.plz} {c.ort}</div>
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {machines.filter((m) => m.kunde_id === c.id).length
                  ? machines.filter((m) => m.kunde_id === c.id).map((m) => <span key={m.id} className="text-[11px] bg-paper-2 border border-line px-2 py-0.5">{m.bezeichnung}</span>)
                  : <span className="text-[13px] text-ink-soft">keine Maschinen hinterlegt</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      {showNew && <CustomerFormModal onClose={() => setShowNew(false)} onSaved={(id) => { setShowNew(false); navigate(`/kunden/${id}`) }} />}
    </div>
  )
}
