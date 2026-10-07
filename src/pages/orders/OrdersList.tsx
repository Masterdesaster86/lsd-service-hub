import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../lib/AuthContext'
import { fetchOrders } from '../../lib/queries'
import type { OrderWithRelations } from '../../lib/types'
import { OrderStatusTag } from '../../components/ui/StatusTag'
import { customerAddress, mapsLink } from '../../lib/format'
import { OrderFormModal } from './OrderFormModal'
import { Icon } from '../../components/ui/Icon'
import { WOCHENTAGE, formatDMY } from '../../lib/zeit'

type Tab = 'neu' | 'in Arbeit' | 'erledigt' | 'abgerechnet'

// Büro (Admin, Disposition, CEO) trennt Abgeschlossen und Abgerechnet — die Buchhaltung sieht so,
// was noch zu berechnen ist. Den Techniker geht die Abrechnung nichts an: bei ihm bleibt alles
// Abgeschlossene in einem Reiter, auch wenn es längst abgerechnet ist.
const TABS_BUERO: { key: Tab; label: string }[] = [
  { key: 'neu', label: 'Neu' },
  { key: 'in Arbeit', label: 'In Arbeit' },
  { key: 'erledigt', label: 'Abgeschlossen' },
  { key: 'abgerechnet', label: 'Abgerechnet' },
]
const TABS_TECHNIKER: { key: Tab; label: string }[] = [
  { key: 'neu', label: 'Neu' },
  { key: 'in Arbeit', label: 'In Arbeit' },
  { key: 'erledigt', label: 'Abgeschlossen' },
]

type SortMode = 'einsatz_auf' | 'einsatz_ab' | 'erstellt_ab'

const SORT_OPTIONS: { key: SortMode; label: string }[] = [
  { key: 'einsatz_auf', label: 'Auftragsdatum: nächster Termin zuerst' },
  { key: 'einsatz_ab', label: 'Auftragsdatum: neueste zuerst' },
  { key: 'erstellt_ab', label: 'Zuletzt angelegt' },
]

const SORT_SPEICHER_KEY = 'lsd-auftraege-sortierung'

/** Aufträge ohne Einsatzbeginn (noch nicht terminiert) landen unabhängig von
 * der gewählten Richtung immer ans Ende — "kein Datum" ist weder früh noch
 * spät, sondern offen. */
function vergleicheAuftraege(a: OrderWithRelations, b: OrderWithRelations, sort: SortMode): number {
  if (sort === 'erstellt_ab') return b.created_at.localeCompare(a.created_at)
  if (!a.einsatzbeginn && !b.einsatzbeginn) return 0
  if (!a.einsatzbeginn) return 1
  if (!b.einsatzbeginn) return -1
  const richtung = sort === 'einsatz_auf' ? 1 : -1
  return richtung * a.einsatzbeginn.localeCompare(b.einsatzbeginn)
}

