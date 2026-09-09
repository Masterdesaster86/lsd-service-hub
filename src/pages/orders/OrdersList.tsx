import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../lib/AuthContext'
import { fetchOrders } from '../../lib/queries'
import type { OrderWithRelations } from '../../lib/types'
import { OrderStatusTag } from '../../components/ui/StatusTag'
import { customerAddress, mapsLink } from '../../lib/format'
import { OrderFormModal } from './OrderFormModal'

type Tab = 'neu' | 'in Arbeit' | 'erledigt'

const TABS: { key: Tab; label: string }[] = [
  { key: 'neu', label: 'Neue Aufträge' },
  { key: 'in Arbeit', label: 'In Arbeit' },
  { key: 'erledigt', label: 'Erledigt / Abgerechnet' },
]

export function OrdersList() {
  const { employee } = useAuth()
  const navigate = useNavigate()
  const [orders, setOrders] = useState<OrderWithRelations[] | null>(null)
  const [tab, setTab] = useState<Tab>('neu')
  const [showNew, setShowNew] = useState(false)
  const [nurMeine, setNurMeine] = useState(false)

  async function load() {
    setOrders(await fetchOrders())
  }

  useEffect(() => { load() }, [])

  const canCreate = employee?.role === 'Administrator' || employee?.role === 'Disposition' || employee?.role === 'CEO'

  // Wer alle Aufträge sieht, aber selbst eingeplant werden kann (CEO), kann
  // zwischen "alle" und "nur meine" umschalten.
  const kannUmschalten = employee?.role === 'CEO'
  const sichtbar = useMemo(() => {
    const list = orders || []
    if (!kannUmschalten || nurMeine === false) return list
    return list.filter((o) => o.techniker.some((t) => t.id === employee?.id))
  }, [orders, kannUmschalten, nurMeine, employee?.id])

  const counts = useMemo(() => ({
    neu: sichtbar.filter((o) => o.status === 'neu').length,
    'in Arbeit': sichtbar.filter((o) => o.status === 'in Arbeit').length,
    erledigt: sichtbar.filter((o) => o.status === 'erledigt' || o.status === 'abgerechnet').length,
  }), [sichtbar])

  const filtered = useMemo(() => {
    if (tab === 'erledigt') return sichtbar.filter((o) => o.status === 'erledigt' || o.status === 'abgerechnet')
    return sichtbar.filter((o) => o.status === tab)
  }, [sichtbar, tab])

  const roleNote = employee?.role === 'Techniker'
    ? `Gefiltert auf deine eigenen Aufträge (${employee.name})`
    : kannUmschalten && nurMeine
    ? `Nur Aufträge, für die du eingeplant bist (${employee?.name})`
    : `Alle Aufträge sichtbar (Rolle: ${employee?.role})`

  return (
    <div>
      <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
        <div>
          <h1 className="text-xl font-semibold m-0">Serviceaufträge</h1>
          <p className="text-sm text-ink-soft mt-1">{roleNote}</p>
        </div>
        {canCreate && <button className="btn btn-amber" onClick={() => setShowNew(true)}>+ Neuer Auftrag</button>}
      </div>

      {kannUmschalten && (
        <div className="flex gap-1.5 mb-3 flex-wrap">
          <button className={`btn btn-sm ${!nurMeine ? 'btn-dark' : 'btn-outline'}`} onClick={() => setNurMeine(false)}>Alle Aufträge</button>
          <button className={`btn btn-sm ${nurMeine ? 'btn-dark' : 'btn-outline'}`} onClick={() => setNurMeine(true)}>Nur meine</button>
        </div>
      )}

      <div className="flex gap-2 mb-4 flex-wrap">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`btn btn-sm ${tab === t.key ? 'btn-dark' : 'btn-outline'}`}
          >
            {t.label} ({counts[t.key]})
          </button>
        ))}
      </div>

      {orders === null ? (
        <div className="text-sm text-ink-soft">Lädt…</div>
      ) : filtered.length === 0 ? (
        <div className="text-sm text-ink-soft border border-dashed border-line p-6 text-center">Keine Aufträge in dieser Ansicht.</div>
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map((o) => (
            <div
              key={o.id}
              onClick={() => navigate(`/auftraege/${o.id}`)}
              className="card p-4 cursor-pointer hover:border-amber transition-colors flex items-start gap-4 flex-wrap"
            >
              <div className="font-mono text-sm font-semibold min-w-[110px]">
                #{o.id}
                {o.einsatzbeginn && <div className="font-sans font-normal text-[11.5px] text-ink-soft mt-0.5">ab {o.einsatzbeginn.split('-').reverse().join('.')}</div>}
              </div>
              <div className="flex-1 min-w-[220px]">
                <div className="font-semibold">{o.einsatzkunde?.name || '–'}</div>
                <a
                  href={mapsLink(customerAddress(o.einsatzkunde))}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="text-steel no-underline text-[13px]"
                >
                  📍 {customerAddress(o.einsatzkunde)}
                </a>
                <div className="text-[13px] text-ink-soft">
                  Auftraggeber: {o.auftraggeber?.name || '–'} · Techniker: {o.techniker.length ? o.techniker.map((t) => t.name).join(', ') : '– nicht zugewiesen –'}
                </div>
                {o.machines.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {o.machines.map((m) => (
                      <span key={m.id} className="text-[11px] bg-paper-2 border border-line px-2 py-0.5">{m.bezeichnung}</span>
                    ))}
                  </div>
                )}
              </div>
              <OrderStatusTag status={o.status} />
            </div>
          ))}
        </div>
      )}

      {showNew && (
        <OrderFormModal
          onClose={() => setShowNew(false)}
          onSaved={(id) => { setShowNew(false); load(); navigate(`/auftraege/${id}`) }}
        />
      )}
    </div>
  )
}
