import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { fetchOrders } from '../../lib/queries'
import type { Abwesenheit, Employee, OrderWithRelations, Urlaubsantrag } from '../../lib/types'
import { useToast } from '../../components/ui/Toast'
import { useConfirm } from '../../components/ui/ConfirmProvider'
import { addDays, parseISO } from '../../lib/zeit'
import { formatDateDE } from '../../lib/format'

export const zeitraum = (von: string, bis: string) => (von === bis ? formatDateDE(von) : `${formatDateDE(von)} – ${formatDateDE(bis)}`)

export function mondayOfWeek(d: Date): Date {
  const midnight = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const day = midnight.getDay()
  const diff = day === 0 ? -6 : 1 - day
  return addDays(midnight, diff)
}

export function orderCoversDate(o: OrderWithRelations, d: Date): boolean {
  if (!o.einsatzbeginn) return false
  const start = parseISO(o.einsatzbeginn)
  if (!start) return false
  const ende = addDays(start, (o.dauer_tage || 1) - 1)
  return d >= start && d <= ende
}

export function isoFromDMY(dmy: string) {
  const [d, m, y] = dmy.split('.')
  return `${y}-${m}-${d}`
}

export interface DragData { orderId: string; fromTech: string; fromDate: string }

export interface BerichtKurz { auftrag_id: string; techniker_id: string; status: string }

/**
 * Wie weit darf die Karte eines Technikers noch bewegt werden?
 *
 * Sobald ein Techniker zu einem Auftrag einen Bericht angefangen hat, darf er
 * nicht mehr aus dem Auftrag fallen: Techniker sehen nur Auftraege, denen sie
 * zugeteilt sind — sein angefangener Bericht waere sonst nicht mehr erreichbar.
 * Ist der Bericht schon abgeschlossen, ist der Einsatz dokumentiert; dann ergibt
 * auch ein neuer Termin keinen Sinn mehr.
 */
export type Sperre = 'frei' | 'nurTag' | 'gesperrt'

export const SPERR_TEXT: Record<Exclude<Sperre, 'frei'>, string> = {
  nurTag: 'Für diesen Auftrag gibt es schon einen offenen Servicebericht des Technikers. Der Tag lässt sich noch verschieben, der Techniker nicht mehr.',
  gesperrt: 'Für diesen Auftrag gibt es einen abgeschlossenen Servicebericht des Technikers. Der Eintrag lässt sich nicht mehr verschieben.',
}

/** Daten und Aktionen der Plantafel — gemeinsam für das Desktop-Raster und die
 * mobile Ansicht, damit die Regeln (Sperren, Urlaub, Pool) nur einmal stehen. */
export function usePlantafelDaten() {
  const toast = useToast()
  const confirm = useConfirm()
  const [technicians, setTechnicians] = useState<Employee[]>([])
  const [orders, setOrders] = useState<OrderWithRelations[]>([])
  const [abwesenheiten, setAbwesenheiten] = useState<Abwesenheit[]>([])
  const [antraege, setAntraege] = useState<Urlaubsantrag[]>([])
  const [employeesById, setEmployeesById] = useState<Record<string, Employee>>({})
  const [berichte, setBerichte] = useState<BerichtKurz[]>([])

  async function load() {
    const [{ data: emp }, all, { data: abw }, { data: ant }, { data: ber }] = await Promise.all([
      supabase.from('employees').select('*').in('role', ['Techniker', 'CEO']).eq('aktiv', true).order('name'),
      fetchOrders(),
      supabase.from('abwesenheiten').select('*'),
      supabase.from('urlaubsantraege').select('*').eq('status', 'beantragt'),
      supabase.from('serviceberichte').select('auftrag_id, techniker_id, status'),
    ])
    setTechnicians(emp || [])
    setOrders(all.filter((o) => o.status !== 'erledigt' && o.status !== 'abgerechnet'))
    setAbwesenheiten(abw || [])
    setAntraege(ant || [])
    setBerichte(ber || [])
    const { data: allEmp } = await supabase.from('employees').select('*')
    setEmployeesById(Object.fromEntries((allEmp || []).map((e) => [e.id, e])))
  }

  useEffect(() => { load() }, [])

  // Nicht eingeplant ist beides: ohne Techniker und ohne Termin. Ohne Termin
  // taucht ein Auftrag in keiner Tageszelle auf — er waere sonst nirgends
  // sichtbar.
  const poolOrders = orders.filter((o) => o.techniker.length === 0 || !o.einsatzbeginn)

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

  function sperreFuer(orderId: string, techId: string): Sperre {
    if (!techId) return 'frei'
    const eigene = berichte.filter((b) => b.auftrag_id === orderId && b.techniker_id === techId)
    if (eigene.some((b) => b.status === 'abgeschlossen')) return 'gesperrt'
    return eigene.length > 0 ? 'nurTag' : 'frei'
  }

  /** Führt die Umplanung aus. Quelle kommt entweder vom Ziehen oder vom
   *  Antippen — beide Wege landen hier. `dateStr` im Format TT.MM.JJJJ. */
  async function verschiebe(quelle: DragData, techId: string, dateStr: string) {
    const order = orders.find((o) => o.id === quelle.orderId)
    if (!order) return

    const sperre = sperreFuer(order.id, quelle.fromTech)
    if (sperre === 'gesperrt') { toast(SPERR_TEXT.gesperrt); return }
    // Bei "nurTag" darf die Karte in derselben Zeile bleiben — ein anderer
    // Techniker oder der Pool wuerde den Bericht abhaengen.
    if (sperre === 'nurTag' && techId !== quelle.fromTech) { toast(SPERR_TEXT.nurTag); return }

    // Bleibt die Karte in derselben Zeile, aendert sich nur der Termin. Die
    // Zuteilung darf dann nicht angefasst werden: Loeschen und Wiedereintragen
    // wuerde den Techniker aus dem Auftrag werfen.
    if (techId && techId === quelle.fromTech) {
      await supabase.from('orders').update({ einsatzbeginn: isoFromDMY(dateStr) }).eq('id', order.id)
      toast(`Auftrag #${order.id} verschoben auf ${dateStr}.`)
      load()
      return
    }

    if (quelle.fromTech) {
      await supabase.from('order_techniker').delete().eq('order_id', order.id).eq('techniker_id', quelle.fromTech)
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
    load()
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

  return {
    technicians, orders, abwesenheiten, antraege, employeesById, berichte,
    poolOrders, bevorstehendeAbwesenheiten,
    load, abwesenheitFuer, sperreFuer, verschiebe, genehmigen, ablehnen, abwesenheitLoeschen,
  }
}
