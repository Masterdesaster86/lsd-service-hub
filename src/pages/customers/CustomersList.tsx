import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import type { Customer, Machine } from '../../lib/types'
import { CustomerFormModal } from './CustomerFormModal'

export function CustomersList() {
  const navigate = useNavigate()
  const [customers, setCustomers] = useState<Customer[] | null>(null)
  const [machines, setMachines] = useState<Machine[]>([])
  const [showNew, setShowNew] = useState(false)

  async function load() {
    const [{ data: c }, { data: m }] = await Promise.all([
      supabase.from('customers').select('*').order('name'),
      supabase.from('machines').select('*'),
    ])
    setCustomers(c || [])
    setMachines(m || [])
  }

  useEffect(() => { load() }, [])

  return (
    <div>
      <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
        <div>
          <h1 className="text-xl font-semibold m-0">Kunden</h1>
          <p className="text-sm text-ink-soft mt-1">Firmenstamm mit Ansprechpartnern und Maschinen</p>
        </div>
        <button className="btn btn-amber" onClick={() => setShowNew(true)}>+ Neuer Kunde</button>
      </div>

      {customers === null ? (
        <div className="text-sm text-ink-soft">Lädt…</div>
      ) : (
        <div className="flex flex-col gap-2">
          {customers.map((c) => (
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
