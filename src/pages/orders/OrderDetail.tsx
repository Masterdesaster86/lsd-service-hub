import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../lib/AuthContext'
import { supabase } from '../../lib/supabase'
import { fetchOrder } from '../../lib/queries'
import type { OrderWithRelations, Servicebericht, ServiceberichtTag } from '../../lib/types'
import { OrderStatusTag, BerichtStatusTag } from '../../components/ui/StatusTag'
import { customerAddress, mapsLink, telHref, formatDateDE } from '../../lib/format'
import { calcBerichtTotals } from '../../lib/zeit'
import { OrderFormModal } from './OrderFormModal'
import { NewBerichtModal } from './NewBerichtModal'
import { useConfirm } from '../../components/ui/ConfirmProvider'
import { useToast } from '../../components/ui/Toast'

interface BerichtRow extends Servicebericht {
  tage: ServiceberichtTag[]
  machines: { bezeichnung: string } | null
  employees: { name: string } | null
}

export function OrderDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { employee } = useAuth()
  const confirm = useConfirm()
  const toast = useToast()
  const [order, setOrder] = useState<OrderWithRelations | null>(null)
  const [berichte, setBerichte] = useState<BerichtRow[] | null>(null)
  const [showEdit, setShowEdit] = useState(false)
  const [showNewBericht, setShowNewBericht] = useState(false)

  async function load() {
    if (!id) return
    const o = await fetchOrder(id)
    setOrder(o)
    const { data } = await supabase
      .from('serviceberichte')
      .select('*, tage:servicebericht_tage(*), machines(bezeichnung), employees(name)')
      .eq('auftrag_id', id)
      .order('bericht_nummer')
    setBerichte((data as BerichtRow[]) || [])
  }

  useEffect(() => { load() }, [id])

  if (!order) return <div className="text-sm text-ink-soft">Lädt…</div>

  const isTechniker = employee?.role === 'Techniker'

  async function handleDelete() {
    if ((berichte?.length || 0) > 0) {
      toast('Zu diesem Auftrag gibt es bereits Serviceberichte. Diese müssten erst entfernt werden, bevor der Auftrag gelöscht werden kann.')
      return
    }
    const ok = await confirm({ message: `Auftrag #${order!.id} (${order!.einsatzkunde?.name}) wirklich unwiderruflich löschen?`, danger: true, confirmLabel: 'Löschen' })
    if (!ok) return
    const { error } = await supabase.from('orders').delete().eq('id', order!.id)
    if (error) { toast('Fehler: ' + error.message); return }
    toast('Auftrag gelöscht.')
    navigate('/auftraege')
  }

  return (
    <div>
      <button className="text-sm text-steel bg-transparent border-none cursor-pointer p-0 mb-4" onClick={() => navigate('/auftraege')}>← Zurück zur Übersicht</button>

      <div className="flex items-start justify-between gap-4 flex-wrap mb-4 card p-4">
        <div>
          <div className="font-mono text-lg font-semibold">#{order.id}</div>
          <div className="font-semibold">{order.einsatzkunde?.name || '–'}</div>
        </div>
        <div className="flex items-center gap-2.5">
          <OrderStatusTag status={order.status} />
          {!isTechniker && (
            <>
              <button className="btn btn-outline btn-sm" onClick={() => setShowEdit(true)}>Bearbeiten</button>
              <button className="btn btn-danger btn-sm" onClick={handleDelete}>Löschen</button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-6 gap-y-3 mb-6 max-sm:grid-cols-1">
        <Field label="Auftraggeber" value={order.auftraggeber?.name || '–'} />
        <Field label="Einsatzkunde" value={order.einsatzkunde?.name || '–'} />
        <Field label="Adresse">
          <a href={mapsLink(customerAddress(order.einsatzkunde))} target="_blank" rel="noreferrer" className="text-steel">📍 {customerAddress(order.einsatzkunde)}</a>
        </Field>
        <Field label="Techniker" value={order.techniker.length ? order.techniker.map((t) => t.name).join(', ') : '—'} />
        <Field label="Einsatzbeginn (geplant)" value={formatDateDE(order.einsatzbeginn)} />
        <Field label="Dauer" value={`${order.dauer_tage || 1} Tag(e)`} />
        <div className="col-span-2">
          <label>Maschinen</label>
          {order.machines.length ? (
            <div className="flex flex-col gap-1">
              {order.machines.map((m) => (
                <div key={m.id}>{m.bezeichnung} <span className="text-ink-soft text-[12.5px]">— Maschinennr. {m.nummer || '–'} · Kunden-Maschinennr. {m.kunden_maschinennummer || '–'}</span></div>
              ))}
            </div>
          ) : <div className="val">– noch keine ausgewählt –</div>}
        </div>
        {order.ansprechpartner && (
          <Field label="Ansprechpartner">
            {order.ansprechpartner.name}
            {order.ansprechpartner.telefon && <> · <a href={telHref(order.ansprechpartner.telefon)} className="text-steel no-underline">📞 {order.ansprechpartner.telefon}</a></>}
            {order.ansprechpartner.email && <> · <a href={`mailto:${order.ansprechpartner.email}`} className="text-steel no-underline">✉️ {order.ansprechpartner.email}</a></>}
          </Field>
        )}
        {order.bestellnummer && <Field label="Bestellnummer" value={order.bestellnummer} />}
        {order.kundenreferenznr && <Field label="Kundenreferenznr." value={order.kundenreferenznr} />}
        {order.auftragsnr_kunde && <Field label="Auftragsnr. Kunde" value={order.auftragsnr_kunde} />}
        <div className="col-span-2"><label>Meldetext</label><div className="val">{order.meldetext || '–'}</div></div>
      </div>

      <div className="flex items-center gap-2 mb-1">
        <div className="font-semibold text-sm uppercase tracking-wide text-ink-soft">Serviceberichte</div>
        {isTechniker && <button className="btn btn-amber btn-sm" onClick={() => setShowNewBericht(true)}>+ Servicebericht</button>}
      </div>
      <p className="text-sm text-ink-soft mb-2.5">{isTechniker ? 'Nur deine eigenen Berichte für diesen Auftrag.' : 'Alle Berichte aller Techniker für diesen Auftrag.'}</p>

      {berichte === null ? (
        <div className="text-sm text-ink-soft">Lädt…</div>
      ) : berichte.length === 0 ? (
        <div className="text-sm text-ink-soft border border-dashed border-line p-6 text-center">Noch keine Serviceberichte{isTechniker ? ' von dir' : ''} für diesen Auftrag.</div>
      ) : (
        <div className="flex flex-col gap-2">
          {berichte.map((b) => {
            const totals = calcBerichtTotals(b.tage)
            const zuschlag = Math.round((totals.arbeitZuschlag50 + totals.reiseZuschlag50 + totals.arbeitZuschlag100 + totals.reiseZuschlag100) * 100) / 100
            return (
              <div key={b.id} onClick={() => navigate(`/berichte/${b.id}`)} className="card p-4 cursor-pointer hover:border-amber transition-colors flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <div className="font-mono text-xs text-ink-soft">{b.bericht_nummer}</div>
                  <div className="font-semibold">{b.machines?.bezeichnung || '–'} · {b.employees?.name || '–'}{b.ist_nachtrag && <span className="text-ink-soft font-normal text-xs"> (Nachtrag)</span>}</div>
                  <div className="text-[13px] text-ink-soft">{b.tage.length} Tag(e) erfasst · Gesamt {totals.gesamt} h (davon {zuschlag} h Zuschlag)</div>
                </div>
                <BerichtStatusTag status={b.status} abgerechnet={b.abgerechnet} />
              </div>
            )
          })}
        </div>
      )}

      {showEdit && <OrderFormModal order={order} onClose={() => setShowEdit(false)} onSaved={() => { setShowEdit(false); load() }} />}
      {showNewBericht && (
        <NewBerichtModal
          order={order}
          onClose={() => setShowNewBericht(false)}
          onCreated={(berichtId) => { setShowNewBericht(false); navigate(`/berichte/${berichtId}`) }}
        />
      )}
    </div>
  )
}

function Field({ label, value, children }: { label: string; value?: string; children?: React.ReactNode }) {
  return (
    <div>
      <label>{label}</label>
      <div className="val">{children ?? value}</div>
    </div>
  )
}
