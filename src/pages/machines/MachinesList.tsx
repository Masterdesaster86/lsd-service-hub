import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import type { Customer, Machine } from '../../lib/types'
import { Suchfeld, passtZurSuche } from '../../components/ui/Suchfeld'

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
  const [suche, setSuche] = useState('')
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

  const gefiltert = (sortierteMachines || []).filter((m) =>
    passtZurSuche(suche, m.bezeichnung, m.nummer, m.kunden_maschinennummer, m.hersteller, m.steuerung, customers[m.kunde_id]?.name, customers[m.kunde_id]?.ort),
  )

  return (
    <div>
      <div className="mb-4">
        <p className="eyebrow">Maschinenstamm</p>
        <h1>Maschinen</h1>
      </div>

      <div className="flex flex-col sm:flex-row gap-2 mb-3">
        <div className="flex-1"><Suchfeld wert={suche} onChange={setSuche} platzhalter="Typ, Nummer oder Kunde" /></div>
        <select className="sm:max-w-[220px]" value={sortMode} onChange={(e) => setSortMode(e.target.value as SortMode)} aria-label="Sortierung">
          {SORT_OPTIONS.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
        </select>
      </div>

      {sortierteMachines === null ? (
        <div className="text-sm text-ink-soft">Lädt…</div>
      ) : gefiltert.length === 0 ? (
        <div className="text-sm text-ink-soft border border-dashed border-line p-6 text-center">Keine Maschine gefunden.</div>
      ) : (
        <div className="flex flex-col gap-2">
          {gefiltert.map((m) => (
            <div key={m.id} onClick={() => navigate(`/maschinen/${m.id}`)} className="card p-4 cursor-pointer hover:border-ink transition-colors">
              <div className="flex items-baseline justify-between gap-3">
                <span className="font-mono font-semibold text-[16px]">{m.bezeichnung}</span>
                <span className="font-mono text-[12.5px] text-ink-soft">{m.steuerung || ''}</span>
              </div>
              <div className="font-mono text-[12.5px] text-ink-soft mt-1">{m.hersteller || '–'} · Nr. {m.nummer || '–'}</div>
              <div className="text-[14px] mt-1.5">{customers[m.kunde_id]?.name || '–'}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
