import { Fragment, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { fetchOrders } from '../../lib/queries'
import type { Abwesenheit, Employee, OrderWithRelations, Urlaubsantrag } from '../../lib/types'
import { OrderStatusTag } from '../../components/ui/StatusTag'
import { useToast } from '../../components/ui/Toast'
import { useConfirm } from '../../components/ui/ConfirmProvider'
import { useAuth } from '../../lib/AuthContext'
import { WOCHENTAGE, addDays, formatDMY, parseISO } from '../../lib/zeit'
import { formatDateDE } from '../../lib/format'
import { AbwesenheitFormModal } from './AbwesenheitFormModal'

const zeitraum = (von: string, bis: string) => (von === bis ? formatDateDE(von) : `${formatDateDE(von)} – ${formatDateDE(bis)}`)

const MONATSNAMEN = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez']

function mondayOfWeek(d: Date): Date {
  const midnight = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const day = midnight.getDay()
  const diff = day === 0 ? -6 : 1 - day
  return addDays(midnight, diff)
}

function orderCoversDate(o: OrderWithRelations, d: Date): boolean {
  if (!o.einsatzbeginn) return false
  const start = parseISO(o.einsatzbeginn)
  if (!start) return false
  const ende = addDays(start, (o.dauer_tage || 1) - 1)
  return d >= start && d <= ende
}

function abwesenheitUeberschneidetMonat(a: Abwesenheit, jahr: number, monat: number): boolean {
  const von = parseISO(a.von), bis = parseISO(a.bis)
  if (!von || !bis) return false
  const monatsStart = new Date(jahr, monat, 1), monatsEnde = new Date(jahr, monat + 1, 0)
  return von <= monatsEnde && bis >= monatsStart
}

interface DragData { orderId: string; fromTech: string; fromDate: string }
type ViewMode = 'woche' | 'monat' | 'jahr'

export function Plantafel() {
  const navigate = useNavigate()
  const toast = useToast()
  const confirm = useConfirm()
  const { employee } = useAuth()

  const darfAbwesenheitenPflegen = employee?.role === 'CEO' || employee?.role === 'Disposition' || employee?.role === 'Administrator'
  const [abwesenheitForm, setAbwesenheitForm] = useState<{ open: boolean; eintrag?: Abwesenheit }>({ open: false })
  const [viewMode, setViewMode] = useState<ViewMode>('woche')
  const [weekStart, setWeekStart] = useState(() => mondayOfWeek(new Date()))
  const [monthAnchor, setMonthAnchor] = useState(() => { const d = new Date(); d.setDate(1); return d })
  const [technicians, setTechnicians] = useState<Employee[]>([])
  const [orders, setOrders] = useState<OrderWithRelations[]>([])
  const [abwesenheiten, setAbwesenheiten] = useState<Abwesenheit[]>([])
  const [antraege, setAntraege] = useState<Urlaubsantrag[]>([])
  const [employeesById, setEmployeesById] = useState<Record<string, Employee>>({})
  const [drag, setDrag] = useState<DragData | null>(null)

  async function load() {
    const [{ data: emp }, all, { data: abw }, { data: ant }] = await Promise.all([
      supabase.from('employees').select('*').in('role', ['Techniker', 'CEO']).eq('aktiv', true).order('name'),
      fetchOrders(),
      supabase.from('abwesenheiten').select('*'),
      supabase.from('urlaubsantraege').select('*').eq('status', 'beantragt'),
    ])
    setTechnicians(emp || [])
    setOrders(all.filter((o) => o.status !== 'erledigt' && o.status !== 'abgerechnet'))
    setAbwesenheiten(abw || [])
    setAntraege(ant || [])
    const { data: allEmp } = await supabase.from('employees').select('*')
    setEmployeesById(Object.fromEntries((allEmp || []).map((e) => [e.id, e])))
  }

  useEffect(() => { load() }, [])

  const weekDates = useMemo(() => [0, 1, 2, 3, 4, 5, 6].map((i) => addDays(weekStart, i)), [weekStart])
  const monthDates = useMemo(() => {
    const jahr = monthAnchor.getFullYear(), monat = monthAnchor.getMonth()
    const tageImMonat = new Date(jahr, monat + 1, 0).getDate()
    return Array.from({ length: tageImMonat }, (_, i) => new Date(jahr, monat, i + 1))
  }, [monthAnchor])
  const poolOrders = orders.filter((o) => o.techniker.length === 0)

  const bevorstehendeAbwesenheiten = useMemo(() => {
    const heute = new Date(); heute.setHours(0, 0, 0, 0)
    return abwesenheiten
      .map((a) => ({ a, von: parseISO(a.von), bis: parseISO(a.bis) }))
      .filter(({ bis }) => bis && bis >= heute)
      .sort((x, y) => (x.von && y.von ? x.von.getTime() - y.von.getTime() : 0))
      .map(({ a }) => a)
  }, [abwesenheiten])

  function abwesenheitFuer(techId: string, d: Date) {
    return abwesenheiten.find((a) => techId === a.techniker_id && d >= parseISO(a.von)! && d <= parseISO(a.bis)!)
  }

  async function applyDrop(techId: string, dateStr: string) {
    if (!drag) return
    const order = orders.find((o) => o.id === drag.orderId)
    if (!order) return

    if (drag.fromTech) {
      await supabase.from('order_techniker').delete().eq('order_id', order.id).eq('techniker_id', drag.fromTech)
    }
    if (techId) {
      if (!order.techniker.some((t) => t.id === techId)) {
        await supabase.from('order_techniker').insert({ order_id: order.id, techniker_id: techId })
      }
      await supabase.from('orders').update({ einsatzbeginn: isoFromDMY(dateStr) }).eq('id', order.id)
      toast(`Auftrag #${order.id} eingeplant: ${employeesById[techId]?.name || ''}, ${dateStr}.`)
    } else {
      toast(`Auftrag #${order.id} zurück in den Pool gelegt.`)
    }
    setDrag(null)
    load()
  }

  function isoFromDMY(dmy: string) {
    const [d, m, y] = dmy.split('.')
    return `${y}-${m}-${d}`
  }

  async function genehmigen(a: Urlaubsantrag) {
    const ok = await confirm({ message: `Urlaubsantrag von ${employeesById[a.techniker_id]?.name || ''} (${zeitraum(a.von, a.bis)}) genehmigen?` })
    if (!ok) return
    const { error: e1 } = await supabase.from('urlaubsantraege').update({ status: 'genehmigt' }).eq('id', a.id)
    if (e1) { toast('Fehler: ' + e1.message); return }
    toast('Urlaubsantrag genehmigt und in der Plantafel eingetragen.')
    load()
  }

  async function abwesenheitLoeschen(a: Abwesenheit) {
    // Bei einem genehmigten Urlaub haengt ein Antrag des Technikers daran. Der
    // springt per Datenbank-Trigger auf "storniert" — darauf hier hinweisen.
    const ausAntrag = !!a.urlaubsantrag_id
    const ok = await confirm({
      message: `Abwesenheit "${a.art}" von ${employeesById[a.techniker_id]?.name || '–'} (${zeitraum(a.von, a.bis)}) wirklich löschen?`
        + (ausAntrag ? ' Der Urlaubsantrag wird dem Techniker dann als storniert angezeigt.' : ''),
      danger: true,
      confirmLabel: 'Löschen',
    })
    if (!ok) return
    const { error } = await supabase.from('abwesenheiten').delete().eq('id', a.id)
    if (error) { toast('Fehler: ' + error.message); return }
    toast(ausAntrag ? 'Urlaub gelöscht und Antrag auf storniert gesetzt.' : 'Abwesenheit gelöscht.')
    load()
  }

  async function ablehnen(a: Urlaubsantrag) {
    const ok = await confirm({ message: `Urlaubsantrag von ${employeesById[a.techniker_id]?.name || ''} wirklich ablehnen?`, danger: true, confirmLabel: 'Ablehnen' })
    if (!ok) return
    const { error } = await supabase.from('urlaubsantraege').update({ status: 'abgelehnt' }).eq('id', a.id)
    if (error) { toast('Fehler: ' + error.message); return }
    toast('Urlaubsantrag abgelehnt.')
    load()
  }

  function PlanCard({ order, draggable, fromTech, fromDate, continuation }: { order: OrderWithRelations; draggable: boolean; fromTech?: string; fromDate?: string; continuation?: boolean }) {
    return (
      <div
        draggable={draggable}
        onDragStart={() => draggable && setDrag({ orderId: order.id, fromTech: fromTech || '', fromDate: fromDate || '' })}
        onClick={() => navigate(`/auftraege/${order.id}`)}
        className={`text-xs bg-white border border-line p-1.5 mb-1 cursor-pointer ${draggable ? 'cursor-grab' : ''} ${continuation ? 'opacity-60 italic' : ''}`}
        title={continuation ? `Fortsetzung von Auftrag #${order.id}` : undefined}
      >
        <b>#{order.id}</b> {order.einsatzkunde?.name}
        {!continuation && (order.dauer_tage || 1) > 1 && <span className="text-ink-soft"> · {order.dauer_tage} Tage</span>}
        {continuation && <span className="text-ink-soft"> (Fortsetzung)</span>}
        <div className="mt-0.5"><OrderStatusTag status={order.status} /></div>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center gap-3 flex-wrap mb-1">
        <h1 className="text-xl font-semibold m-0">Plantafel</h1>
        <div className="flex gap-1.5">
          {(['woche', 'monat', 'jahr'] as ViewMode[]).map((v) => (
            <button key={v} className={`btn btn-sm ${viewMode === v ? 'btn-dark' : 'btn-outline'}`} onClick={() => setViewMode(v)}>
              {v === 'woche' ? 'Woche' : v === 'monat' ? 'Monat' : 'Jahr'}
            </button>
          ))}
        </div>
        {viewMode === 'woche' && (
          <>
            <button className="btn btn-outline btn-sm" onClick={() => setWeekStart(addDays(weekStart, -7))}>← Vorherige Woche</button>
            <span className="text-sm text-ink-soft">{formatDMY(weekDates[0])} – {formatDMY(weekDates[6])}</span>
            <button className="btn btn-outline btn-sm" onClick={() => setWeekStart(addDays(weekStart, 7))}>Nächste Woche →</button>
          </>
        )}
        {viewMode === 'monat' && (
          <>
            <button className="btn btn-outline btn-sm" onClick={() => setMonthAnchor(new Date(monthAnchor.getFullYear(), monthAnchor.getMonth() - 1, 1))}>← Vorheriger Monat</button>
            <span className="text-sm text-ink-soft">{monthAnchor.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })}</span>
            <button className="btn btn-outline btn-sm" onClick={() => setMonthAnchor(new Date(monthAnchor.getFullYear(), monthAnchor.getMonth() + 1, 1))}>Nächster Monat →</button>
          </>
        )}
        {viewMode === 'jahr' && (
          <>
            <button className="btn btn-outline btn-sm" onClick={() => setMonthAnchor(new Date(monthAnchor.getFullYear() - 1, monthAnchor.getMonth(), 1))}>← Vorheriges Jahr</button>
            <span className="text-sm text-ink-soft">{monthAnchor.getFullYear()}</span>
            <button className="btn btn-outline btn-sm" onClick={() => setMonthAnchor(new Date(monthAnchor.getFullYear() + 1, monthAnchor.getMonth(), 1))}>Nächstes Jahr →</button>
          </>
        )}
      </div>

      {antraege.length > 0 && (
        <>
          <div className="font-semibold text-sm uppercase tracking-wide text-ink-soft mt-4 mb-1.5">Offene Urlaubsanträge ({antraege.length})</div>
          <div className="flex flex-col gap-1.5 mb-4">
            {antraege.map((a) => (
              <div key={a.id} className="card p-3 flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <div className="font-semibold text-sm">{employeesById[a.techniker_id]?.name || '–'} · {zeitraum(a.von, a.bis)}</div>
                  <div className="text-[13px] text-ink-soft">{a.bemerkung || '–'} · beantragt am {new Date(a.beantragt_am).toLocaleDateString('de-DE')}</div>
                </div>
                <div className="flex gap-1.5">
                  <button className="btn btn-amber btn-sm" onClick={() => genehmigen(a)}>Genehmigen</button>
                  <button className="btn btn-danger btn-sm" onClick={() => ablehnen(a)}>Ablehnen</button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="flex items-center gap-2 flex-wrap mt-4 mb-1.5">
        <div className="font-semibold text-sm uppercase tracking-wide text-ink-soft">Geplante Urlaube &amp; Krankheitstage ({bevorstehendeAbwesenheiten.length})</div>
        {darfAbwesenheitenPflegen && (
          <button className="btn btn-outline btn-sm" onClick={() => setAbwesenheitForm({ open: true })}>+ Abwesenheit</button>
        )}
      </div>
      {bevorstehendeAbwesenheiten.length === 0 ? (
        <div className="text-sm text-ink-soft border border-dashed border-line p-4 text-center mb-4">Keine laufenden oder bevorstehenden Abwesenheiten.</div>
      ) : (
        <div className="flex flex-col gap-1.5 mb-4">
          {bevorstehendeAbwesenheiten.map((a) => (
            <div key={a.id} className="card p-3 flex items-center justify-between gap-3 flex-wrap">
              <div className="font-semibold text-sm">{employeesById[a.techniker_id]?.name || '–'}</div>
              <div className="text-[13px] text-ink-soft">{zeitraum(a.von, a.bis)}</div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className={`tag ${a.art === 'Urlaub' ? 'tag-geplant' : a.art === 'Krank' ? 'tag-unterwegs' : 'tag-arbeit'}`}>{a.art}</span>
                {darfAbwesenheitenPflegen && (
                  <>
                    <button className="btn btn-outline btn-sm" onClick={() => setAbwesenheitForm({ open: true, eintrag: a })}>Bearbeiten</button>
                    <button className="btn btn-danger btn-sm" onClick={() => abwesenheitLoeschen(a)}>Löschen</button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {viewMode === 'woche' && (
        <>
          <p className="text-sm text-ink-soft mb-3">Aufträge aus dem Pool auf einen Techniker und Tag ziehen. Bereits eingeplante Aufträge lassen sich innerhalb der Tafel verschieben oder zurück in den Pool ziehen.</p>
          <div className="flex gap-4 items-start max-lg:flex-col">
            <div className="flex-1 overflow-x-auto border border-line bg-graphite">
              <div className="grid" style={{ gridTemplateColumns: `140px repeat(7, minmax(120px, 1fr))` }}>
                <div className="p-2" />
                {weekDates.map((d) => (
                  <div key={d.toISOString()} className="p-2 text-white text-center border-l border-white/10">
                    <div className="text-xs text-white/60">{WOCHENTAGE[d.getDay()]}</div>
                    <div className="text-sm font-semibold">{formatDMY(d)}</div>
                  </div>
                ))}
                {technicians.map((tech) => (
                  <Fragment key={tech.id}>
                    <div className="p-2 text-white text-sm font-semibold bg-graphite-2 flex items-center">{tech.name}</div>
                    {weekDates.map((d) => {
                      const dateStr = formatDMY(d)
                      const abw = abwesenheitFuer(tech.id, d)
                      const dayOrders = orders.filter((o) => o.techniker.some((t) => t.id === tech.id) && orderCoversDate(o, d))
                      return (
                        <div
                          key={tech.id + dateStr}
                          onDragOver={(e) => { if (!abw) e.preventDefault() }}
                          onDrop={(e) => { e.preventDefault(); if (abw) { toast('Techniker ist an diesem Tag abwesend.'); setDrag(null); return } applyDrop(tech.id, dateStr) }}
                          className="p-1.5 bg-paper min-h-[70px] border-l border-t border-line"
                        >
                          {abw ? (
                            <div className="text-xs text-ink-soft italic text-center mt-4">{abw.art}</div>
                          ) : (
                            dayOrders.map((o) => {
                              const isStart = o.einsatzbeginn && formatDMY(parseISO(o.einsatzbeginn)!) === dateStr
                              return <PlanCard key={o.id} order={o} draggable={!!isStart} fromTech={tech.id} fromDate={dateStr} continuation={!isStart} />
                            })
                          )}
                        </div>
                      )
                    })}
                  </Fragment>
                ))}
              </div>
            </div>

            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); applyDrop('', '') }}
              className="w-full lg:w-64 shrink-0 border border-line bg-white p-3"
            >
              <h3 className="text-sm font-semibold mt-0 mb-2">Nicht eingeplant ({poolOrders.length})</h3>
              {poolOrders.length === 0 ? (
                <div className="text-sm text-ink-soft p-3">Alles eingeplant.</div>
              ) : (
                poolOrders.map((o) => <PlanCard key={o.id} order={o} draggable />)
              )}
            </div>
          </div>
        </>
      )}

      {viewMode === 'monat' && (
        <div className="overflow-x-auto border border-line bg-graphite">
          <div className="grid" style={{ gridTemplateColumns: `140px repeat(${monthDates.length}, 34px)` }}>
            <div className="p-2" />
            {monthDates.map((d) => (
              <div key={d.toISOString()} className="p-1 text-white text-center border-l border-white/10">
                <div className="text-[10px] text-white/60">{WOCHENTAGE[d.getDay()]}</div>
                <div className="text-xs font-semibold">{d.getDate()}</div>
              </div>
            ))}
            {technicians.map((tech) => (
              <Fragment key={tech.id}>
                <div className="p-2 text-white text-sm font-semibold bg-graphite-2 flex items-center">{tech.name}</div>
                {monthDates.map((d) => {
                  const abw = abwesenheitFuer(tech.id, d)
                  const dayOrders = orders.filter((o) => o.techniker.some((t) => t.id === tech.id) && orderCoversDate(o, d))
                  const order = dayOrders[0]
                  return (
                    <div
                      key={tech.id + d.toISOString()}
                      onClick={() => order && navigate(`/auftraege/${order.id}`)}
                      title={abw ? abw.art : order ? `#${order.id} ${order.einsatzkunde?.name || ''}` : undefined}
                      className={`h-9 border-l border-t border-line flex items-center justify-center text-[10px] font-semibold ${
                        abw ? 'bg-ink-soft/40 text-white' : order ? 'bg-amber/80 text-ink cursor-pointer hover:bg-amber' : 'bg-paper'
                      }`}
                    >
                      {abw ? abw.art.slice(0, 1) : order ? '●' : ''}
                    </div>
                  )
                })}
              </Fragment>
            ))}
          </div>
        </div>
      )}

      {viewMode === 'jahr' && (
        <div className="overflow-x-auto border border-line bg-white">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-graphite text-white">
                <th className="p-2 text-left font-semibold min-w-[140px]">Techniker</th>
                {MONATSNAMEN.map((m) => <th key={m} className="p-2 text-center font-semibold min-w-[44px]">{m}</th>)}
              </tr>
            </thead>
            <tbody>
              {technicians.map((tech) => (
                <tr key={tech.id} className="border-t border-line">
                  <td className="p-2 font-semibold">{tech.name}</td>
                  {MONATSNAMEN.map((_, monat) => {
                    const tage = abwesenheiten.filter((a) => a.techniker_id === tech.id && abwesenheitUeberschneidetMonat(a, monthAnchor.getFullYear(), monat))
                    const urlaub = tage.filter((a) => a.art === 'Urlaub').length
                    const krank = tage.filter((a) => a.art === 'Krank').length
                    return (
                      <td key={monat} className="p-1 text-center text-[11px]">
                        {urlaub > 0 && <div className="text-steel font-semibold">{urlaub}U</div>}
                        {krank > 0 && <div className="text-red font-semibold">{krank}K</div>}
                        {urlaub === 0 && krank === 0 && <span className="text-ink-soft">–</span>}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-xs text-ink-soft p-2 m-0">U = Urlaubstage, K = Krankheitstage (Anzahl der Abwesenheits-Einträge, die den jeweiligen Monat überschneiden).</p>
        </div>
      )}

      {abwesenheitForm.open && (
        <AbwesenheitFormModal
          abwesenheit={abwesenheitForm.eintrag}
          mitarbeiter={Object.values(employeesById).filter((e) => e.aktiv).sort((a, b) => a.name.localeCompare(b.name))}
          onClose={() => setAbwesenheitForm({ open: false })}
          onSaved={() => { setAbwesenheitForm({ open: false }); load() }}
        />
      )}
    </div>
  )
}
