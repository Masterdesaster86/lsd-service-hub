import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/AuthContext'
import { Modal, ModalActions, ModalTitle } from '../../components/ui/Modal'
import { useToast } from '../../components/ui/Toast'
import { MESSPROTOKOLL_TYPEN, type MessprotokollTyp } from '../../lib/messprotokoll'

export function NeuesMessprotokollModal({
  auftragId, maschineId, berichtId, onClose, onCreated,
}: { auftragId: string; maschineId: string; berichtId?: string; onClose: () => void; onCreated: (id: string) => void }) {
  const { employee } = useAuth()
  const toast = useToast()
  const [typ, setTyp] = useState<MessprotokollTyp | null>(null)
  const [saving, setSaving] = useState(false)

  async function anlegen() {
    if (!typ || !employee) return
    setSaving(true)
    const { data, error } = await supabase
      .from('messprotokolle')
      .insert({ auftrag_id: auftragId, maschine_id: maschineId, servicebericht_id: berichtId || null, techniker_id: employee.id, typ })
      .select('id')
      .single()
    setSaving(false)
    if (error || !data) { toast('Fehler: ' + error?.message); return }
    onCreated(data.id)
  }

  return (
    <Modal onClose={onClose}>
      <ModalTitle>Messprotokoll anlegen</ModalTitle>
      <p className="text-sm text-ink-soft -mt-3 mb-4">Für welche Maschinenart?</p>
      <div className="flex flex-col gap-2">
        {(Object.entries(MESSPROTOKOLL_TYPEN) as [MessprotokollTyp, (typeof MESSPROTOKOLL_TYPEN)[MessprotokollTyp]][]).map(([key, def]) => (
          <label key={key} className="check-row check-row-multi">
            <input type="radio" name="messprotokollTyp" className="mt-1" checked={typ === key} onChange={() => setTyp(key)} />
            <span>
              <span className="font-semibold">{def.label}</span><br />
              <span className="check-row-note">{def.kurzbeschreibung}</span>
            </span>
          </label>
        ))}
      </div>
      <ModalActions>
        <button className="btn btn-amber" disabled={!typ || saving} onClick={anlegen}>Weiter</button>
        <button className="btn btn-outline" onClick={onClose}>Abbrechen</button>
      </ModalActions>
    </Modal>
  )
}
