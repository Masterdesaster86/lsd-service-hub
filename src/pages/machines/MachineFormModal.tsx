import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import type { Customer, Machine } from '../../lib/types'
import { Modal, ModalActions, ModalTitle } from '../../components/ui/Modal'
import { useToast } from '../../components/ui/Toast'

interface Props {
  kundeId?: string
  kundeName?: string
  machine?: Machine
  onClose: () => void
  onSaved: (id: string) => void
}

export function MachineFormModal({ kundeId, kundeName, machine, onClose, onSaved }: Props) {
  const toast = useToast()
  const editing = !!machine
  const [customers, setCustomers] = useState<Customer[]>([])
  const [selectedKundeId, setSelectedKundeId] = useState(machine?.kunde_id || kundeId || '')
  const [bezeichnung, setBezeichnung] = useState(machine?.bezeichnung || '')
  const [hersteller, setHersteller] = useState(machine?.hersteller || '')
  const [nummer, setNummer] = useState(machine?.nummer || '')
  const [kundenNr, setKundenNr] = useState(machine?.kunden_maschinennummer || '')
  const [steuerung, setSteuerung] = useState(machine?.steuerung || '')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!kundeId) supabase.from('customers').select('*').order('name').then(({ data }) => setCustomers(data || []))
  }, [kundeId])

  async function handleSave() {
    if (!bezeichnung.trim()) { toast('Bitte eine Bezeichnung eintragen.'); return }
    if (!selectedKundeId) { toast('Bitte einen Kunden wählen.'); return }
    setSaving(true)
    const payload = {
      bezeichnung: bezeichnung.trim(),
      kunde_id: selectedKundeId,
      hersteller: hersteller || null,
      nummer: nummer || null,
      kunden_maschinennummer: kundenNr || null,
      steuerung: steuerung || null,
    }
    const { data, error } = editing
      ? await supabase.from('machines').update(payload).eq('id', machine!.id).select('id').single()
      : await supabase.from('machines').insert(payload).select('id').single()
    setSaving(false)
    if (error || !data) { toast('Fehler: ' + error?.message); return }
    toast(editing ? 'Maschine aktualisiert.' : 'Maschine angelegt.')
    onSaved(data.id)
  }

  return (
    <Modal onClose={onClose}>
      <ModalTitle>{editing ? 'Maschine bearbeiten' : `Neue Maschine${kundeName ? ` — ${kundeName}` : ''}`}</ModalTitle>
      <div className="grid grid-cols-2 gap-3.5">
        {!kundeId && (
          <div className="col-span-2">
            <label>Kunde</label>
            <select value={selectedKundeId} onChange={(e) => setSelectedKundeId(e.target.value)}>
              <option value="">– wählen –</option>
              {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        )}
        <div className="col-span-2"><label>Bezeichnung</label><input value={bezeichnung} onChange={(e) => setBezeichnung(e.target.value)} placeholder="z.B. DMC 200U" /></div>
        <div><label>Hersteller</label><input value={hersteller} onChange={(e) => setHersteller(e.target.value)} /></div>
        <div><label>Maschinennummer</label><input value={nummer} onChange={(e) => setNummer(e.target.value)} /></div>
        <div><label>Kunden-Maschinennummer</label><input value={kundenNr} onChange={(e) => setKundenNr(e.target.value)} /></div>
        <div><label>Steuerung</label><input value={steuerung} onChange={(e) => setSteuerung(e.target.value)} placeholder="z.B. Heidenhain, Siemens" /></div>
      </div>
      <ModalActions>
        <button className="btn btn-amber" disabled={saving} onClick={handleSave}>{editing ? 'Speichern' : 'Anlegen'}</button>
        <button className="btn btn-outline" onClick={onClose}>Abbrechen</button>
      </ModalActions>
    </Modal>
  )
}
