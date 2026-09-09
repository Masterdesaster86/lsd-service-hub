import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/AuthContext'
import type { Employee } from '../../lib/types'
import { useConfirm } from '../../components/ui/ConfirmProvider'
import { useToast } from '../../components/ui/Toast'
import { MitarbeiterFormModal } from './MitarbeiterFormModal'

const ROLE_TAG: Record<string, string> = {
  Administrator: 'tag-unterwegs',
  CEO: 'tag-geplant',
  Disposition: 'tag-arbeit',
  Techniker: 'tag-neu',
}

export function Mitarbeiter() {
  const { employee: me } = useAuth()
  const confirm = useConfirm()
  const toast = useToast()
  const [employees, setEmployees] = useState<Employee[] | null>(null)
  const [showNew, setShowNew] = useState(false)
  const [editing, setEditing] = useState<Employee | null>(null)

  async function load() {
    const { data } = await supabase.from('employees').select('*')
    setEmployees((data || []).sort((a, b) => Number(b.aktiv) - Number(a.aktiv) || a.name.localeCompare(b.name)))
  }

  useEffect(() => { load() }, [])

  async function toggleAktiv(e: Employee) {
    if (e.aktiv && e.id === me?.id) { toast('Du kannst deinen eigenen, gerade aktiven Account nicht deaktivieren.'); return }
    const aktion = e.aktiv ? 'deaktivieren' : 'wieder aktivieren'
    const ok = await confirm({ message: `${e.name} wirklich ${aktion}?`, danger: e.aktiv, confirmLabel: e.aktiv ? 'Deaktivieren' : 'Aktivieren' })
    if (!ok) return
    const { error } = await supabase.from('employees').update({ aktiv: !e.aktiv }).eq('id', e.id)
    if (error) { toast('Fehler: ' + error.message); return }
    toast(!e.aktiv ? 'Mitarbeiter aktiviert.' : 'Mitarbeiter deaktiviert.')
    load()
  }

  return (
    <div>
      <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
        <div>
          <h1 className="text-xl font-semibold m-0">Mitarbeiter</h1>
          <p className="text-sm text-ink-soft mt-1">Benutzerkonten und Rollen verwalten.</p>
        </div>
        <button className="btn btn-amber" onClick={() => setShowNew(true)}>+ Neuer Mitarbeiter</button>
      </div>

      {employees === null ? (
        <div className="text-sm text-ink-soft">Lädt…</div>
      ) : (
        <div className="flex flex-col gap-2">
          {employees.map((e) => (
            <div key={e.id} className="card p-4 flex items-center justify-between gap-3 flex-wrap">
              <div>
                <div className={`font-semibold ${e.aktiv ? '' : 'text-ink-soft'}`}>{e.name} {!e.aktiv && <span className="font-normal text-xs">(deaktiviert)</span>}</div>
                <div className="text-[13px] text-ink-soft">{e.email || '–'}</div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`tag ${ROLE_TAG[e.role] || 'tag-neu'}`}>{e.role}</span>
                <button className="btn btn-outline btn-sm" onClick={() => setEditing(e)}>Bearbeiten</button>
                <button className={`btn btn-sm ${e.aktiv ? 'btn-danger' : 'btn-outline'}`} onClick={() => toggleAktiv(e)}>{e.aktiv ? 'Deaktivieren' : 'Aktivieren'}</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showNew && <MitarbeiterFormModal onClose={() => setShowNew(false)} onSaved={() => { setShowNew(false); load() }} />}
      {editing && <MitarbeiterFormModal employee={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load() }} />}
    </div>
  )
}
