import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/AuthContext'
import { useToast } from '../../components/ui/Toast'
import { Modal, ModalActions, ModalTitle } from '../../components/ui/Modal'
import type { MachineArbeit } from '../../lib/types'

interface ArbeitRow extends MachineArbeit {
  erstellt_von_emp: { name: string } | null
  abgeschlossen_von_emp: { name: string } | null
}

export function MachineArbeitenTab({ maschineId }: { maschineId: string }) {
  const { employee } = useAuth()
  const toast = useToast()
  const [rows, setRows] = useState<ArbeitRow[] | null>(null)
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [closing, setClosing] = useState<ArbeitRow | null>(null)

  async function load() {
    const { data } = await supabase
      .from('machine_arbeiten')
      .select('*, erstellt_von_emp:employees!machine_arbeiten_erstellt_von_fkey(name), abgeschlossen_von_emp:employees!machine_arbeiten_abgeschlossen_von_fkey(name)')
      .eq('maschine_id', maschineId)
      .order('erstellt_am', { ascending: false })
    setRows((data as unknown as ArbeitRow[]) || [])
  }

  useEffect(() => { load() }, [maschineId])

  async function handleAdd() {
    const text = draft.trim()
    if (!text || !employee) return
    setSaving(true)
    const { error } = await supabase.from('machine_arbeiten').insert({ maschine_id: maschineId, text, erstellt_von: employee.id })
    setSaving(false)
    if (error) { toast('Fehler: ' + error.message); return }
    setDraft('')
    toast('Offene Arbeit eingetragen.')
    load()
  }

  const offen = (rows || []).filter((a) => a.status === 'offen')
  const erledigt = (rows || []).filter((a) => a.status === 'abgeschlossen')

  return (
    <div>
      <label>Neue offene Arbeit</label>
      <textarea rows={3} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="z.B. Encoder-Kabel im Auge behalten, beim nächsten Termin prüfen ..." />
      <button className="btn btn-outline btn-sm mt-2" disabled={saving} onClick={handleAdd}>Eintragen</button>

      <div className="font-semibold text-sm uppercase tracking-wide text-ink-soft mt-6 mb-1.5">Offen ({offen.length})</div>
      {rows === null ? <div className="text-sm text-ink-soft">Lädt…</div> : offen.length === 0 ? (
        <div className="text-sm text-ink-soft border border-dashed border-line p-4 text-center">Keine offenen Arbeiten.</div>
      ) : (
        <div className="flex flex-col gap-1.5">
          {offen.map((a) => (
            <div key={a.id} className="card p-3 flex items-center justify-between gap-3 flex-wrap">
              <div>
                <div className="font-semibold text-sm">{a.text}</div>
                <div className="text-[13px] text-ink-soft">Eingetragen am {new Date(a.erstellt_am).toLocaleDateString('de-DE')} von {a.erstellt_von_emp?.name || '–'}</div>
              </div>
              <button className="btn btn-amber btn-sm" onClick={() => setClosing(a)}>Abschließen</button>
            </div>
          ))}
        </div>
      )}

      <div className="font-semibold text-sm uppercase tracking-wide text-ink-soft mt-6 mb-1.5">Abgeschlossen ({erledigt.length})</div>
      {erledigt.length === 0 ? (
        <div className="text-sm text-ink-soft border border-dashed border-line p-4 text-center">Noch keine abgeschlossenen Arbeiten.</div>
      ) : (
        <div className="flex flex-col gap-1.5">
          {erledigt.map((a) => (
            <div key={a.id} className="card p-3 flex items-center justify-between gap-3 flex-wrap">
              <div>
                <div className="font-semibold text-sm text-ink-soft line-through">{a.text}</div>
                <div className="text-[13px] text-ink-soft">Erledigt am {a.abgeschlossen_am ? new Date(a.abgeschlossen_am).toLocaleDateString('de-DE') : '–'} von {a.abgeschlossen_von_emp?.name || '–'}: {a.abschluss_text}</div>
              </div>
              <span className="tag tag-arbeit">Abgeschlossen</span>
            </div>
          ))}
        </div>
      )}

      {closing && (
        <ArbeitAbschliessenModal
          arbeit={closing}
          onClose={() => setClosing(null)}
          onSaved={() => { setClosing(null); load() }}
        />
      )}
    </div>
  )
}

function ArbeitAbschliessenModal({ arbeit, onClose, onSaved }: { arbeit: ArbeitRow; onClose: () => void; onSaved: () => void }) {
  const { employee } = useAuth()
  const toast = useToast()
  const [text, setText] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    if (!text.trim()) { toast('Bitte eintragen, was gemacht wurde.'); return }
    if (!employee) return
    setSaving(true)
    const { error } = await supabase.from('machine_arbeiten').update({
      status: 'abgeschlossen',
      abschluss_text: text.trim(),
      abgeschlossen_am: new Date().toISOString(),
      abgeschlossen_von: employee.id,
    }).eq('id', arbeit.id)
    setSaving(false)
    if (error) { toast('Fehler: ' + error.message); return }
    toast('Arbeit abgeschlossen.')
    onSaved()
  }

  return (
    <Modal onClose={onClose}>
      <ModalTitle>Arbeit abschließen</ModalTitle>
      <p className="text-sm text-ink-soft -mt-3 mb-4">{arbeit.text}</p>
      <label>Was wurde gemacht?</label>
      <textarea rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder="z.B. Kabel getauscht, Fehler tritt nicht mehr auf." />
      <ModalActions>
        <button className="btn btn-amber" disabled={saving} onClick={handleSave}>Abschließen</button>
        <button className="btn btn-outline" onClick={onClose}>Abbrechen</button>
      </ModalActions>
    </Modal>
  )
}
