import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import type { Customer } from '../../lib/types'
import { Modal, ModalActions, ModalTitle } from '../../components/ui/Modal'
import { useToast } from '../../components/ui/Toast'

export function CustomerFormModal({ customer, onClose, onSaved }: { customer?: Customer; onClose: () => void; onSaved: (id: string) => void }) {
  const toast = useToast()
  const editing = !!customer
  const [name, setName] = useState(customer?.name || '')
  const [strasse, setStrasse] = useState(customer?.strasse || '')
  const [plz, setPlz] = useState(customer?.plz || '')
  const [ort, setOrt] = useState(customer?.ort || '')
  const [rechnungsEmail, setRechnungsEmail] = useState(customer?.rechnungs_email || '')
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    if (!name.trim()) { toast('Bitte einen Firmennamen eintragen.'); return }
    setSaving(true)
    const payload = {
      name: name.trim(),
      strasse: strasse || null,
      plz: plz || null,
      ort: ort || null,
      rechnungs_email: rechnungsEmail.trim() || null,
    }
    if (editing) {
      const { error } = await supabase.from('customers').update(payload).eq('id', customer!.id)
      setSaving(false)
      if (error) { toast('Fehler: ' + error.message); return }
      toast('Kunde aktualisiert.')
      onSaved(customer!.id)
    } else {
      const { data, error } = await supabase.from('customers').insert(payload).select('id').single()
      setSaving(false)
      if (error || !data) { toast('Fehler: ' + error?.message); return }
      toast('Kunde angelegt.')
      onSaved(data.id)
    }
  }

  return (
    <Modal onClose={onClose}>
      <ModalTitle>{editing ? 'Kunde bearbeiten' : 'Neuer Kunde'}</ModalTitle>
      <div className="grid grid-cols-2 gap-3.5">
        <div className="col-span-2"><label>Firmenname</label><input value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div className="col-span-2"><label>Straße</label><input value={strasse} onChange={(e) => setStrasse(e.target.value)} /></div>
        <div><label>PLZ</label><input value={plz} onChange={(e) => setPlz(e.target.value)} /></div>
        <div><label>Ort</label><input value={ort} onChange={(e) => setOrt(e.target.value)} /></div>
        <div className="col-span-2">
          <label>Rechnungs-E-Mail</label>
          <input type="email" value={rechnungsEmail} onChange={(e) => setRechnungsEmail(e.target.value)} placeholder="optional, z. B. rechnungen@firma.de" />
          <p className="text-[13px] text-ink-soft mt-1 mb-0">Sammeladresse der Buchhaltung. Bewusst kein Ansprechpartner, damit sie nicht versehentlich als Empfänger eines Serviceberichts ausgewählt wird.</p>
        </div>
      </div>
      <ModalActions>
        <button className="btn btn-amber" disabled={saving} onClick={handleSave}>{editing ? 'Speichern' : 'Anlegen'}</button>
        <button className="btn btn-outline" onClick={onClose}>Abbrechen</button>
      </ModalActions>
    </Modal>
  )
}
