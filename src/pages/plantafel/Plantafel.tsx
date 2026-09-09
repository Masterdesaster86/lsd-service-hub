import { Fragment, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { fetchOrders } from '../../lib/queries'
import type { Abwesenheit, Employee, OrderWithRelations, Urlaubsantrag } from '../../lib/types'
import { OrderStatusTag } from '../../components/ui/StatusTag'
import { useToast } from '../../components/ui/Toast'
import { useConfirm } from '../../components/ui/ConfirmProvider'
import { WOCHENTAGE, addDays, formatDMY, parseISO } from '../../lib/zeit'

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

interface DragData { orderId: string; fromTech: string; fromDate: string }

export function Plantafel() {
  const navigate = useNavigate()
  const toast = useToast()
  const confirm = useConfirm()

  const [weekStart, setWeekStart] = useState(() => mondayOfWeek(new Date()))
  const [technicians, setTechnicians] = useState<Employee[]>([])
  const [orders, setOrders] = useState<OrderWithRelations[]>([])
  const [abwesenheiten, setAbwesenheiten] = useState<Abwesenheit[]>([])
  const [antraege, setAntraege] = useState<Urlaubsantrag[]>([])
  const [employeesById, setEmployeesById] = useState<Record<string, Employee>>({})
  const [drag, setDrag] = useState<DragData | null>(null)

  async function load() {
    const [{ data: emp }, all, { data: abw }, { data: ant }] = await Promise.all([
      supabase.from('employees').select('*').eq('role', 'Techniker').eq('aktiv', true).order('name'),
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
  const poolOrders = orders.filter((o) => o.techniker.length === 0)

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
    const ok = await confirm({ message: `Urlaubsantrag von ${employeesById[a.techniker_id]?.name || ''} (${a.von}${a.bis !== a.von ? ` – ${a.bis}` : ''}) genehmigen?` })
    if (!ok) return
    const { error: e1 } = await supabase.from('urlaubsantraege').update({ status: 'genehmigt' }).eq('id', a.id)
    if (e1) { toast('Fehler: ' + e1.message); return }
    toast('Urlaubsantrag genehmigt und in der Plantafel eingetragen.')
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
        <button className="btn btn-outline btn-sm" onClick={() => setWeekStart(addDays(weekStart, -7))}>← Vorherige Woche</button>
        <span className="text-sm text-ink-soft">{formatDMY(weekDates[0])} – {formatDMY(weekDates[6])}</span>
        <button className="btn btn-outline btn-sm" onClick={() => setWeekStart(addDays(weekStart, 7))}>Nächste Woche →</button>
      </div>

      {antraege.length > 0 && (
        <>
          <div className="font-semibold text-sm uppercase tracking-wide text-ink-soft mt-4 mb-1.5">Offene Urlaubsanträge ({antraege.length})</div>
          <div className="flex flex-col gap-1.5 mb-4">
            {antraege.map((a) => (
              <div key={a.id} className="card p-3 flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <div className="font-semibold text-sm">{employeesById[a.techniker_id]?.name || '–'} · {a.von}{a.bis !== a.von ? ` – ${a.bis}` : ''}</div>
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
    </div>
  )
}
