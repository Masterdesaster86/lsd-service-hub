import { useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import type { Customer, Machine } from '../../lib/types'
import { useConfirm } from '../../components/ui/ConfirmProvider'
import { useToast } from '../../components/ui/Toast'
import { MachineFormModal } from './MachineFormModal'
import { MachineHistorieTab } from './MachineHistorieTab'
import { MachineArbeitenTab } from './MachineArbeitenTab'
import { MachineNotizenTab } from './MachineNotizenTab'
import { MachineBilderTab } from './MachineBilderTab'

type Tab = 'stamm' | 'historie' | 'arbeiten' | 'notizen' | 'bilder'
const TABS: { key: Tab; label: string }[] = [
  { key: 'stamm', label: 'Stammdaten' },
  { key: 'historie', label: 'Serviceberichte' },
  { key: 'arbeiten', label: 'Offene Arbeiten' },
  { key: 'notizen', label: 'Interne Infos' },
  { key: 'bilder', label: 'Bilder' },
]

export function MachineDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const confirm = useConfirm()
  const toast = useToast()

  const [machine, setMachine] = useState<Machine | null>(null)
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [tab, setTab] = useState<Tab>('stamm')
  const [showEdit, setShowEdit] = useState(false)

  async function load() {
    if (!id) return
    const { data: m } = await supabase.from('machines').select('*').eq('id', id).maybeSingle()
    setMachine(m)
    if (m) {
      const { data: c } = await supabase.from('customers').select('*').eq('id', m.kunde_id).maybeSingle()
      setCustomer(c)
    }
  }

  useEffect(() => { load() }, [id])

  if (!machine) return <div className="text-sm text-ink-soft">Lädt…</div>

  const backTo = params.get('from') === 'customer' ? `/kunden/${customer?.id}` : '/maschinen'
  const backLabel = params.get('from') === 'customer' ? `← Zurück zu ${customer?.name || ''}` : '← Zurück zur Maschinenliste'

  async function handleDelete() {
    const ok = await confirm({ message: `Maschine "${machine!.bezeichnung}" wirklich löschen?`, danger: true, confirmLabel: 'Löschen' })
    if (!ok) return
    const { error } = await supabase.from('machines').delete().eq('id', machine!.id)
    if (error) {
      toast(error.code === '23503' ? 'Diese Maschine ist noch in einem Serviceauftrag hinterlegt und kann deshalb nicht gelöscht werden.' : 'Fehler: ' + error.message)
      return
    }
    toast('Maschine gelöscht.')
    navigate(backTo)
  }

  return (
    <div>
      <button className="text-sm text-steel bg-transparent border-none cursor-pointer p-0 mb-4" onClick={() => navigate(backTo)}>{backLabel}</button>

      <div className="card p-4 mb-4">
        <div className="text-lg font-semibold text-amber">{machine.bezeichnung}</div>
        <div className="font-semibold">{machine.hersteller} · Nr. {machine.nummer}</div>
        <div className="text-sm text-ink-soft">Kunde: {customer?.name || '–'}</div>
      </div>

      <div className="flex gap-1 border-b border-line mb-4 flex-wrap">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-3 py-2 text-sm border-b-2 -mb-px ${tab === t.key ? 'border-amber font-semibold' : 'border-transparent text-ink-soft'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'stamm' && (
        <div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-3 max-sm:grid-cols-1">
            <div><label>Bezeichnung</label><div className="val">{machine.bezeichnung}</div></div>
            <div><label>Hersteller</label><div className="val">{machine.hersteller || '–'}</div></div>
            <div><label>Maschinennummer</label><div className="val">{machine.nummer || '–'}</div></div>
            <div><label>Kunden-Maschinennummer</label><div className="val">{machine.kunden_maschinennummer || '–'}</div></div>
            <div><label>Steuerung</label><div className="val">{machine.steuerung || '–'}</div></div>
          </div>
          <div className="flex gap-2 mt-4">
            <button className="btn btn-outline btn-sm" onClick={() => setShowEdit(true)}>Bearbeiten</button>
            <button className="btn btn-danger btn-sm" onClick={handleDelete}>Löschen</button>
          </div>
        </div>
      )}
      {tab === 'historie' && <MachineHistorieTab maschineId={machine.id} />}
      {tab === 'arbeiten' && <MachineArbeitenTab maschineId={machine.id} />}
      {tab === 'notizen' && <MachineNotizenTab maschineId={machine.id} />}
      {tab === 'bilder' && <MachineBilderTab maschineId={machine.id} />}

      {showEdit && <MachineFormModal machine={machine} onClose={() => setShowEdit(false)} onSaved={() => { setShowEdit(false); load() }} />}
    </div>
  )
}
