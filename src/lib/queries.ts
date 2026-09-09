// Zentrale, wiederverwendete Supabase-Abfragen mit den üblichen Joins.
import { supabase } from './supabase'
import type { OrderWithRelations } from './types'

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
