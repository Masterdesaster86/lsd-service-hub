import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/AuthContext'
import type { Employee, Role } from '../../lib/types'
import { Modal, ModalActions, ModalTitle } from '../../components/ui/Modal'
import { useToast } from '../../components/ui/Toast'

const ROLES: Role[] = ['Techniker', 'Disposition', 'CEO', 'Administrator']
const MIN_PASSWORT = 8

/** Ruft die Serverfunktion, die das Login-Passwort setzt. Im Browser geht das
 * nicht — fremde Passwoerter darf nur der Service-Role-Schluessel aendern. */
async function passwortSetzen(employeeId: string, passwort: string) {
  const { data, error } = await supabase.functions.invoke('mitarbeiter-konto', {
    body: { employee_id: employeeId, passwort },
  })
  if (error) {
    // Bei 4xx/5xx steckt die Meldung im Response-Body, nicht in error.message.
    let text = error.message
    try {
      const body = await (error as { context?: Response }).context?.json()
      if (body?.fehler) text = body.fehler
    } catch { /* Body war kein JSON — dann bleibt error.message */ }
    throw new Error(text)
  }
  return data as { ok: boolean; angelegt: boolean }
}

export function MitarbeiterFormModal({ employee: editEmployee, onClose, onSaved }: { employee?: Employee; onClose: () => void; onSaved: () => void }) {
  const { employee: me } = useAuth()
  const toast = useToast()
  const editing = !!editEmployee
  const hatLogin = !!editEmployee?.auth_user_id
  const [name, setName] = useState(editEmployee?.name || '')
  const [email, setEmail] = useState(editEmployee?.email || '')
  const [role, setRole] = useState<Role>((editEmployee?.role as Role) || 'Techniker')
  const [passwort, setPasswort] = useState('')
  const [passwortWdh, setPasswortWdh] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    if (!name.trim() || !email.trim()) { toast('Bitte Name und E-Mail eintragen.'); return }
    if (editing && editEmployee!.id === me?.id && role !== editEmployee!.role) {
      toast('Du kannst deine eigene Rolle nicht selbst ändern lassen — bitte einen anderen Administrator bitten.')
      return
    }
    if (passwort) {
      if (passwort.length < MIN_PASSWORT) { toast(`Das Passwort muss mindestens ${MIN_PASSWORT} Zeichen haben.`); return }
      if (passwort !== passwortWdh) { toast('Die beiden Passwörter stimmen nicht überein.'); return }
    }

    setSaving(true)
    const payload = { name: name.trim(), email: email.trim(), role }
    const { data: gespeichert, error } = editing
      ? await supabase.from('employees').update(payload).eq('id', editEmployee!.id).select('id').single()
      : await supabase.from('employees').insert(payload).select('id').single()

    if (error) {
      setSaving(false)
      toast(error.code === '23505' ? 'Diese E-Mail-Adresse ist schon vergeben.' : 'Fehler: ' + error.message)
      return
    }

    if (passwort) {
      try {
        const ergebnis = await passwortSetzen(gespeichert.id, passwort)
        setSaving(false)
        toast(ergebnis.angelegt ? 'Mitarbeiter gespeichert und Login angelegt.' : 'Mitarbeiter gespeichert, Passwort geändert.')
        onSaved()
      } catch (e) {
        setSaving(false)
        // Die Stammdaten sind schon gespeichert — das muss der Nutzer wissen,
        // sonst probiert er alles noch einmal.
        toast('Daten gespeichert, aber das Passwort nicht: ' + (e as Error).message)
      }
      return
    }

    setSaving(false)
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

      <div className="border-t border-line mt-4 pt-3.5">
        <div className="font-semibold text-sm uppercase tracking-wide text-ink-soft mb-2">
          {editing && hatLogin ? 'Passwort ändern' : 'Login anlegen'}
        </div>
        <div className="grid grid-cols-2 gap-3.5">
          <div><label>{editing && hatLogin ? 'Neues Passwort' : 'Passwort'}</label><input type="password" value={passwort} onChange={(e) => setPasswort(e.target.value)} autoComplete="new-password" placeholder={editing && hatLogin ? 'leer lassen = unverändert' : ''} /></div>
          <div><label>Wiederholen</label><input type="password" value={passwortWdh} onChange={(e) => setPasswortWdh(e.target.value)} autoComplete="new-password" /></div>
        </div>
        <p className="text-[13px] text-ink-soft mt-2">
          {editing && hatLogin
            ? `Mindestens ${MIN_PASSWORT} Zeichen. Leer lassen, wenn nur Name, E-Mail oder Rolle geändert werden sollen. Der Mitarbeiter wird nicht automatisch informiert — sag ihm das neue Passwort bitte selbst.`
            : `Mindestens ${MIN_PASSWORT} Zeichen. Damit kann sich der Mitarbeiter mit seiner E-Mail-Adresse anmelden. Ohne Passwort wird nur der Datensatz angelegt, das Login kann später nachgetragen werden.`}
        </p>
      </div>

      <ModalActions>
        <button className="btn btn-amber" disabled={saving} onClick={handleSave}>{saving ? 'Speichern…' : editing ? 'Speichern' : 'Anlegen'}</button>
        <button className="btn btn-outline" onClick={onClose}>Abbrechen</button>
      </ModalActions>
    </Modal>
  )
}
