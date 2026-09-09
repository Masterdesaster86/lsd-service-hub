import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/AuthContext'
import type { Machine, OrderWithRelations } from '../../lib/types'
import { Modal, ModalActions, ModalTitle } from '../../components/ui/Modal'
import { useToast } from '../../components/ui/Toast'

export function NewBerichtModal({ order, onClose, onCreated }: { order: OrderWithRelations; onClose: () => void; onCreated: (id: string) => void }) {
  const { employee } = useAuth()
  const toast = useToast()
  const [machines, setMachines] = useState<Machine[] | null>(null)
  const [maschineId, setMaschineId] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!order.einsatzkunde_id) { setMachines([]); return }
    supabase.from('machines').select('*').eq('kunde_id', order.einsatzkunde_id).order('bezeichnung').then(({ data }) => setMachines(data || []))
  }, [order.einsatzkunde_id])

  async function handleConfirm() {
    if (!maschineId) { toast('Bitte eine Maschine auswählen.'); return }
    if (!employee) return
    setBusy(true)
    // Gibt es schon einen offenen Bericht von mir zu dieser Maschine? Dann wieder öffnen.
    const { data: existing } = await supabase
      .from('serviceberichte')
      .select('id')
      .eq('auftrag_id', order.id)
      .eq('maschine_id', maschineId)
      .eq('techniker_id', employee.id)
      .eq('status', 'offen')
      .maybeSingle()

    if (existing) {
      onCreated(existing.id)
      return
    }

    const { data, error } = await supabase
      .from('serviceberichte')
      .insert({ auftrag_id: order.id, maschine_id: maschineId, techniker_id: employee.id })
      .select('id')
      .single()

    setBusy(false)
    if (error || !data) { toast('Fehler beim Anlegen: ' + error?.message); return }
    onCreated(data.id)
  }

  return (
    <Modal onClose={onClose}>
      <ModalTitle>Servicebericht anlegen — Auftrag #{order.id}</ModalTitle>
      <p className="text-sm text-ink-soft -mt-3 mb-4">Für welche Maschine? Gibt es für dich schon einen offenen Bericht zu dieser Maschine, wird der wieder geöffnet.</p>

      {machines === null ? (
        <div className="text-sm text-ink-soft">Lädt…</div>
      ) : machines.length === 0 ? (
        <div className="text-sm text-ink-soft border border-dashed border-line p-4 text-center">Für diesen Kunden sind noch keine Maschinen hinterlegt.</div>
      ) : (
        <div className="flex flex-col gap-1.5 border border-line p-2.5 bg-white">
          {machines.map((m) => (
            <label key={m.id} className="flex items-start gap-2 text-sm font-normal normal-case cursor-pointer">
              <input type="radio" name="berichtMa" className="w-auto mt-1" checked={maschineId === m.id} onChange={() => setMaschineId(m.id)} />
              <span>
                <span className="font-semibold">{m.bezeichnung}</span><br />
                <span className="text-ink-soft text-xs">Maschinennr. {m.nummer || '–'} · Kunden-Maschinennr. {m.kunden_maschinennummer || '–'}</span>
              </span>
            </label>
          ))}
        </div>
      )}

      <ModalActions>
        <button className="btn btn-amber" disabled={busy || !machines?.length} onClick={handleConfirm}>Weiter</button>
        <button className="btn btn-outline" onClick={onClose}>Abbrechen</button>
      </ModalActions>
    </Modal>
  )
}
