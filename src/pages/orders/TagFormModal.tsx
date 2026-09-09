import { useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { Modal, ModalActions, ModalTitle } from '../../components/ui/Modal'
import { TimeSelect } from '../../components/ui/TimeSelect'
import { useToast } from '../../components/ui/Toast'
import { calcDay, istSamstag, istSonnOderFeiertag, formatISO } from '../../lib/zeit'
import type { ServiceberichtTag } from '../../lib/types'

export function TagFormModal({ berichtId, onClose, onSaved }: { berichtId: string; onClose: () => void; onSaved: () => void }) {
  const toast = useToast()
  const [datum, setDatum] = useState(formatISO(new Date()))
  const [hinreiseVon, setHinreiseVon] = useState('07:00')
  const [kmHin, setKmHin] = useState('')
  const [arbeitsbeginn, setArbeitsbeginn] = useState('09:00')
  const [arbeitsende, setArbeitsende] = useState('17:00')
  const [rueBekannt, setRueBekannt] = useState(true)
  const [rueckreiseBis, setRueckreiseBis] = useState('19:00')
  const [kmRueck, setKmRueck] = useState('')
  const [pauseAn, setPauseAn] = useState(false)
  const [pauseVon, setPauseVon] = useState('12:00')
  const [pauseBis, setPauseBis] = useState('12:30')
  const [uebernachtung, setUebernachtung] = useState(false)
  const [hotelkosten, setHotelkosten] = useState('')
  const [saving, setSaving] = useState(false)

  const draft: ServiceberichtTag = useMemo(() => ({
    id: '', servicebericht_id: berichtId,
    datum,
    hinreise_von: hinreiseVon || null,
    km_hin: kmHin ? parseInt(kmHin) : null,
    arbeitsbeginn: arbeitsbeginn || null,
    arbeitsende: arbeitsende || null,
    rueckreise_bis: rueBekannt ? rueckreiseBis : null,
    km_rueck: rueBekannt && kmRueck ? parseInt(kmRueck) : null,
    pause_von: pauseAn ? pauseVon : null,
    pause_bis: pauseAn ? pauseBis : null,
    uebernachtung,
    hotelkosten: uebernachtung && hotelkosten ? parseFloat(hotelkosten) : null,
  }), [berichtId, datum, hinreiseVon, kmHin, arbeitsbeginn, arbeitsende, rueBekannt, rueckreiseBis, kmRueck, pauseAn, pauseVon, pauseBis, uebernachtung, hotelkosten])

  const d = calcDay(draft)
  const feiertag = istSonnOderFeiertag(datum)
  const samstag = istSamstag(datum)

  async function handleSave() {
    setSaving(true)
    const { error } = await supabase.from('servicebericht_tage').insert({
      servicebericht_id: berichtId,
      datum: draft.datum,
      hinreise_von: draft.hinreise_von,
      km_hin: draft.km_hin,
      arbeitsbeginn: draft.arbeitsbeginn,
      arbeitsende: draft.arbeitsende,
      rueckreise_bis: draft.rueckreise_bis,
      km_rueck: draft.km_rueck,
      pause_von: draft.pause_von,
      pause_bis: draft.pause_bis,
      uebernachtung: draft.uebernachtung,
      hotelkosten: draft.hotelkosten,
    })
    setSaving(false)
    if (error) { toast('Fehler: ' + error.message); return }
    toast('Tag gespeichert.')
    onSaved()
  }

  return (
    <Modal onClose={onClose} width={600}>
      <ModalTitle>Tag erfassen</ModalTitle>
      <p className="text-sm text-ink-soft -mt-3 mb-4">Zeiten im 15-Minuten-Raster</p>

      <div className="mb-3.5"><label>Datum</label><input type="date" value={datum} onChange={(e) => setDatum(e.target.value)} /></div>

      <div className="grid grid-cols-2 gap-3.5 max-sm:grid-cols-1">
        <div><label>Hinreise — Beginn</label><TimeSelect value={hinreiseVon} onChange={setHinreiseVon} /></div>
        <div><label>Kilometer Hinreise</label><input type="number" min={0} value={kmHin} onChange={(e) => setKmHin(e.target.value)} placeholder="z.B. 60" /></div>
        <div><label>Ankunft / Arbeitsbeginn</label><TimeSelect value={arbeitsbeginn} onChange={setArbeitsbeginn} /></div>
        <div><label>Arbeitsende / Rückreise-Beginn</label><TimeSelect value={arbeitsende} onChange={setArbeitsende} /></div>
      </div>

      <SectionToggle title="Rückreise" checked={rueBekannt} onChange={setRueBekannt} checkboxLabel="Rückreise-Ende bereits bekannt" />
      {rueBekannt ? (
        <div className="grid grid-cols-2 gap-3.5 max-sm:grid-cols-1">
          <div><label>Rückreise — Ende</label><TimeSelect value={rueckreiseBis} onChange={setRueckreiseBis} /></div>
          <div><label>Kilometer Rückreise</label><input type="number" min={0} value={kmRueck} onChange={(e) => setKmRueck(e.target.value)} placeholder="z.B. 60" /></div>
        </div>
      ) : (
        <p className="text-sm text-ink-soft -mt-1">Kannst du später über "Rückreise nachtragen" im Bericht ergänzen — auch noch nach dem Abschließen, falls du bis dahin noch nicht zuhause bist.</p>
      )}

      <SectionToggle title="Pause" checked={pauseAn} onChange={setPauseAn} checkboxLabel="Pause eingetragen" />
      {pauseAn && (
        <div className="grid grid-cols-2 gap-3.5 max-sm:grid-cols-1">
          <div><label>Von</label><TimeSelect value={pauseVon} onChange={setPauseVon} /></div>
          <div><label>Bis</label><TimeSelect value={pauseBis} onChange={setPauseBis} /></div>
        </div>
      )}

      <SectionToggle title="Übernachtung" checked={uebernachtung} onChange={setUebernachtung} checkboxLabel="Übernachtung an diesem Tag" />
      {uebernachtung && (
        <div><label>Hotelkosten (€)</label><input type="number" min={0} step="0.01" value={hotelkosten} onChange={(e) => setHotelkosten(e.target.value)} placeholder="z.B. 89.00" /></div>
      )}

      <div className="mt-4 border border-line bg-paper-2 p-3 grid grid-cols-2 gap-2 text-sm">
        {feiertag ? (
          <>
            <Calc label="Arbeit +100% (Sonn-/Feiertag)" value={d.arbeitZuschlag100} />
            <Calc label="Reise +100% (Sonn-/Feiertag)" value={d.reiseZuschlag100} />
            <Calc label="Gesamt" value={d.gesamt} />
          </>
        ) : samstag ? (
          <>
            <Calc label="Arbeit +50% (Samstag)" value={d.arbeitZuschlag50} />
            <Calc label="Reise +50% (Samstag)" value={d.reiseZuschlag50} />
            <Calc label="Gesamt" value={d.gesamt} />
          </>
        ) : (
          <>
            <Calc label="Arbeit normal" value={d.arbeitNormal} />
            <Calc label="Arbeit +50%" value={d.arbeitZuschlag50} />
            <Calc label="Reise normal" value={d.reiseNormal} />
            <Calc label="Reise +50%" value={d.reiseZuschlag50} />
            <Calc label="Gesamt (nach der 10h-Schwelle)" value={d.gesamt} />
          </>
        )}
      </div>

      <ModalActions>
        <button className="btn btn-amber" disabled={saving} onClick={handleSave}>Speichern</button>
        <button className="btn btn-outline" onClick={onClose}>Abbrechen</button>
      </ModalActions>
    </Modal>
  )
}

function SectionToggle({ title, checked, onChange, checkboxLabel }: { title: string; checked: boolean; onChange: (v: boolean) => void; checkboxLabel: string }) {
  return (
    <div className="flex items-center justify-between mt-5 mb-1">
      <div className="font-semibold text-sm uppercase tracking-wide text-ink-soft">{title}</div>
      <label className="check-inline">
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} /> {checkboxLabel}
      </label>
    </div>
  )
}

function Calc({ label, value }: { label: string; value: number }) {
  return <div><b>{value} h</b> {label}</div>
}
