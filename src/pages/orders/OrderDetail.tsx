import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../lib/AuthContext'
import { supabase } from '../../lib/supabase'
import { fetchOrder, fetchTageskontext } from '../../lib/queries'
import type { Messprotokoll, OrderWithRelations, Servicebericht, ServiceberichtTag, Wartungsprotokoll } from '../../lib/types'
import { MessprotokollListe } from '../messprotokoll/MessprotokollListe'
import { WartungsprotokollListe } from '../wartung/WartungsprotokollListe'
import { OrderStatusTag, BerichtStatusTag } from '../../components/ui/StatusTag'
import { customerAddress, mapsLink, telHref, formatDateDE } from '../../lib/format'
import { calcBerichtTotalsMitKontext, type Tageskontext } from '../../lib/zeit'
import { OrderFormModal } from './OrderFormModal'
import { Icon } from '../../components/ui/Icon'
import { Typenschild } from '../../components/ui/Typenschild'
import { NewBerichtModal } from './NewBerichtModal'
import { useConfirm } from '../../components/ui/ConfirmProvider'
import { useToast } from '../../components/ui/Toast'
import { EasybillRechnungModal } from './EasybillRechnungModal'
import { easybillAufruf } from '../../lib/easybillRechnung'

interface BerichtRow extends Servicebericht {
  tage: ServiceberichtTag[]
  machines: { bezeichnung: string; nummer: string | null; kunden_maschinennummer: string | null } | null
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
  const [kontexteProTechniker, setKontexteProTechniker] = useState<Record<string, Tageskontext>>({})
  const [messprotokolle, setMessprotokolle] = useState<Messprotokoll[]>([])
  const [wartungsprotokolle, setWartungsprotokolle] = useState<Wartungsprotokoll[]>([])
  const [showEdit, setShowEdit] = useState(false)
  const [showNewBericht, setShowNewBericht] = useState(false)
  const [showRechnung, setShowRechnung] = useState(false)

  async function load() {
    if (!id) return
    const o = await fetchOrder(id)
    setOrder(o)
    const { data } = await supabase
      .from('serviceberichte')
      .select('*, tage:servicebericht_tage(*), machines(bezeichnung, nummer, kunden_maschinennummer), employees(name)')
      .eq('auftrag_id', id)
      .order('bericht_nummer')
    const rows = (data as BerichtRow[]) || []
    setBerichte(rows)
    // Büro: Hat easybill einen Entwurf dieses Auftrags inzwischen abgeschlossen? Dann setzt die
    // Serverfunktion die Berichte auf abgerechnet — hier nur nachsehen und ggf. neu laden.
    if (employee && employee.role !== 'Techniker' && rows.some((b) => b.status === 'abgeschlossen' && !b.abgerechnet)) {
      easybillAufruf<{ abgeschlossen: { nummer: string | null }[] }>({ aktion: 'abgleichen', auftrag_id: id })
        .then((r) => {
          const nummern = (r.abgeschlossen || []).map((x) => x.nummer).filter(Boolean)
          if (nummern.length) { toast(`Rechnung ${nummern.join(', ')} ist abgeschlossen – Berichte auf abgerechnet gesetzt.`); load() }
        })
        .catch(() => { /* kein Schlüssel hinterlegt oder easybill nicht erreichbar: still bleiben */ })
    }
    const { data: mp } = await supabase.from('messprotokolle').select('*').eq('auftrag_id', id).order('erstellt_am')
    setMessprotokolle(mp || [])
    const { data: wp } = await supabase.from('wartungsprotokolle').select('*').eq('auftrag_id', id).order('erstellt_am')
    setWartungsprotokolle(wp || [])

    // Für die korrekte 10h-Schwelle: pro Techniker auch die Zeiten seiner
    // anderen Serviceberichte an denselben Kalendertagen laden (z.B. wenn an
    // einem Tag mehrere Maschinen bearbeitet wurden). Getrennt pro Techniker,
    // damit sich nicht die Arbeitstage verschiedener Personen vermischen.
    const technikerIds = [...new Set(rows.map((b) => b.techniker_id))]
    const kontexte = await Promise.all(
      technikerIds.map((tid) => fetchTageskontext(tid, rows.filter((b) => b.techniker_id === tid).flatMap((b) => b.tage.map((t) => t.datum)))),
    )
    const neuKontexteProTechniker: Record<string, Tageskontext> = {}
    technikerIds.forEach((tid, i) => { neuKontexteProTechniker[tid] = kontexte[i] })
    setKontexteProTechniker(neuKontexteProTechniker)
  }

