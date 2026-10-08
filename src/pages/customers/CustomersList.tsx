import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import type { Customer, Machine } from '../../lib/types'
import { CustomerFormModal } from './CustomerFormModal'
import { Icon } from '../../components/ui/Icon'
import { Suchfeld, passtZurSuche } from '../../components/ui/Suchfeld'
import { useAuth } from '../../lib/AuthContext'

type SortMode = 'name' | 'ort'

const SORT_OPTIONS: { key: SortMode; label: string }[] = [
  { key: 'name', label: 'Name (A–Z)' },
  { key: 'ort', label: 'Ort (A–Z)' },
]

const SORT_SPEICHER_KEY = 'lsd-kunden-sortierung'

export function CustomersList() {
  const navigate = useNavigate()
  const { employee } = useAuth()
  const [customers, setCustomers] = useState<Customer[] | null>(null)
  const [machines, setMachines] = useState<Machine[]>([])
  const [showNew, setShowNew] = useState(false)
  const [suche, setSuche] = useState('')
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

  const gefiltert = (sortierteCustomers || []).filter((c) => {
    const ihreMaschinen = machines.filter((m) => m.kunde_id === c.id)
    return passtZurSuche(suche, c.name, c.ort, c.plz, c.strasse, ...ihreMaschinen.flatMap((m) => [m.bezeichnung, m.nummer]))
  })

  return (
    <div>
      <div className="flex items-end justify-between gap-4 flex-wrap mb-4">
        <div>
          <p className="eyebrow">Firmenstamm</p>
          <h1>Kunden</h1>
        </div>
        {employee?.role !== 'Techniker' && (
          <button className="btn btn-amber max-sm:w-full" onClick={() => setShowNew(true)}><Icon name="hinzufuegen" size={20} /> Neuer Kunde</button>
        )}
      </div>

      <div className="flex flex-col sm:flex-row gap-2 mb-3">
        <div className="flex-1"><Suchfeld wert={suche} onChange={setSuche} platzhalter="Firma, Ort oder Maschine" /></div>
        <select className="sm:max-w-[220px]" value={sortMode} onChange={(e) => setSortMode(e.target.value as SortMode)} aria-label="Sortierung">
          {SORT_OPTIONS.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
        </select>
      </div>

      {sortierteCustomers === null ? (
        <div className="text-sm text-ink-soft">Lädt…</div>
      ) : gefiltert.length === 0 ? (
        <div className="text-sm text-ink-soft border border-dashed border-line p-6 text-center">Kein Kunde gefunden.</div>
      ) : (
        <div className="flex flex-col gap-2">
          {gefiltert.map((c) => {
            const ihreMaschinen = machines.filter((m) => m.kunde_id === c.id)
            return (
              <div key={c.id} onClick={() => navigate(`/kunden/${c.id}`)} className="card p-4 cursor-pointer hover:border-ink transition-colors">
                <div className="font-semibold text-[17px] leading-snug">{c.name}</div>
                <div className="flex items-center gap-1.5 text-[14px] text-ink-soft mt-1"><Icon name="standort" size={16} /> {c.strasse}, {c.plz} {c.ort}</div>
                <div className="font-mono text-[12.5px] text-ink-soft mt-1.5">
                  {ihreMaschinen.length ? ihreMaschinen.map((m) => m.bezeichnung).join(' · ') : 'keine Maschinen hinterlegt'}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {showNew && <CustomerFormModal onClose={() => setShowNew(false)} onSaved={(id) => { setShowNew(false); navigate(`/kunden/${id}`) }} />}
    </div>
  )
}
