import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { Modal, ModalActions, ModalTitle } from '../../components/ui/Modal'
import { TimeSelect } from '../../components/ui/TimeSelect'
import { useToast } from '../../components/ui/Toast'
import { hhmm } from '../../lib/format'
import type { Servicebericht, ServiceberichtTag } from '../../lib/types'

/** Rückreise eines LETZTEN Tages nachtragen, wenn der Bericht bereits abgeschlossen ist.
 * Läuft bewusst über einen separaten Nachtrags-Bericht, der Originalbericht bleibt unverändert. */
export function RueckreiseNachtragModal({ bericht, letzterTag, onClose, onSaved }: { bericht: Servicebericht; letzterTag: ServiceberichtTag; onClose: () => void; onSaved: () => void }) {
  const toast = useToast()
  const [ende, setEnde] = useState('19:00')
  const [km, setKm] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    const datumDE = letzterTag.datum.split('-').reverse().join('.')
    const { data: nachtrag, error: e1 } = await supabase.from('serviceberichte').insert({
      auftrag_id: bericht.auftrag_id,
      maschine_id: bericht.maschine_id,
      techniker_id: bericht.techniker_id,
      ist_nachtrag: true,
      nachtrag_zu: bericht.id,
      durchgefuehrte_arbeiten: `Nachtrag zu Bericht ${bericht.bericht_nummer} vom ${datumDE}: Rückreise nachträglich mit Ende ${ende} Uhr erfasst.`,
    }).select('id').single()
    if (e1 || !nachtrag) { toast('Fehler: ' + e1?.message); setSaving(false); return }

    const { error: e2 } = await supabase.from('servicebericht_tage').insert({
      servicebericht_id: nachtrag.id,
      datum: letzterTag.datum,
      hinreise_von: letzterTag.hinreise_von,
      km_hin: letzterTag.km_hin,
      arbeitsbeginn: letzterTag.arbeitsbeginn,
      arbeitsende: letzterTag.arbeitsende,
      rueckreise_bis: ende,
      km_rueck: km ? parseInt(km) : null,
      pause_von: letzterTag.pause_von,
      pause_bis: letzterTag.pause_bis,
      uebernachtung: letzterTag.uebernachtung,
      hotelkosten: letzterTag.hotelkosten,
    })
    if (e2) { toast('Fehler: ' + e2.message); setSaving(false); return }

    const { error: e3 } = await supabase.from('serviceberichte').update({
      status: 'abgeschlossen',
      abgeschlossen_am: bericht.abgeschlossen_am ?? new Date().toISOString(),
    }).eq('id', nachtrag.id)
    setSaving(false)
    if (e3) { toast('Fehler: ' + e3.message); return }

    toast('Rückreise nachgetragen — zusätzlicher Bericht gespeichert.')
    onSaved()
  }

  return (
    <Modal onClose={onClose}>
      <ModalTitle>Rückreise eintragen</ModalTitle>
      <p className="text-sm text-ink-soft -mt-3 mb-4">
        {letzterTag.datum.split('-').reverse().join('.')} — der Bericht ist bereits abgeschlossen. Die Rückreise wird deshalb in einem zusätzlichen Nachtrags-Bericht gespeichert, der Originalbericht bleibt unverändert.
      </p>
      <div className="mb-3.5"><label>Rückreise-Beginn</label><div className="val">{hhmm(letzterTag.arbeitsende) || '–'} Uhr</div></div>
      <div className="grid grid-cols-2 gap-3.5 max-sm:grid-cols-1">
        <div><label>Rückreise — Ende</label><TimeSelect value={ende} onChange={setEnde} /></div>
        <div><label>Kilometer Rückreise</label><input type="number" min={0} value={km} onChange={(e) => setKm(e.target.value)} placeholder="z.B. 60" /></div>
      </div>
      <ModalActions>
        <button className="btn btn-amber" disabled={saving} onClick={handleSave}>Speichern</button>
        <button className="btn btn-outline" onClick={onClose}>Abbrechen</button>
      </ModalActions>
    </Modal>
  )
}
