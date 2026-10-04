import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/AuthContext'
import { darfStammdatenAendern } from '../../lib/rechte'
import type { Ansprechpartner, Customer, Machine } from '../../lib/types'
import { useConfirm } from '../../components/ui/ConfirmProvider'
import { useToast } from '../../components/ui/Toast'
import { CustomerFormModal } from './CustomerFormModal'
import { AnsprechpartnerFormModal } from './AnsprechpartnerFormModal'
import { MachineFormModal } from '../machines/MachineFormModal'
import { Icon } from '../../components/ui/Icon'
import { Typenschild } from '../../components/ui/Typenschild'
import { mapsLink, telHref } from '../../lib/format'

function friendlyDbError(error: { code?: string; message: string }, fallback: string) {
  if (error.code === '23503') return fallback
  return 'Fehler: ' + error.message
}

export function CustomerDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const confirm = useConfirm()
  const toast = useToast()
  const { employee } = useAuth()
  const darfAendern = darfStammdatenAendern(employee)

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

  const adresse = `${customer.strasse}, ${customer.plz} ${customer.ort}`

  return (
    <div>
      <button className="btn btn-outline btn-sm mb-4" onClick={() => navigate('/kunden')}><Icon name="zurueck" size={18} /> Kunden</button>

      <p className="eyebrow">Kunde</p>
      <h1 className="!text-[30px]">{customer.name}</h1>

      <div className="grid grid-cols-2 gap-2 mt-4 mb-4 sm:max-w-md">
        <a href={mapsLink(adresse)} target="_blank" rel="noreferrer" className="btn btn-outline"><Icon name="standort" size={20} /> Route</a>
        {customer.rechnungs_email
          ? <a href={`mailto:${customer.rechnungs_email}`} className="btn btn-outline"><Icon name="teilen" size={20} /> E-Mail</a>
          : <span className="btn btn-outline opacity-40 pointer-events-none"><Icon name="teilen" size={20} /> E-Mail</span>}
      </div>

      <Typenschild
        className="mb-3"
        zeilen={[
          ['Adresse', <a href={mapsLink(adresse)} target="_blank" rel="noreferrer" className="text-steel">{adresse}</a>],
          ['Rechnungen an', customer.rechnungs_email ? <a href={`mailto:${customer.rechnungs_email}`} className="text-steel break-all">{customer.rechnungs_email}</a> : '–'],
        ]}
      />
      {darfAendern && (
        <div className="grid grid-cols-2 gap-2 mb-7 sm:max-w-md">
          <button className="btn btn-outline btn-sm" onClick={() => setShowEdit(true)}><Icon name="bearbeiten" size={16} /> Bearbeiten</button>
          <button className="btn btn-danger btn-sm" onClick={handleDelete}><Icon name="loeschen" size={16} /> Löschen</button>
        </div>
      )}

      <div className="flex items-center justify-between gap-2 mb-2 mt-6">
        <div className="abschnitt">Ansprechpartner</div>
        <button className="btn btn-outline btn-sm" onClick={() => setShowNewAp(true)}><Icon name="hinzufuegen" size={16} /> Ansprechpartner</button>
      </div>
      {ansprechpartner.length === 0 ? (
        <div className="text-sm text-ink-soft border border-dashed border-line p-4 text-center mb-6">Noch keine Ansprechpartner hinterlegt.</div>
      ) : (
        <div className="bg-white border border-line mb-6">
          {ansprechpartner.map((a) => (
            <div key={a.id} className="px-3.5 py-3 border-b border-line last:border-b-0">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-semibold">{a.name}</div>
                  {a.abteilung && <div className="text-[13px] text-ink-soft">{a.abteilung}</div>}
                </div>
                {darfAendern && (
                  <div className="flex gap-1.5 shrink-0">
                    <button className="btn btn-outline btn-sm !px-0 w-10" aria-label={`${a.name} bearbeiten`} onClick={() => setEditAp(a)}><Icon name="bearbeiten" size={16} /></button>
                    <button className="btn btn-outline btn-sm !px-0 w-10" aria-label={`${a.name} löschen`} onClick={() => handleDeleteAp(a)}><Icon name="loeschen" size={16} /></button>
                  </div>
                )}
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5">
                {a.telefon && <a href={telHref(a.telefon)} className="inline-flex items-center gap-1.5 text-steel no-underline font-mono text-[14px]"><Icon name="anrufen" size={16} /> {a.telefon}</a>}
                {a.email && <a href={`mailto:${a.email}`} className="inline-flex items-center gap-1.5 text-steel no-underline text-[14px] break-all"><Icon name="teilen" size={16} /> {a.email}</a>}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="abschnitt">Maschinen</div>
        <button className="btn btn-outline btn-sm" onClick={() => setShowNewMachine(true)}><Icon name="hinzufuegen" size={16} /> Maschine</button>
      </div>
      {machines.length === 0 ? (
        <div className="text-sm text-ink-soft border border-dashed border-line p-4 text-center">Noch keine Maschinen hinterlegt.</div>
      ) : (
        <div className="flex flex-col gap-2">
          {machines.map((m) => (
            <div key={m.id} onClick={() => navigate(`/maschinen/${m.id}?from=customer`)} className="card p-3.5 cursor-pointer hover:border-ink transition-colors">
              <div className="flex items-baseline justify-between gap-3">
                <span className="font-mono font-semibold text-[15.5px]">{m.bezeichnung}</span>
                <span className="font-mono text-[12.5px] text-ink-soft">{m.steuerung || ''}</span>
              </div>
              <div className="font-mono text-[12.5px] text-ink-soft mt-1">{m.hersteller || '–'} · Nr. {m.nummer || '–'}</div>
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