  useEffect(() => { load() }, [id])

  if (!order) return <div className="text-sm text-ink-soft">Lädt…</div>

  const isTechniker = employee?.role === 'Techniker'
  // Einen Servicebericht darf jeder anlegen, der auf dem Auftrag eingeplant ist
  // — unabhängig von der Rolle (Techniker wie CEO).
  const istEingeplant = order.techniker.some((t) => t.id === employee?.id)

  // Stornieren statt löschen: so bleiben App und easybill gleich (die Auftragsnummer bleibt vergeben).
  async function handleStornieren() {
    if ((berichte || []).length > 0) {
      toast('Zu diesem Auftrag gibt es schon einen Servicebericht. Stornieren geht nur, solange noch kein Bericht angelegt ist.')
      return
    }
    const ok = await confirm({
      message: `Auftrag #${order!.id} (${order!.einsatzkunde?.name}) in der App und in easybill stornieren? Das lässt sich nicht rückgängig machen.`,
      danger: true,
      confirmLabel: 'Stornieren',
    })
    if (!ok) return
    try {
      await easybillAufruf({ aktion: 'auftrag_stornieren', auftrag_id: order!.id })
      toast(`Auftrag #${order!.id} storniert.`)
      navigate('/auftraege')
    } catch (e) {
      toast((e as Error).message)
    }
  }

  const adresse = customerAddress(order.einsatzkunde)
  const ap = order.ansprechpartner

