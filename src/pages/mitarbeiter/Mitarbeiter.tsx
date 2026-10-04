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
          <h1>Mitarbeiter</h1>
          <p className="text-sm text-ink-soft mt-1">Benutzerkonten und Rollen verwalten.</p>
        </div>
        <button className="btn btn-amber max-sm:w-full" onClick={() => setShowNew(true)}>+ Neuer Mitarbeiter</button>
      </div>

      {employees === null ? (
        <div className="text-sm text-ink-soft">Lädt…</div>
      ) : (
        <div className="flex flex-col gap-2">
          {employees.map((e) => (
            <div key={e.id} className="card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className={`font-semibold text-[16px] ${e.aktiv ? '' : 'text-ink-soft'}`}>{e.name} {!e.aktiv && <span className="font-normal text-xs">(deaktiviert)</span>}</div>
                  <div className="text-[13.5px] text-ink-soft break-all">{e.email || '–'}</div>
                </div>
                <span className={`tag shrink-0 ${ROLE_TAG[e.role] || 'tag-neu'}`}>{e.role}</span>
              </div>
              {!e.auth_user_id && (
                <div className="text-[13px] text-ink-soft mt-1.5">Noch kein Login — beim Bearbeiten ein Passwort vergeben.</div>
              )}
              <div className="grid grid-cols-2 gap-2 mt-3 sm:max-w-md">
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
