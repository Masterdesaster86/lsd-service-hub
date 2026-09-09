import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import type { Abwesenheit, Employee } from '../../lib/types'
import { Modal, ModalActions, ModalTitle } from '../../components/ui/Modal'
import { useToast } from '../../components/ui/Toast'

const ARTEN = ['Urlaub', 'Krank', 'Schulung', 'Kurzarbeit']

/** Abwesenheit (Urlaub, Krank, ...) anlegen oder bearbeiten — für Leitung
 * (CEO/Disposition/Administrator), die auch fremde Einträge pflegen darf. */
export function AbwesenheitFormModal({ abwesenheit, mitarbeiter, onClose, onSaved }: {
  abwesenheit?: Abwesenheit
  mitarbeiter: Employee[]
  onClose: () => void
  onSaved: () => void
}) {
  const toast = useToast()
  const editing = !!abwesenheit
  const [technikerId, setTechnikerId] = useState(abwesenheit?.techniker_id || '')
  const [art, setArt] = useState(abwesenheit?.art || ARTEN[0])
  const [von, setVon] = useState(abwesenheit?.von || '')
  const [bis, setBis] = useState(abwesenheit?.bis || '')
  const [bemerkung, setBemerkung] = useState(abwesenheit?.bemerkung || '')
  const [saving, setSaving] = useState(false)
  // Stammt der Eintrag aus einem genehmigten Urlaubsantrag, gehoeren Mitarbeiter
  // und Art zum Antrag und duerfen hier nicht umgebogen werden. Der Zeitraum
  // schon — den zieht die Datenbank auf den Antrag nach.
  const ausAntrag = !!abwesenheit?.urlaubsantrag_id

  async function handleSave() {
    if (!technikerId) { toast('Bitte einen Mitarbeiter wählen.'); return }
    if (!von || !bis) { toast('Bitte Von- und Bis-Datum angeben.'); return }
    if (bis < von) { toast('Das Bis-Datum darf nicht vor dem Von-Datum liegen.'); return }
    setSaving(true)
    const payload = { techniker_id: technikerId, art, von, bis, bemerkung: bemerkung.trim() || null }
    const { error } = editing
      ? await supabase.from('abwesenheiten').update(payload).eq('id', abwesenheit!.id)
      : await supabase.from('abwesenheiten').insert(payload)
    setSaving(false)
    if (error) { toast('Fehler: ' + error.message); return }
    toast(editing ? 'Abwesenheit aktualisiert.' : 'Abwesenheit eingetragen.')
    onSaved()
  }

  return (
    <Modal onClose={onClose}>
      <ModalTitle>{editing ? 'Abwesenheit bearbeiten' : 'Abwesenheit eintragen'}</ModalTitle>
      <div className="grid grid-cols-2 gap-3.5">
        <div className="col-span-2">
          <label>Mitarbeiter</label>
          <select value={technikerId} disabled={ausAntrag} onChange={(e) => setTechnikerId(e.target.value)}>
            <option value="">– wählen –</option>
            {mitarbeiter.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </div>
        <div>
          <label>Art</label>
          <select value={art} disabled={ausAntrag} onChange={(e) => setArt(e.target.value)}>
            {ARTEN.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
        <div />
        {ausAntrag && (
          <p className="col-span-2 text-[13px] text-ink-soft -mt-1">
            Aus einem genehmigten Urlaubsantrag entstanden. Mitarbeiter und Art sind deshalb fest; ein geänderter Zeitraum wird beim Techniker mit übernommen.
          </p>
        )}
        <div><label>Von</label><input type="date" value={von} onChange={(e) => setVon(e.target.value)} /></div>
        <div><label>Bis</label><input type="date" value={bis} onChange={(e) => setBis(e.target.value)} /></div>
        <div className="col-span-2"><label>Bemerkung</label><input value={bemerkung} onChange={(e) => setBemerkung(e.target.value)} placeholder="optional" /></div>
      </div>
      <ModalActions>
        <button className="btn btn-amber" disabled={saving} onClick={handleSave}>{editing ? 'Speichern' : 'Eintragen'}</button>
        <button className="btn btn-outline" onClick={onClose}>Abbrechen</button>
      </ModalActions>
    </Modal>
  )
}
