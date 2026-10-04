import { useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/AuthContext'
import { darfStammdatenAendern } from '../../lib/rechte'
import type { Customer, Machine } from '../../lib/types'
import { useConfirm } from '../../components/ui/ConfirmProvider'
import { useToast } from '../../components/ui/Toast'
import { MachineFormModal } from './MachineFormModal'
import { MachineHistorieTab } from './MachineHistorieTab'
import { MachineArbeitenTab } from './MachineArbeitenTab'
import { MachineNotizenTab } from './MachineNotizenTab'
import { MachineBilderTab } from './MachineBilderTab'
import { Icon } from '../../components/ui/Icon'
import { Typenschild } from '../../components/ui/Typenschild'

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
  const { employee } = useAuth()
  const darfAendern = darfStammdatenAendern(employee)

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
  const backLabel = params.get('from') === 'customer' ? (customer?.name || 'Kunde') : 'Maschinen'

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
      <button className="btn btn-outline btn-sm mb-4" onClick={() => navigate(backTo)}><Icon name="zurueck" size={18} /> {backLabel}</button>

      <p className="eyebrow">Maschine</p>
      <h1 className="font-mono">{machine.bezeichnung}</h1>
      <div className="font-mono text-[13px] text-ink-soft mt-1.5">{machine.hersteller || '–'} · Nr. {machine.nummer || '–'}{machine.steuerung ? ` · ${machine.steuerung}` : ''}</div>
      {customer && (
        <button className="bg-transparent border-0 p-0 mt-1 text-steel text-[15px] font-semibold cursor-pointer text-left" onClick={() => navigate(`/kunden/${customer.id}`)}>{customer.name}</button>
      )}

      <div role="tablist" className="flex overflow-x-auto border-b border-line mt-5 mb-4 -mx-4 px-4 md:mx-0 md:px-0">
        {TABS.map((t) => {
          const aktiv = tab === t.key
          return (
            <button
              key={t.key}
              role="tab"
              aria-selected={aktiv}
              onClick={() => setTab(t.key)}
              className={`shrink-0 min-h-[48px] px-3.5 border-0 border-b-[3px] -mb-px bg-transparent cursor-pointer font-mono text-[12px] font-semibold uppercase tracking-[0.05em] whitespace-nowrap ${aktiv ? 'border-ink text-ink' : 'border-transparent text-ink-soft'}`}
            >
              {t.label}
            </button>
          )
        })}
      </div>

      {tab === 'stamm' && (
        <div>
          <Typenschild
            titel="Typenschild"
            zeilen={[
              ['Bezeichnung', <span className="font-mono">{machine.bezeichnung}</span>],
              ['Hersteller', machine.hersteller || '–'],
              ['Maschinennr.', <span className="font-mono">{machine.nummer || '–'}</span>],
              ['Kunden-Nr.', <span className="font-mono">{machine.kunden_maschinennummer || '–'}</span>],
              ['Steuerung', machine.steuerung || '–'],
              ['Kunde', customer?.name || '–'],
            ]}
          />
          {darfAendern && (
            <div className="grid grid-cols-2 gap-2 mt-3 sm:max-w-md">
              <button className="btn btn-outline btn-sm" onClick={() => setShowEdit(true)}><Icon name="bearbeiten" size={16} /> Bearbeiten</button>
              <button className="btn btn-danger btn-sm" onClick={handleDelete}><Icon name="loeschen" size={16} /> Löschen</button>
            </div>
          )}
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
