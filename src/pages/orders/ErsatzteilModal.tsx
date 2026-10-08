import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/AuthContext'
import { Modal, ModalActions, ModalTitle } from '../../components/ui/Modal'
import { useToast } from '../../components/ui/Toast'
import { easybillAufruf } from '../../lib/easybillRechnung'

const zahl = (s: string): number | null => {
  const n = Number(s.replace(',', '.').trim())
  return s.trim() === '' || !Number.isFinite(n) ? null : Math.round(n * 100) / 100
}
const text = (n: number | null) => (n == null ? '' : n.toFixed(2).replace('.', ','))

export function ErsatzteilModal({ berichtId, onClose, onSaved }: { berichtId: string; onClose: () => void; onSaved: () => void }) {
  const toast = useToast()
  const { employee } = useAuth()
  // Preise und Artikelnummer sieht nur das Büro (CEO, Administrator, Disposition); der Techniker trägt nur das Teil ein.
  const mitPreisen = !!employee && employee.role !== 'Techniker'
  const [idNummer, setIdNummer] = useState('')
  const [bezeichnung, setBezeichnung] = useState('')
  const [menge, setMenge] = useState(1)
  const [einkauf, setEinkauf] = useState('')
  const [verkauf, setVerkauf] = useState('')
  const [artikelnummer, setArtikelnummer] = useState('')
  const [saving, setSaving] = useState(false)

  // Verkaufspreis = Einkauf + 50 %, solange nichts anderes eingetragen wurde
  function einkaufAendern(wert: string) {
    setEinkauf(wert)
    const ek = zahl(wert)
    if (ek != null && (verkauf.trim() === '' || verkauf === text(zahl(einkauf) == null ? null : Math.round(zahl(einkauf)! * 150) / 100))) {
      setVerkauf(text(Math.round(ek * 150) / 100))
    }
  }

  async function handleSave() {
    if (!bezeichnung.trim()) { toast('Bitte eine Bezeichnung eintragen.'); return }
    const ek = zahl(einkauf), vk = zahl(verkauf)
    if (mitPreisen && ((einkauf.trim() && ek == null) || (verkauf.trim() && vk == null))) { toast('Bitte Preise als Zahl eintragen, z. B. 9,00.'); return }
    setSaving(true)
    const { data, error } = await supabase.from('servicebericht_ersatzteile').insert({
      servicebericht_id: berichtId,
      id_nummer: idNummer.trim() || null,
      bezeichnung: bezeichnung.trim(),
      menge,
      ...(mitPreisen ? { einkaufspreis: ek, verkaufspreis: vk, artikelnummer: artikelnummer.trim() || null } : {}),
    }).select('id').single()
    if (error || !data) { setSaving(false); toast('Fehler: ' + error?.message); return }

    // Mit Preis oder Artikelnummer gleich in easybill anlegen bzw. verknüpfen — wenn gerade Netz da ist.
    // Offline oder bei einem Fehler holt die App das spätestens beim Rechnung-Anlegen nach.
    if (mitPreisen && (vk != null || artikelnummer.trim())) {
      try {
        const r = await easybillAufruf<{ ok: boolean; nummer?: string; angelegt?: boolean }>({ aktion: 'ersatzteil_easybill', ersatzteil_id: data.id })
        toast(r.ok ? (r.angelegt ? `Ersatzteil hinzugefügt und in easybill als Artikel ${r.nummer} angelegt.` : `Ersatzteil hinzugefügt und mit easybill-Artikel ${r.nummer || ''} verknüpft.`) : 'Ersatzteil hinzugefügt.')
      } catch {
        toast('Ersatzteil gespeichert. easybill ist gerade nicht erreichbar, der Artikel wird nachgeholt.')
      }
    } else {
      toast('Ersatzteil hinzugefügt.')
    }
    setSaving(false)
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

      {mitPreisen && (
        <div className="border-t border-line mt-4 pt-3.5">
          <div className="abschnitt mb-2">Für die Rechnung (optional)</div>
          <div className="grid grid-cols-3 gap-3.5 max-sm:grid-cols-1">
            <div><label>Einkauf netto (€)</label><input inputMode="decimal" value={einkauf} onChange={(e) => einkaufAendern(e.target.value)} placeholder="z.B. 6,00" /></div>
            <div><label>Verkauf netto (€)</label><input inputMode="decimal" value={verkauf} onChange={(e) => setVerkauf(e.target.value)} placeholder="Einkauf + 50 %" /></div>
            <div><label>easybill-Artikelnr.</label><input value={artikelnummer} onChange={(e) => setArtikelnummer(e.target.value)} placeholder="falls vorhanden" /></div>
          </div>
          <p className="text-[13px] text-ink-soft mt-2 mb-0">
            Mit Verkaufspreis legt die App den Artikel in easybill an. Eine vorhandene Artikelnummer wird verknüpft statt neu angelegt. Ohne Preis fragt die App beim Rechnung-Anlegen nach.
          </p>
        </div>
      )}

      <ModalActions>
        <button className="btn btn-amber" disabled={saving} onClick={handleSave}>{saving ? 'Speichert…' : 'Hinzufügen'}</button>
        <button className="btn btn-outline" onClick={onClose}>Abbrechen</button>
      </ModalActions>
    </Modal>
  )
}
