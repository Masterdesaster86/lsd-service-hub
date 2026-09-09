import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { Modal, ModalActions, ModalTitle } from '../../components/ui/Modal'
import { useToast } from '../../components/ui/Toast'

export function ErsatzteilModal({ berichtId, onClose, onSaved }: { berichtId: string; onClose: () => void; onSaved: () => void }) {
  const toast = useToast()
  const [idNummer, setIdNummer] = useState('')
  const [bezeichnung, setBezeichnung] = useState('')
  const [menge, setMenge] = useState(1)
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    if (!bezeichnung.trim()) { toast('Bitte eine Bezeichnung eintragen.'); return }
    setSaving(true)
    const { error } = await supabase.from('servicebericht_ersatzteile').insert({
      servicebericht_id: berichtId,
      id_nummer: idNummer.trim() || null,
      bezeichnung: bezeichnung.trim(),
      menge,
    })
    setSaving(false)
    if (error) { toast('Fehler: ' + error.message); return }
    toast('Ersatzteil hinzugefügt.')
    onSaved()
  }

  return (
    <Modal onClose={onClose}>
      <ModalTitle>Ersatzteil hinzufügen</ModalTitle>
      <div className="grid grid-cols-2 gap-3.5 max-sm:grid-cols-1">
        <div><label>ID-Nummer</label><input value={idNummer} onChange={(e) => setIdNummer(e.target.value)} placeholder="z.B. 4021-88" /></div>
        <div><label>Stückzahl</label><input type="number" min={1} value={menge} onChange={(e) => setMenge(parseInt(e.target.value) || 1)} /></div>
        <div className="col-span-2"><label>Bezeichnung</label><input value={bezeichnung} onChange={(e) => setBezeichnung(e.target.value)} placeholder="z.B. Encoder-Kabel Achse X" /></div>
      </div>
      <ModalActions>
        <button className="btn btn-amber" disabled={saving} onClick={handleSave}>Hinzufügen</button>
        <button className="btn btn-outline" onClick={onClose}>Abbrechen</button>
      </ModalActions>
    </Modal>
  )
}
