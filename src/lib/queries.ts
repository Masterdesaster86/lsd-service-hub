// Zentrale, wiederverwendete Supabase-Abfragen mit den üblichen Joins.
import { supabase } from './supabase'
import type { OrderWithRelations, ServiceberichtTag } from './types'
import type { Tageskontext } from './zeit'

const ORDER_SELECT = `
  *,
  auftraggeber:customers!orders_auftraggeber_id_fkey(*),
  einsatzkunde:customers!orders_einsatzkunde_id_fkey(*),
  ansprechpartner:ansprechpartner(*),
  order_machines(machines(*)),
  order_techniker(employees(*))
`

type RawOrder = Record<string, unknown> & {
  order_machines: { machines: unknown }[]
  order_techniker: { employees: unknown }[]
}

function mapOrder(raw: RawOrder): OrderWithRelations {
  const { order_machines, order_techniker, ...rest } = raw
  return {
    ...(rest as unknown as OrderWithRelations),
    machines: order_machines.map((r) => r.machines).filter(Boolean) as OrderWithRelations['machines'],
    techniker: order_techniker.map((r) => r.employees).filter(Boolean) as OrderWithRelations['techniker'],
  }
}

export async function fetchOrders(): Promise<OrderWithRelations[]> {
  const { data, error } = await supabase.from('orders').select(ORDER_SELECT).order('created_at', { ascending: false })
  if (error) throw error
  return (data as unknown as RawOrder[]).map(mapOrder)
}

export async function fetchOrder(id: string): Promise<OrderWithRelations | null> {
  const { data, error } = await supabase.from('orders').select(ORDER_SELECT).eq('id', id).maybeSingle()
  if (error) throw error
  return data ? mapOrder(data as unknown as RawOrder) : null
}

/**
 * Lädt für einen Techniker ALLE erfassten Tage — über alle seine
 * Serviceberichte hinweg, egal zu welchem Auftrag/welcher Maschine —, die
 * auf einen der übergebenen Kalendertage fallen. Damit lässt sich die
 * 10h-Überstundenschwelle korrekt über den ganzen echten Arbeitstag
 * berechnen, auch wenn an einem Tag mehrere Maschinen (= mehrere
 * Serviceberichte) bearbeitet wurden. Siehe `calcTagMitKontext` in zeit.ts.
 */
export async function fetchTageskontext(technikerId: string, daten: string[]): Promise<Tageskontext> {
  const eindeutigeDaten = [...new Set(daten)]
  if (eindeutigeDaten.length === 0) return {}
  const { data, error } = await supabase
    .from('servicebericht_tage')
    .select('*, serviceberichte!inner(techniker_id)')
    .in('datum', eindeutigeDaten)
    .eq('serviceberichte.techniker_id', technikerId)
  if (error) throw error
  const kontext: Tageskontext = {}
  for (const row of (data || []) as unknown as (ServiceberichtTag & { serviceberichte: unknown })[]) {
    const { serviceberichte: _weg, ...tag } = row
    ;(kontext[tag.datum] ||= []).push(tag as ServiceberichtTag)
  }
  return kontext
}
