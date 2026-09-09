import type { Tables } from './database.types'

export type Employee = Tables<'employees'>
export type Customer = Tables<'customers'>
export type Ansprechpartner = Tables<'ansprechpartner'>
export type Machine = Tables<'machines'>
export type MachineNotiz = Tables<'machine_notizen'>
export type MachineBild = Tables<'machine_bilder'>
export type MachineArbeit = Tables<'machine_arbeiten'>
export type Order = Tables<'orders'>
export type OrderMachine = Tables<'order_machines'>
export type OrderTechniker = Tables<'order_techniker'>
export type Servicebericht = Tables<'serviceberichte'>
export type ServiceberichtTag = Tables<'servicebericht_tage'>
export type ServiceberichtErsatzteil = Tables<'servicebericht_ersatzteile'>
export type Abwesenheit = Tables<'abwesenheiten'>
export type Urlaubsantrag = Tables<'urlaubsantraege'>

export type Role = 'Administrator' | 'Disposition' | 'Techniker' | 'CEO'

export type OrderStatus = 'neu' | 'in Arbeit' | 'erledigt' | 'abgerechnet'
export type BerichtStatus = 'offen' | 'abgeschlossen'
export type ArbeitStatus = 'offen' | 'abgeschlossen'
export type AbwesenheitArt = 'Urlaub' | 'Krank' | 'Schulung' | 'Kurzarbeit'
/** "storniert" = war genehmigt, der Plantafel-Eintrag wurde aber wieder gelöscht. */
export type AntragStatus = 'beantragt' | 'genehmigt' | 'abgelehnt' | 'storniert'

/** Order joined with the customer/contact/technician data views need everywhere. */
export interface OrderWithRelations extends Order {
  auftraggeber: Customer | null
  einsatzkunde: Customer | null
  ansprechpartner: Ansprechpartner | null
  machines: Machine[]
  techniker: Employee[]
}
