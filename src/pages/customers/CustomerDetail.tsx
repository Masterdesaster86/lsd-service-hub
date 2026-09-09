import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import type { Ansprechpartner, Customer, Machine } from '../../lib/types'
import { useConfirm } from '../../components/ui/ConfirmProvider'
import { useToast } from '../../components/ui/Toast'
import { CustomerFormModal } from './CustomerFormModal'
import { AnsprechpartnerFormModal } from './AnsprechpartnerFormModal'
import { MachineFormModal } from '../machines/MachineFormModal'

function friendlyDbError(error: { code?: string; message: string }, fallback: string) {
  if (error.code === '23503') return fallback
  return 'Fehler: ' + error.message
}

export function CustomerDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const confirm = useConfirm()
  const toast = useToast()

  const [customer, setCustomer] = useState<Customer | null>(null)
  const [ansprechpartner, setAnsprechpartner] = useState<Ansprechpartner[]>([])
  const [machines, setMachines] = useState<Machine[]>([])
  const [showEdit, setShowEdit] = useState(false)
  const [showNewAp, setShowNewAp] = useState(false)
  const [editAp, setEditAp] = useState<Ansprechpartner | null>(null)
  const [showNewMachine, setShowNewMachine] = useState(false)

  async function load() {
    if (!id) return
    const [{ data: c }, { data: ap }, { data: m }] = await Promise.all([
      supabase.from('customers').select('*').eq('id', id).maybeSingle(),
      supabase.from('ansprechpartner').select('*').eq('kunde_id', id).order('name'),
      supabase.from('machines').select('*').eq('kunde_id', id).order('bezeichnung'),
    ])
    setCustomer(c)
    setAnsprechpartner(ap || [])
    setMachines(m || [])
  }

  useEffect(() => { load() }, [id])

  if (!customer) return <div className="text-sm text-ink-soft">Lädt…</div>

  async function handleDelete() {
    const ok = await confirm({ message: `"${customer!.name}" wirklich unwiderruflich löschen?`, danger: true, confirmLabel: 'Löschen' })
    if (!ok) return
    const { error } = await supabase.from('customers').delete().eq('id', customer!.id)
    if (error) { toast(friendlyDbError(error, 'Dieser Kunde ist noch in Maschinen oder Aufträgen referenziert und kann deshalb nicht gelöscht werden.')); return }
    toast('Kunde gelöscht.')
    navigate('/kunden')
  }

  async function handleDeleteAp(a: Ansprechpartner) {
    const ok = await confirm({ message: `Ansprechpartner "${a.name}" löschen?`, danger: true, confirmLabel: 'Löschen' })
    if (!ok) return
    const { error } = await supabase.from('ansprechpartner').delete().eq('id', a.id)
    if (error) { toast(friendlyDbError(error, 'Dieser Ansprechpartner ist noch in einem Auftrag hinterlegt und kann deshalb nicht gelöscht werden.')); return }
    toast('Ansprechpartner gelöscht.')
    load()
  }

  return (
    <div>
      <button className="text-sm text-steel bg-transparent border-none cursor-pointer p-0 mb-4" onClick={() => navigate('/kunden')}>← Zurück zur Kundenliste</button>

      <div className="flex items-start justify-between gap-4 flex-wrap mb-6 card p-4">
        <div>
          <div className="text-lg font-bold">{customer.name}</div>
          <div className="text-sm text-ink-soft">{customer.strasse}, {customer.plz} {customer.ort}</div>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-outline btn-sm" onClick={() => setShowEdit(true)}>Bearbeiten</button>
          <button className="btn btn-danger btn-sm" onClick={handleDelete}>Löschen</button>
        </div>
      </div>

      <div className="flex items-center gap-2 mb-1">
        <div className="font-semibold text-sm uppercase tracking-wide text-ink-soft">Ansprechpartner</div>
        <button className="btn btn-outline btn-sm" onClick={() => setShowNewAp(true)}>+ Ansprechpartner</button>
      </div>
      {ansprechpartner.length === 0 ? (
        <div className="text-sm text-ink-soft border border-dashed border-line p-4 text-center mb-6">Noch keine Ansprechpartner hinterlegt.</div>
      ) : (
        <div className="flex flex-col gap-1.5 mb-6">
          {ansprechpartner.map((a) => (
            <div key={a.id} className="card p-3 flex items-center justify-between gap-3 flex-wrap">
              <div>
                <div className="font-semibold text-sm">{a.name}</div>
                <div className="text-[13px] text-ink-soft">{a.abteilung || '–'} · {a.telefon || '–'}</div>
              </div>
              <div className="flex gap-1.5">
                <button className="btn btn-outline btn-sm" onClick={() => setEditAp(a)}>Bearbeiten</button>
                <button className="btn btn-danger btn-sm" onClick={() => handleDeleteAp(a)}>Löschen</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2 mb-1">
        <div className="font-semibold text-sm uppercase tracking-wide text-ink-soft">Maschinen</div>
        <button className="btn btn-outline btn-sm" onClick={() => setShowNewMachine(true)}>+ Maschine</button>
      </div>
      {machines.length === 0 ? (
        <div className="text-sm text-ink-soft border border-dashed border-line p-4 text-center">Noch keine Maschinen hinterlegt.</div>
      ) : (
        <div className="flex flex-col gap-1.5">
          {machines.map((m) => (
            <div key={m.id} onClick={() => navigate(`/maschinen/${m.id}?from=customer`)} className="card p-3 cursor-pointer hover:border-amber transition-colors">
              <div className="font-semibold text-sm">{m.bezeichnung}</div>
              <div className="text-[13px] text-ink-soft">{m.hersteller} · Nr. {m.nummer} · Steuerung {m.steuerung || '–'}</div>
            </div>
          ))}
        </div>
      )}

      {showEdit && <CustomerFormModal customer={customer} onClose={() => setShowEdit(false)} onSaved={() => { setShowEdit(false); load() }} />}
      {showNewAp && <AnsprechpartnerFormModal kundeId={customer.id} kundeName={customer.name} onClose={() => setShowNewAp(false)} onSaved={() => { setShowNewAp(false); load() }} />}
      {editAp && <AnsprechpartnerFormModal kundeId={customer.id} kundeName={customer.name} ansprechpartner={editAp} onClose={() => setEditAp(null)} onSaved={() => { setEditAp(null); load() }} />}
      {showNewMachine && <MachineFormModal kundeId={customer.id} kundeName={customer.name} onClose={() => setShowNewMachine(false)} onSaved={() => { setShowNewMachine(false); load() }} />}
    </div>
  )
}