export function OrdersList() {
  const { employee } = useAuth()
  const navigate = useNavigate()
  const [orders, setOrders] = useState<OrderWithRelations[] | null>(null)
  const [tab, setTab] = useState<Tab>('neu')
  const [showNew, setShowNew] = useState(false)
  const [nurMeine, setNurMeine] = useState(false)
  // Merkt sich die zuletzt gewählte Sortierung geräteweise, damit man sie
  // nicht bei jedem Öffnen neu einstellen muss.
  const [sortMode, setSortMode] = useState<SortMode>(() => {
    const gespeichert = localStorage.getItem(SORT_SPEICHER_KEY)
    return SORT_OPTIONS.some((o) => o.key === gespeichert) ? (gespeichert as SortMode) : 'einsatz_auf'
  })
  useEffect(() => { localStorage.setItem(SORT_SPEICHER_KEY, sortMode) }, [sortMode])

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

  const istTechniker = employee?.role === 'Techniker'
  const TABS = istTechniker ? TABS_TECHNIKER : TABS_BUERO
  // Welcher Reiter einen Auftrag zeigt: beim Techniker zählt Abgerechnetes als Abgeschlossen.
  const reiterFuer = (status: string): Tab => (istTechniker && status === 'abgerechnet' ? 'erledigt' : (status as Tab))

  const counts = useMemo(() => {
    const c: Record<Tab, number> = { neu: 0, 'in Arbeit': 0, erledigt: 0, abgerechnet: 0 }
    sichtbar.forEach((o) => { c[reiterFuer(o.status)]++ })
    return c
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sichtbar, istTechniker])

  const filtered = useMemo(() => {
    const liste = sichtbar.filter((o) => reiterFuer(o.status) === tab)
    return [...liste].sort((a, b) => vergleicheAuftraege(a, b, sortMode))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sichtbar, tab, sortMode, istTechniker])

  const roleNote = employee?.role === 'Techniker'
    ? `Gefiltert auf deine eigenen Aufträge (${employee.name})`
    : kannUmschalten && nurMeine
    ? `Nur Aufträge, für die du eingeplant bist (${employee?.name})`
    : `Alle Aufträge sichtbar (Rolle: ${employee?.role})`

  const heute = new Date()
  const heuteText = `${WOCHENTAGE[heute.getDay()]}, ${formatDMY(heute)}`

  return (
    <div>
      <div className="flex items-end justify-between gap-4 flex-wrap mb-4">
        <div>
          <p className="eyebrow">{heuteText}</p>
          <h1>Serviceaufträge</h1>
          <p className="text-sm text-ink-soft mt-1.5 mb-0">{roleNote}</p>
        </div>
        {canCreate && <button className="btn btn-amber max-sm:w-full" onClick={() => setShowNew(true)}><Icon name="hinzufuegen" size={20} /> Neuer Auftrag</button>}
      </div>

      {kannUmschalten && (
        <div className="grid grid-cols-2 gap-0.5 p-0.5 bg-line mb-3 max-w-sm">
          {([[false, 'Alle Aufträge'], [true, 'Nur meine']] as const).map(([wert, label]) => (
            <button
              key={label}
              onClick={() => setNurMeine(wert)}
              className={`min-h-[44px] border-0 cursor-pointer font-mono text-[12px] font-semibold uppercase tracking-[0.04em] ${nurMeine === wert ? 'bg-ink text-paper' : 'bg-white text-ink'}`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      <div role="tablist" className={`grid ${TABS.length === 4 ? 'grid-cols-4' : 'grid-cols-3'} border-b border-line mb-3`}>
        {TABS.map((t) => {
          const aktiv = tab === t.key
          return (
            <button
              key={t.key}
              role="tab"
              aria-selected={aktiv}
              onClick={() => setTab(t.key)}
              className={`min-h-[52px] px-1 border-0 border-b-[3px] -mb-px bg-transparent cursor-pointer font-mono text-[12.5px] font-semibold uppercase tracking-[0.05em] ${aktiv ? 'border-ink text-ink' : 'border-transparent text-ink-soft'}`}
            >
              {t.label} <span className="font-normal">{counts[t.key]}</span>
            </button>
          )
        })}
      </div>

      <div className="flex items-center gap-3 mb-4">
        <label className="!mb-0 shrink-0" htmlFor="sortierung">Sortierung</label>
        <select id="sortierung" className="sm:max-w-[300px]" value={sortMode} onChange={(e) => setSortMode(e.target.value as SortMode)}>
          {SORT_OPTIONS.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
        </select>
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
              className="card p-4 cursor-pointer hover:border-ink transition-colors"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="font-mono text-[14px] font-semibold">
                  #{o.id}
                  {o.einsatzbeginn && <span className="font-normal text-ink-soft"> · {o.einsatzbeginn.split('-').reverse().join('.')}</span>}
                </span>
                <OrderStatusTag status={istTechniker && o.status === 'abgerechnet' ? 'erledigt' : o.status} />
              </div>
              <div className="font-semibold text-[17px] leading-snug mt-2">{o.einsatzkunde?.name || '–'}</div>
              {o.machines.length > 0 && (
                <div className="font-mono text-[12.5px] text-ink-soft mt-1">{o.machines.map((m) => m.bezeichnung).join(' · ')}</div>
              )}
              <a
                href={mapsLink(customerAddress(o.einsatzkunde))}
                target="_blank"
                rel="noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center gap-1.5 text-ink no-underline text-[14px] mt-2"
              >
                <Icon name="standort" size={18} /> <span className="underline underline-offset-[3px] decoration-line">{customerAddress(o.einsatzkunde)}</span>
              </a>
              <div className="text-[13px] text-ink-soft mt-1.5">
                Auftraggeber: {o.auftraggeber?.name || '–'} · Techniker: {o.techniker.length ? o.techniker.map((t) => t.name).join(', ') : '– nicht zugewiesen –'}
              </div>
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
