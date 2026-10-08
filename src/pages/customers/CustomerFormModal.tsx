import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import type { Customer } from '../../lib/types'
import { Modal, ModalActions, ModalTitle } from '../../components/ui/Modal'
import { useToast } from '../../components/ui/Toast'
import { easybillAufruf } from '../../lib/easybillRechnung'

/** Preisstufen in easybill, angezeigt über den Stundensatz „Arbeitszeit Techniker“ — so erkennt
 * das Büro die richtige Stufe am schnellsten. Leer = Standardpreis. */
export const PREISSTUFEN: { wert: string; label: string }[] = [
  { wert: '', label: '79 € je Stunde (Standard)' },
  { wert: 'SALEPRICE2', label: '84 € je Stunde (Stufe 2)' },
  { wert: 'SALEPRICE3', label: '89 € je Stunde (Stufe 3)' },
  { wert: 'SALEPRICE4', label: '99 € je Stunde (Stufe 4)' },
  { wert: 'SALEPRICE5', label: '94 € je Stunde (Stufe 5)' },
  { wert: 'SALEPRICE6', label: '135 € je Stunde (Stufe 6)' },
  { wert: 'SALEPRICE7', label: '105 € je Stunde (Stufe 7)' },
]

export function preisstufeLabel(wert: string | null | undefined): string {
  return PREISSTUFEN.find((p) => p.wert === (wert || ''))?.label || (wert || '–')
}

export function CustomerFormModal({ customer, onClose, onSaved }: { customer?: Customer; onClose: () => void; onSaved: (id: string) => void }) {
  const toast = useToast()
  const editing = !!customer
  const [name, setName] = useState(customer?.name || '')
  const [strasse, setStrasse] = useState(customer?.strasse || '')
  const [plz, setPlz] = useState(customer?.plz || '')
  const [ort, setOrt] = useState(customer?.ort || '')
  const [rechnungsEmail, setRechnungsEmail] = useState(customer?.rechnungs_email || '')
  const [preisstufe, setPreisstufe] = useState(customer?.preisstufe || '')
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
      preisstufe: preisstufe || null,
    }
    if (editing) {
      const { error } = await supabase.from('customers').update(payload).eq('id', customer!.id)
      if (error) { setSaving(false); toast('Fehler: ' + error.message); return }
      // Änderungen auch nach easybill, damit beide Seiten gleich bleiben
      try {
        await easybillAufruf({ aktion: 'kunde_aktualisieren', customer_id: customer!.id })
        toast('Kunde aktualisiert, auch in easybill.')
      } catch (e) {
        toast('Kunde in der App gespeichert, aber easybill nicht erreicht: ' + (e as Error).message)
      }
      setSaving(false)
      onSaved(customer!.id)
    } else {
      const { data, error } = await supabase.from('customers').insert(payload).select('id').single()
      if (error || !data) { setSaving(false); toast('Fehler: ' + error?.message); return }
      // In easybill anlegen; easybill vergibt die Kundennummer
      try {
        const r = await easybillAufruf<{ kundennummer: string }>({ aktion: 'kunde_anlegen', customer_id: data.id })
        toast(`Kunde angelegt, easybill-Kundennummer ${r.kundennummer}.`)
      } catch (e) {
        toast('Kunde in der App angelegt, aber noch nicht in easybill: ' + (e as Error).message + ' Das holt die App beim ersten Auftrag nach.')
      }
      setSaving(false)
      onSaved(data.id)
    }
  }

  return (
    <Modal onClose={onClose}>
      <ModalTitle>{editing ? 'Kunde bearbeiten' : 'Neuer Kunde'}</ModalTitle>
      {!editing && <p className="text-sm text-ink-soft -mt-2 mb-4">Der Kunde wird gleichzeitig in easybill angelegt und bekommt dort seine Kundennummer.</p>}
      <div className="grid grid-cols-2 gap-3.5">
        <div className="col-span-2"><label>Firmenname</label><input value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div className="col-span-2"><label>Straße</label><input value={strasse} onChange={(e) => setStrasse(e.target.value)} /></div>
        <div><label>PLZ</label><input value={plz} onChange={(e) => setPlz(e.target.value)} placeholder="Österreich: A-6682" /></div>
        <div><label>Ort</label><input value={ort} onChange={(e) => setOrt(e.target.value)} /></div>
        <div className="col-span-2">
          <label>Preisstufe (Stundensatz Arbeitszeit Techniker)</label>
          <select value={preisstufe} onChange={(e) => setPreisstufe(e.target.value)}>
            {PREISSTUFEN.map((p) => <option key={p.wert} value={p.wert}>{p.label}</option>)}
          </select>
          <p className="text-[13px] text-ink-soft mt-1 mb-0">Bestimmt alle Preise auf der Rechnung: Arbeits- und Reisezeit, Zuschläge und Kilometer kommen aus dieser Stufe in easybill.</p>
        </div>
        <div className="col-span-2">
          <label>Rechnungs-E-Mail</label>
          <input type="email" value={rechnungsEmail} onChange={(e) => setRechnungsEmail(e.target.value)} placeholder="optional, z. B. rechnungen@firma.de" />
          <p className="text-[13px] text-ink-soft mt-1 mb-0">Sammeladresse der Buchhaltung. Bewusst kein Ansprechpartner, damit sie nicht versehentlich als Empfänger eines Serviceberichts ausgewählt wird.</p>
        </div>
        {editing && customer?.kundennummer && (
          <div className="col-span-2 font-mono text-[12.5px] text-ink-soft">easybill-Kundennummer {customer.kundennummer}</div>
        )}
      </div>
      <ModalActions>
        <button className="btn btn-amber" disabled={saving} onClick={handleSave}>{saving ? 'Speichert…' : editing ? 'Speichern' : 'Anlegen'}</button>
        <button className="btn btn-outline" onClick={onClose}>Abbrechen</button>
      </ModalActions>
    </Modal>
  )
}
