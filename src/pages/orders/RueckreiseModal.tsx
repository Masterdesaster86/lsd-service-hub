import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { Modal, ModalActions, ModalTitle } from '../../components/ui/Modal'
import { TimeSelect } from '../../components/ui/TimeSelect'
import { useToast } from '../../components/ui/Toast'
import { hhmm } from '../../lib/format'
import type { ServiceberichtTag } from '../../lib/types'

/** Rückreise eines bereits erfassten, noch offenen Tages ändern/ergänzen. */
export function RueckreiseModal({ tag, onClose, onSaved }: { tag: ServiceberichtTag; onClose: () => void; onSaved: () => void }) {
  const toast = useToast()
  const [rueckreiseBis, setRueckreiseBis] = useState(tag.rueckreise_bis || '19:00')
  const [kmRueck, setKmRueck] = useState(tag.km_rueck?.toString() || '')
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    const { error } = await supabase.from('servicebericht_tage').update({
      rueckreise_bis: rueckreiseBis,
      km_rueck: kmRueck ? parseInt(kmRueck) : null,
    }).eq('id', tag.id)
    setSaving(false)
    if (error) { toast('Fehler: ' + error.message); return }
    toast('Rückreise-Ende gespeichert.')
    onSaved()
  }

  return (
    <Modal onClose={onClose}>
      <ModalTitle>Rückreise nachtragen</ModalTitle>
      <p className="text-sm text-ink-soft -mt-3 mb-4">{tag.datum.split('-').reverse().join('.')}</p>
      <div className="mb-3.5"><label>Rückreise-Beginn</label><div className="val">{hhmm(tag.arbeitsende) || '–'} Uhr</div></div>
      <div className="grid grid-cols-2 gap-3.5 max-sm:grid-cols-1">
        <div><label>Rückreise — Ende</label><TimeSelect value={rueckreiseBis} onChange={setRueckreiseBis} /></div>
        <div><label>Kilometer Rückreise</label><input type="number" min={0} value={kmRueck} onChange={(e) => setKmRueck(e.target.value)} placeholder="z.B. 60" /></div>
      </div>
      <ModalActions>
        <button className="btn btn-amber" disabled={saving} onClick={handleSave}>Speichern</button>
        <button className="btn btn-outline" onClick={onClose}>Abbrechen</button>
      </ModalActions>
    </Modal>
  )
}
