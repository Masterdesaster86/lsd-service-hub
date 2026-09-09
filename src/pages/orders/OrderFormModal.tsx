import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import type { Ansprechpartner, Customer, Employee, Machine, OrderWithRelations } from '../../lib/types'
import { Modal, ModalActions, ModalTitle } from '../../components/ui/Modal'
import { useToast } from '../../components/ui/Toast'

interface Props {
  order?: OrderWithRelations
  onClose: () => void
  onSaved: (id: string) => void
}

export function OrderFormModal({ order, onClose, onSaved }: Props) {
  const toast = useToast()
  const editing = !!order
  const [customers, setCustomers] = useState<Customer[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [machines, setMachines] = useState<Machine[]>([])
  const [ansprechpartner, setAnsprechpartner] = useState<Ansprechpartner[]>([])
  const [saving, setSaving] = useState(false)

  const [nr, setNr] = useState(order?.id || '')
  const [auftraggeberId, setAuftraggeberId] = useState(order?.auftraggeber_id || '')
  const [einsatzkundeId, setEinsatzkundeId] = useState(order?.einsatzkunde_id || '')
  const [einsatzbeginn, setEinsatzbeginn] = useState(order?.einsatzbeginn || '')
  const [dauer, setDauer] = useState(order?.dauer_tage || 1)
  const [technikerIds, setTechnikerIds] = useState<string[]>(order?.techniker.map((t) => t.id) || [])
  const [machineIds, setMachineIds] = useState<string[]>(order?.machines.map((m) => m.id) || [])
  const [ansprechpartnerId, setAnsprechpartnerId] = useState(order?.ansprechpartner_id || '')
  const [bestellnummer, setBestellnummer] = useState(order?.bestellnummer || '')
  const [kundenreferenznr, setKundenreferenznr] = useState(order?.kundenreferenznr || '')
  const [auftragsnrKunde, setAuftragsnrKunde] = useState(order?.auftragsnr_kunde || '')
  const [meldetext, setMeldetext] = useState(order?.meldetext || '')

  useEffect(() => {
    supabase.from('customers').select('*').order('name').then(({ data }) => setCustomers(data || []))
    supabase.from('employees').select('*').eq('role', 'Techniker').order('name').then(({ data }) => setEmployees(data || []))
    supabase.from('machines').select('*').then(({ data }) => setMachines(data || []))
    supabase.from('ansprechpartner').select('*').then(({ data }) => setAnsprechpartner(data || []))
  }, [])

  const kundenMachines = useMemo(() => machines.filter((m) => m.kunde_id === einsatzkundeId), [machines, einsatzkundeId])
  const kundenAnsprechpartner = useMemo(() => ansprechpartner.filter((a) => a.kunde_id === einsatzkundeId), [ansprechpartner, einsatzkundeId])

  useEffect(() => {
    // Beim Kundenwechsel Auswahl zurücksetzen, außer beim initialen Laden.
    if (!editing || einsatzkundeId !== order?.einsatzkunde_id) {
      setMachineIds((prev) => prev.filter((id) => kundenMachines.some((m) => m.id === id)))
      setAnsprechpartnerId((prev) => (kundenAnsprechpartner.some((a) => a.id === prev) ? prev : ''))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [einsatzkundeId])

  function toggle(list: string[], setList: (v: string[]) => void, id: string) {
    setList(list.includes(id) ? list.filter((x) => x !== id) : [...list, id])
  }

  async function handleSave() {
    if (!editing && !nr.trim()) { toast('Bitte die Auftragsnummer aus easybill eintragen.'); return }
    if (!auftraggeberId || !einsatzkundeId) { toast('Bitte Auftraggeber und Einsatzkunde wählen.'); return }
    setSaving(true)
    try {
      if (editing) {
        const { error } = await supabase.from('orders').update({
          einsatzkunde_id: einsatzkundeId,
          einsatzbeginn: einsatzbeginn || null,
          dauer_tage: dauer,
          ansprechpartner_id: ansprechpartnerId || null,
          bestellnummer: bestellnummer.trim() || null,
          kundenreferenznr: kundenreferenznr.trim() || null,
          auftragsnr_kunde: auftragsnrKunde.trim() || null,
          meldetext: meldetext.trim() || null,
        }).eq('id', order!.id)
        if (error) throw error

        await supabase.from('order_techniker').delete().eq('order_id', order!.id)
        if (technikerIds.length) await supabase.from('order_techniker').insert(technikerIds.map((techniker_id) => ({ order_id: order!.id, techniker_id })))

        await supabase.from('order_machines').delete().eq('order_id', order!.id)
        if (machineIds.length) await supabase.from('order_machines').insert(machineIds.map((machine_id) => ({ order_id: order!.id, machine_id })))

        toast('Auftrag aktualisiert.')
        onSaved(order!.id)
      } else {
        const { error } = await supabase.from('orders').insert({
          id: nr.trim(),
          auftraggeber_id: auftraggeberId,
          einsatzkunde_id: einsatzkundeId,
          einsatzbeginn: einsatzbeginn || null,
          dauer_tage: dauer,
          ansprechpartner_id: ansprechpartnerId || null,
          bestellnummer: bestellnummer.trim() || null,
          kundenreferenznr: kundenreferenznr.trim() || null,
          auftragsnr_kunde: auftragsnrKunde.trim() || null,
          meldetext: meldetext.trim() || null,
        })
        if (error) {
          if (error.code === '23505') toast('Diese Auftragsnummer gibt es schon.')
          else toast('Fehler beim Anlegen: ' + error.message)
          setSaving(false)
          return
        }
        if (technikerIds.length) await supabase.from('order_techniker').insert(technikerIds.map((techniker_id) => ({ order_id: nr.trim(), techniker_id })))
        if (machineIds.length) await supabase.from('order_machines').insert(machineIds.map((machine_id) => ({ order_id: nr.trim(), machine_id })))
        toast('Auftrag angelegt.')
        onSaved(nr.trim())
      }
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Unbekannter Fehler.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal onClose={onClose} width={640}>
      <ModalTitle>{editing ? `Auftrag #${order!.id} bearbeiten` : 'Neuer Serviceauftrag'}</ModalTitle>
      {!editing && <p className="text-sm text-ink-soft -mt-3 mb-4">Auftragsnummer kommt aus easybill und wird nach dem Anlegen gesperrt.</p>}

      <div className="grid grid-cols-2 gap-3.5 max-sm:grid-cols-1">
        {!editing && (
          <div>
            <label>Auftragsnummer (easybill) *</label>
            <input value={nr} onChange={(e) => setNr(e.target.value)} placeholder="z.B. 456123" />
          </div>
        )}
        <div>
          <label>Einsatzbeginn (geplant)</label>
          <input type="date" value={einsatzbeginn} onChange={(e) => setEinsatzbeginn(e.target.value)} />
        </div>
        <div>
          <label>Dauer (Tage)</label>
          <input type="number" min={1} value={dauer} onChange={(e) => setDauer(parseInt(e.target.value) || 1)} />
        </div>
        {!editing && (
          <div>
            <label>Auftraggeber *</label>
            <select value={auftraggeberId} onChange={(e) => setAuftraggeberId(e.target.value)}>
              <option value="">– wählen –</option>
              {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        )}
        <div>
          <label>Einsatzkunde *</label>
          <select value={einsatzkundeId} onChange={(e) => setEinsatzkundeId(e.target.value)}>
            <option value="">– wählen –</option>
            {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      </div>

      <div className="mt-3.5">
        <label>Techniker (mehrere möglich)</label>
        <div className="flex flex-col gap-1.5 border border-line p-2.5 max-h-36 overflow-y-auto bg-white">
          {employees.map((e) => (
            <label key={e.id} className="flex items-center gap-2 text-sm font-normal normal-case">
              <input type="checkbox" className="w-auto" checked={technikerIds.includes(e.id)} onChange={() => toggle(technikerIds, setTechnikerIds, e.id)} />
              {e.name}{!e.aktiv && ' (deaktiviert)'}
            </label>
          ))}
        </div>
      </div>

      <div className="section-title font-semibold text-sm mt-4 mb-1">Referenznummern</div>
      <div className="grid grid-cols-3 gap-3.5 max-sm:grid-cols-1">
        <div><label>Bestellnummer</label><input value={bestellnummer} onChange={(e) => setBestellnummer(e.target.value)} /></div>
        <div><label>Kundenreferenznummer</label><input value={kundenreferenznr} onChange={(e) => setKundenreferenznr(e.target.value)} /></div>
        <div><label>Auftragsnummer Kunde</label><input value={auftragsnrKunde} onChange={(e) => setAuftragsnrKunde(e.target.value)} /></div>
      </div>

      <div className="mt-3.5">
        <label>Maschine(n) beim Einsatzkunden</label>
        <div className="flex flex-col gap-1.5 border border-line p-2.5 max-h-36 overflow-y-auto bg-white">
          {einsatzkundeId === '' ? (
            <div className="text-sm text-ink-soft normal-case">Bitte zuerst Einsatzkunde wählen.</div>
          ) : kundenMachines.length === 0 ? (
            <div className="text-sm text-ink-soft normal-case">Für diesen Kunden sind noch keine Maschinen hinterlegt.</div>
          ) : kundenMachines.map((m) => (
            <label key={m.id} className="flex items-center gap-2 text-sm font-normal normal-case">
              <input type="checkbox" className="w-auto" checked={machineIds.includes(m.id)} onChange={() => toggle(machineIds, setMachineIds, m.id)} />
              {m.bezeichnung} <span className="text-ink-soft text-xs">— {m.hersteller || ''}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="mt-3.5">
        <label>Ansprechpartner</label>
        <select value={ansprechpartnerId} onChange={(e) => setAnsprechpartnerId(e.target.value)}>
          <option value="">– noch nicht bekannt –</option>
          {kundenAnsprechpartner.map((a) => <option key={a.id} value={a.id}>{a.name} ({a.abteilung || '–'})</option>)}
        </select>
      </div>

      <div className="mt-3.5">
        <label>Meldetext</label>
        <textarea rows={3} value={meldetext} onChange={(e) => setMeldetext(e.target.value)} placeholder="Was meldet der Kunde? Oder: 'Fahr hin und schau nach.'" />
      </div>

      <ModalActions>
        <button className="btn btn-amber" disabled={saving} onClick={handleSave}>{editing ? 'Speichern' : 'Auftrag anlegen'}</button>
        <button className="btn btn-outline" onClick={onClose}>Abbrechen</button>
      </ModalActions>
    </Modal>
  )
}
