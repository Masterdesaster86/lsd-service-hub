import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/AuthContext'
import type { Machine, OrderWithRelations } from '../../lib/types'
import { Modal, ModalActions, ModalTitle } from '../../components/ui/Modal'
import { useToast } from '../../components/ui/Toast'
import { MachineFormModal } from '../machines/MachineFormModal'

export function NewBerichtModal({ order, onClose, onCreated }: { order: OrderWithRelations; onClose: () => void; onCreated: (id: string) => void }) {
  const { employee } = useAuth()
  const toast = useToast()
  const [machines, setMachines] = useState<Machine[] | null>(null)
  const [maschineId, setMaschineId] = useState('')
  const [busy, setBusy] = useState(false)
  // Bei manchen Kunden steht erst vor Ort fest, an welcher Maschine gearbeitet
  // wird. Deshalb laesst sie sich hier direkt anlegen.
  const [showNeueMaschine, setShowNeueMaschine] = useState(false)

  async function ladeMaschinen(auswaehlen?: string) {
    if (!order.einsatzkunde_id) { setMachines([]); return }
    const { data } = await supabase.from('machines').select('*').eq('kunde_id', order.einsatzkunde_id).order('bezeichnung')
    setMachines(data || [])
    if (auswaehlen) setMaschineId(auswaehlen)
  }

  useEffect(() => {
    ladeMaschinen()
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        <div className="text-sm text-ink-soft border border-dashed border-line p-4 text-center">
          Für diesen Kunden sind noch keine Maschinen hinterlegt.
        </div>
      ) : (
        <div className="border border-line px-2.5 bg-white">
          {machines.map((m) => (
            <label key={m.id} className="check-row check-row-multi">
              <input type="radio" name="berichtMa" className="mt-1" checked={maschineId === m.id} onChange={() => setMaschineId(m.id)} />
              <span>
                <span className="font-semibold">{m.bezeichnung}</span><br />
                <span className="check-row-note">Maschinennr. {m.nummer || '–'}</span><br />
                <span className="check-row-note">Kunden-Maschinennr. {m.kunden_maschinennummer || '–'}</span>
              </span>
            </label>
          ))}
        </div>
      )}

      {order.einsatzkunde_id && (
        <button className="btn btn-outline btn-sm mt-3" onClick={() => setShowNeueMaschine(true)}>
          + Maschine ist nicht dabei
        </button>
      )}

      <ModalActions>
        <button className="btn btn-amber" disabled={busy || !maschineId} onClick={handleConfirm}>Weiter</button>
        <button className="btn btn-outline" onClick={onClose}>Abbrechen</button>
      </ModalActions>

      {showNeueMaschine && (
        <MachineFormModal
          kundeId={order.einsatzkunde_id!}
          kundeName={order.einsatzkunde?.name}
          onClose={() => setShowNeueMaschine(false)}
          onSaved={(id) => { setShowNeueMaschine(false); ladeMaschinen(id) }}
        />
      )}
    </Modal>
  )
}
