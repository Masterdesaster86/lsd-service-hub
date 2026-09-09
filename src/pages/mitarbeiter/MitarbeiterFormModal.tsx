import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/AuthContext'
import type { Employee, Role } from '../../lib/types'
import { Modal, ModalActions, ModalTitle } from '../../components/ui/Modal'
import { useToast } from '../../components/ui/Toast'

const ROLES: Role[] = ['Techniker', 'Disposition', 'Administrator']

export function MitarbeiterFormModal({ employee: editEmployee, onClose, onSaved }: { employee?: Employee; onClose: () => void; onSaved: () => void }) {
  const { employee: me } = useAuth()
  const toast = useToast()
  const editing = !!editEmployee
  const [name, setName] = useState(editEmployee?.name || '')
  const [email, setEmail] = useState(editEmployee?.email || '')
  const [role, setRole] = useState<Role>((editEmployee?.role as Role) || 'Techniker')
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    if (!name.trim() || !email.trim()) { toast('Bitte Name und E-Mail eintragen.'); return }
    if (editing && editEmployee!.id === me?.id && role !== editEmployee!.role) {
      toast('Du kannst deine eigene Rolle nicht selbst ändern lassen — bitte einen anderen Administrator bitten.')
      return
    }
    setSaving(true)
    const payload = { name: name.trim(), email: email.trim(), role }
    const { error } = editing
      ? await supabase.from('employees').update(payload).eq('id', editEmployee!.id)
      : await supabase.from('employees').insert(payload)
    setSaving(false)
    if (error) {
      toast(error.code === '23505' ? 'Diese E-Mail-Adresse ist schon vergeben.' : 'Fehler: ' + error.message)
      return
    }
    toast(editing ? 'Mitarbeiter aktualisiert.' : 'Mitarbeiter angelegt.')
    onSaved()
  }

  return (
    <Modal onClose={onClose}>
      <ModalTitle>{editing ? 'Mitarbeiter bearbeiten' : 'Neuer Mitarbeiter'}</ModalTitle>
      <div className="grid grid-cols-2 gap-3.5">
        <div className="col-span-2"><label>Name</label><input value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div className="col-span-2"><label>E-Mail</label><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="vorname.nachname@lsd-maschinenservice.de" /></div>
        <div><label>Rolle</label><select value={role} onChange={(e) => setRole(e.target.value as Role)}>{ROLES.map((r) => <option key={r} value={r}>{r}</option>)}</select></div>
      </div>
      {!editing && (
        <p className="text-sm text-ink-soft mt-2">
          Legt nur den Mitarbeiterdatensatz an. Für den Login muss zusätzlich im Supabase-Dashboard unter Authentication ein Benutzerkonto mit dieser E-Mail-Adresse angelegt und dessen Auth-User-ID hier hinterlegt werden.
        </p>
      )}
      <ModalActions>
        <button className="btn btn-amber" disabled={saving} onClick={handleSave}>{editing ? 'Speichern' : 'Anlegen'}</button>
        <button className="btn btn-outline" onClick={onClose}>Abbrechen</button>
      </ModalActions>
    </Modal>
  )
}
