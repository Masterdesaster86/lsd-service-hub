import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import type { Ansprechpartner } from '../../lib/types'
import { Modal, ModalActions, ModalTitle } from '../../components/ui/Modal'
import { useToast } from '../../components/ui/Toast'

export function AnsprechpartnerFormModal({ kundeId, kundeName, ansprechpartner, onClose, onSaved }: { kundeId: string; kundeName: string; ansprechpartner?: Ansprechpartner; onClose: () => void; onSaved: (id: string) => void }) {
  const toast = useToast()
  const editing = !!ansprechpartner
  const [name, setName] = useState(ansprechpartner?.name || '')
  const [abteilung, setAbteilung] = useState(ansprechpartner?.abteilung || '')
  const [telefon, setTelefon] = useState(ansprechpartner?.telefon || '')
  const [email, setEmail] = useState(ansprechpartner?.email || '')
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    if (!name.trim()) { toast('Bitte einen Namen eintragen.'); return }
    setSaving(true)
    const payload = { name: name.trim(), abteilung: abteilung || null, telefon: telefon || null, email: email.trim() || null }
    const { data, error } = editing
      ? await supabase.from('ansprechpartner').update(payload).eq('id', ansprechpartner!.id).select('id').single()
      : await supabase.from('ansprechpartner').insert({ ...payload, kunde_id: kundeId }).select('id').single()
    setSaving(false)
    if (error || !data) { toast('Fehler: ' + error?.message); return }
    toast(editing ? 'Ansprechpartner aktualisiert.' : 'Ansprechpartner angelegt.')
    onSaved(data.id)
  }

  return (
    <Modal onClose={onClose}>
      <ModalTitle>{editing ? 'Ansprechpartner bearbeiten' : `Neuer Ansprechpartner — ${kundeName}`}</ModalTitle>
      <div className="grid grid-cols-2 gap-3.5">
        <div className="col-span-2"><label>Name</label><input value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div><label>Abteilung</label><input value={abteilung} onChange={(e) => setAbteilung(e.target.value)} /></div>
        <div><label>Telefon</label><input value={telefon} onChange={(e) => setTelefon(e.target.value)} /></div>
        <div className="col-span-2"><label>E-Mail</label><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="z.B. ansprechpartner@kunde.de" /></div>
      </div>
      <ModalActions>
        <button className="btn btn-amber" disabled={saving} onClick={handleSave}>{editing ? 'Speichern' : 'Anlegen'}</button>
        <button className="btn btn-outline" onClick={onClose}>Abbrechen</button>
      </ModalActions>
    </Modal>
  )
}
