import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/AuthContext'
import { Modal, ModalActions, ModalTitle } from '../../components/ui/Modal'
import { useToast } from '../../components/ui/Toast'

const FEHLZEIT_ARTEN = ['Krank', 'Schulung', 'Kurzarbeit']

export function FehlzeitModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { employee } = useAuth()
  const toast = useToast()
  const [art, setArt] = useState(FEHLZEIT_ARTEN[0])
  const [von, setVon] = useState('')
  const [bis, setBis] = useState('')
  const [bemerkung, setBemerkung] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    if (!von || !bis) { toast('Bitte Von- und Bis-Datum angeben.'); return }
    if (!employee) return
    setSaving(true)
    const { error } = await supabase.from('abwesenheiten').insert({ techniker_id: employee.id, von, bis, art, bemerkung: bemerkung.trim() || null })
    setSaving(false)
    if (error) { toast('Fehler: ' + error.message); return }
    toast('Fehlzeit eingetragen.')
    onSaved()
  }

  return (
    <Modal onClose={onClose}>
      <ModalTitle>Fehlzeit melden</ModalTitle>
      <div className="grid grid-cols-2 gap-3.5">
        <div><label>Art</label><select value={art} onChange={(e) => setArt(e.target.value)}>{FEHLZEIT_ARTEN.map((a) => <option key={a} value={a}>{a}</option>)}</select></div>
        <div />
        <div><label>Von</label><input type="date" value={von} onChange={(e) => setVon(e.target.value)} /></div>
        <div><label>Bis</label><input type="date" value={bis} onChange={(e) => setBis(e.target.value)} /></div>
        <div className="col-span-2"><label>Bemerkung</label><input value={bemerkung} onChange={(e) => setBemerkung(e.target.value)} placeholder="optional" /></div>
      </div>
      <p className="text-sm text-ink-soft mt-2">Wird sofort eingetragen — anders als beim Urlaub ist hier keine Genehmigung nötig.</p>
      <ModalActions>
        <button className="btn btn-amber" disabled={saving} onClick={handleSave}>Eintragen</button>
        <button className="btn btn-outline" onClick={onClose}>Abbrechen</button>
      </ModalActions>
    </Modal>
  )
}