  return (
    <div>
      <button className="btn btn-outline btn-sm mb-4" onClick={() => navigate('/auftraege')}><Icon name="zurueck" size={18} /> Aufträge</button>

      <p className="eyebrow">Serviceauftrag</p>
      <div className="flex items-start justify-between gap-3">
        <h1>#{order.id}</h1>
        <OrderStatusTag status={employee?.role === 'Techniker' && order.status === 'abgerechnet' ? 'erledigt' : order.status} />
      </div>
      <div className="font-semibold text-[18px] leading-snug mt-1.5">{order.einsatzkunde?.name || '–'}</div>

      <div className="grid grid-cols-2 gap-2 mt-4 mb-5 sm:max-w-md">
        <a href={mapsLink(adresse)} target="_blank" rel="noreferrer" className="btn btn-outline"><Icon name="standort" size={20} /> Route</a>
        {ap?.telefon
          ? <a href={telHref(ap.telefon)} className="btn btn-outline"><Icon name="anrufen" size={20} /> Anrufen</a>
          : <span className="btn btn-outline opacity-40 pointer-events-none"><Icon name="anrufen" size={20} /> Anrufen</span>}
      </div>

      <div className="grid gap-4 lg:grid-cols-2 items-start mb-6">
        <Typenschild
          titel="Auftrag"
          zeilen={[
            ['Auftraggeber', order.auftraggeber?.name || '–'],
            ['Einsatzkunde', order.einsatzkunde?.name || '–'],
            ['Adresse', <a href={mapsLink(adresse)} target="_blank" rel="noreferrer" className="text-steel">{adresse}</a>],
            ap && ['Ansprechpartner', (
              <span className="flex flex-col">
                <span>{ap.name}</span>
                {ap.telefon && <a href={telHref(ap.telefon)} className="text-steel no-underline font-mono text-[14px]">{ap.telefon}</a>}
                {ap.email && <a href={`mailto:${ap.email}`} className="text-steel no-underline text-[14px] break-all">{ap.email}</a>}
              </span>
            )],
            ['Techniker', order.techniker.length ? order.techniker.map((t) => t.name).join(', ') : '–'],
            ['Einsatzbeginn', formatDateDE(order.einsatzbeginn)],
            ['Dauer', `${order.dauer_tage || 1} ${(order.dauer_tage || 1) === 1 ? 'Tag' : 'Tage'}`],
            order.bestellnummer && ['Bestellnummer', <span className="font-mono">{order.bestellnummer}</span>],
            order.kundenreferenznr && ['Kundenreferenz', <span className="font-mono">{order.kundenreferenznr}</span>],
            order.auftragsnr_kunde && ['Auftragsnr. Kunde', <span className="font-mono">{order.auftragsnr_kunde}</span>],
          ]}
        />
        <div className="flex flex-col gap-4">
          {order.machines.length === 0 ? (
            <Typenschild titel="Maschine" zeilen={[['Maschine', '– noch keine ausgewählt –']]} />
          ) : order.machines.map((m) => (
            <Typenschild
              key={m.id}
              titel="Maschine"
              zeilen={[
                ['Typ', <span className="font-mono">{m.bezeichnung}</span>],
                ['Maschinennr.', <span className="font-mono">{m.nummer || '–'}</span>],
                ['Kunden-Nr.', <span className="font-mono">{m.kunden_maschinennummer || '–'}</span>],
              ]}
            />
          ))}
          <div className="bg-white border border-line px-3.5 py-3">
            <div className="abschnitt mb-1.5">Meldetext</div>
            <div className="text-[15px] whitespace-pre-line">{order.meldetext || '–'}</div>
          </div>
          {!isTechniker && (
            <div className="grid grid-cols-2 gap-2">
              <button className="btn btn-outline" onClick={() => setShowEdit(true)}><Icon name="bearbeiten" size={18} /> Bearbeiten</button>
              {order.status !== 'storniert' && (berichte || []).length === 0 && <button className="btn btn-danger" onClick={handleStornieren}><Icon name="loeschen" size={18} /> Stornieren</button>}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 mb-1">
        <div className="abschnitt">Serviceberichte</div>
        <div className="flex gap-2">
          {!isTechniker && (berichte || []).some((b) => b.status === 'abgeschlossen' && !b.abgerechnet) && (
            <button className="btn btn-outline btn-sm" onClick={() => setShowRechnung(true)}>Rechnung in easybill</button>
          )}
          {istEingeplant && <button className="btn btn-amber btn-sm" onClick={() => setShowNewBericht(true)}>+ Servicebericht</button>}
        </div>
      </div>
      <p className="text-sm text-ink-soft mb-2.5">{isTechniker ? 'Nur deine eigenen Berichte für diesen Auftrag.' : 'Alle Berichte aller Techniker für diesen Auftrag.'}</p>

      {berichte === null ? (
        <div className="text-sm text-ink-soft">Lädt…</div>
      ) : berichte.length === 0 ? (
        <div className="text-sm text-ink-soft border border-dashed border-line p-6 text-center">Noch keine Serviceberichte{isTechniker ? ' von dir' : ''} für diesen Auftrag.</div>
      ) : (
        <div className="flex flex-col gap-2">
          {berichte.map((b) => {
            const totals = calcBerichtTotalsMitKontext(b.tage, kontexteProTechniker[b.techniker_id] || {})
            const zuschlag = Math.round((totals.arbeitZuschlag50 + totals.reiseZuschlag50 + totals.arbeitZuschlag100 + totals.reiseZuschlag100) * 100) / 100
            return (
              <div key={b.id} onClick={() => navigate(`/berichte/${b.id}`)} className="card p-4 cursor-pointer hover:border-ink transition-colors">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-mono text-[13.5px] font-semibold">
                    {b.bericht_nummer}
                    {b.ist_nachtrag && <span className="ml-2 px-1.5 py-0.5 border border-dashed border-ink font-mono text-[11px] uppercase tracking-[0.08em]">Nachtrag</span>}
                  </span>
                  <BerichtStatusTag status={b.status} abgerechnet={employee?.role !== 'Techniker' && b.abgerechnet} />
                </div>
                <div className="font-semibold text-[16.5px] leading-snug mt-1.5">{b.machines?.bezeichnung || '–'} · {b.employees?.name || '–'}</div>
                <div className="font-mono text-[12.5px] text-ink-soft mt-1">Nr. {b.machines?.nummer || '–'} · Kunden-Nr. {b.machines?.kunden_maschinennummer || '–'}</div>
                <div className="text-[14px] mt-1.5">
                  {b.tage.length} {b.tage.length === 1 ? 'Tag' : 'Tage'} · <b>{totals.gesamt.toLocaleString('de-DE')} h</b> gesamt
                  {zuschlag > 0 && <span className="text-ink-soft"> · davon {zuschlag.toLocaleString('de-DE')} h Zuschlag</span>}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {messprotokolle.length > 0 && (
        <>
          <div className="abschnitt mt-6 mb-2">Messprotokolle</div>
          <MessprotokollListe
            protokolle={messprotokolle}
            maschinen={Object.fromEntries(order.machines.map((m) => [m.id, m.bezeichnung]))}
          />
        </>
      )}
      {wartungsprotokolle.length > 0 && (
        <>
          <div className="abschnitt mt-6 mb-2">Wartungsprotokolle</div>
          <WartungsprotokollListe
            protokolle={wartungsprotokolle}
            maschinen={Object.fromEntries(order.machines.map((m) => [m.id, m.bezeichnung]))}
          />
        </>
      )}

      {showRechnung && <EasybillRechnungModal order={order} onClose={() => setShowRechnung(false)} onAngelegt={() => load()} />}
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
