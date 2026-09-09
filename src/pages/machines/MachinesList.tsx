import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import type { Customer, Machine } from '../../lib/types'

export function MachinesList() {
  const navigate = useNavigate()
  const [machines, setMachines] = useState<Machine[] | null>(null)
  const [customers, setCustomers] = useState<Record<string, Customer>>({})

  useEffect(() => {
    Promise.all([
      supabase.from('machines').select('*').order('bezeichnung'),
      supabase.from('customers').select('*'),
    ]).then(([{ data: m }, { data: c }]) => {
      setMachines(m || [])
      setCustomers(Object.fromEntries((c || []).map((x) => [x.id, x])))
    })
  }, [])

  return (
    <div>
      <h1 className="text-xl font-semibold m-0">Maschinen</h1>
      <p className="text-sm text-ink-soft mt-1 mb-4">Maschinenstamm aller Kunden</p>

      {machines === null ? (
        <div className="text-sm text-ink-soft">Lädt…</div>
      ) : (
        <div className="flex flex-col gap-2">
          {machines.map((m) => (
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
