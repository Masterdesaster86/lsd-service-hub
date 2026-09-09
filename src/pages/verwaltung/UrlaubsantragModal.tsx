import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/AuthContext'
import { Modal, ModalActions, ModalTitle } from '../../components/ui/Modal'
import { useToast } from '../../components/ui/Toast'

export function UrlaubsantragModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { employee } = useAuth()
  const toast = useToast()
  const [von, setVon] = useState('')
  const [bis, setBis] = useState('')
  const [bemerkung, setBemerkung] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    if (!von || !bis) { toast('Bitte Von- und Bis-Datum angeben.'); return }
    if (!employee) return
    setSaving(true)
    const { error } = await supabase.from('urlaubsantraege').insert({ techniker_id: employee.id, von, bis, bemerkung: bemerkung.trim() || null })
    setSaving(false)
    if (error) { toast('Fehler: ' + error.message); return }
    toast('Urlaubsantrag gestellt — wartet auf Genehmigung durch die Disposition.')
    onSaved()
  }

  return (
    <Modal onClose={onClose}>
      <ModalTitle>Urlaub beantragen</ModalTitle>
      <div className="grid grid-cols-2 gap-3.5">
        <div><label>Von</label><input type="date" value={von} onChange={(e) => setVon(e.target.value)} /></div>
        <div><label>Bis</label><input type="date" value={bis} onChange={(e) => setBis(e.target.value)} /></div>
        <div className="col-span-2"><label>Bemerkung</label><input value={bemerkung} onChange={(e) => setBemerkung(e.target.value)} placeholder="optional" /></div>
      </div>
      <p className="text-sm text-ink-soft mt-2">Muss von der Disposition genehmigt werden, bevor er in die Plantafel eingetragen wird.</p>
      <ModalActions>
        <button className="btn btn-amber" disabled={saving} onClick={handleSave}>Antrag stellen</button>
        <button className="btn btn-outline" onClick={onClose}>Abbrechen</button>
      </ModalActions>
    </Modal>
  )
}
