import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../lib/AuthContext'
import { supabase } from '../../lib/supabase'
import { fetchOrder } from '../../lib/queries'
import type { Employee, Machine, OrderWithRelations, Servicebericht, ServiceberichtErsatzteil, ServiceberichtTag } from '../../lib/types'
import { BerichtStatusTag } from '../../components/ui/StatusTag'
import { calcBerichtSpesen, calcBerichtTotals, calcDay } from '../../lib/zeit'
import { hhmm } from '../../lib/format'
import { berichtPdfFilename, buildBerichtPdf, sharePdf, urlToDataUrl } from '../../lib/pdf'
import { useConfirm } from '../../components/ui/ConfirmProvider'
import { useToast } from '../../components/ui/Toast'
import { TagFormModal } from './TagFormModal'
import { ErsatzteilModal } from './ErsatzteilModal'
import { RueckreiseModal } from './RueckreiseModal'
import { RueckreiseNachtragModal } from './RueckreiseNachtragModal'
import { SignView } from './SignView'

export function BerichtDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { employee } = useAuth()
  const confirm = useConfirm()
  const toast = useToast()

  const [bericht, setBericht] = useState<Servicebericht | null>(null)
  const [order, setOrder] = useState<OrderWithRelations | null>(null)
  const [tage, setTage] = useState<ServiceberichtTag[]>([])
  const [ersatzteile, setErsatzteile] = useState<ServiceberichtErsatzteil[]>([])
  const [machine, setMachine] = useState<Machine | null>(null)
  const [techniker, setTechniker] = useState<Employee | null>(null)
  const [hasNachtrag, setHasNachtrag] = useState(false)

  const [mode, setMode] = useState<'view' | 'sign'>('view')
  const [showTagForm, setShowTagForm] = useState(false)
  const [showTeilForm, setShowTeilForm] = useState(false)
  const [rueckreiseTag, setRueckreiseTag] = useState<ServiceberichtTag | null>(null)
  const [showRueckreiseNachtrag, setShowRueckreiseNachtrag] = useState(false)
  const [downloadingPdf, setDownloadingPdf] = useState(false)
  const [sharingPdf, setSharingPdf] = useState(false)
  const canShareFiles = typeof navigator !== 'undefined' && 'canShare' in navigator && (() => {
    try { return navigator.canShare({ files: [new File([], 'x.pdf', { type: 'application/pdf' })] }) } catch { return false }
  })()

  async function load() {
    if (!id) return
    const { data: b } = await supabase.from('serviceberichte').select('*').eq('id', id).maybeSingle()
    if (!b) { setBericht(null); return }
    setBericht(b)
    const [o, { data: t }, { data: e }, { data: m }, { data: tech }, { data: nachtraege }] = await Promise.all([
      fetchOrder(b.auftrag_id),
      supabase.from('servicebericht_tage').select('*').eq('servicebericht_id', b.id).order('datum'),
      supabase.from('servicebericht_ersatzteile').select('*').eq('servicebericht_id', b.id),
      supabase.from('machines').select('*').eq('id', b.maschine_id).maybeSingle(),
      supabase.from('employees').select('*').eq('id', b.techniker_id).maybeSingle(),
      supabase.from('serviceberichte').select('id').eq('nachtrag_zu', b.id),
    ])
    setOrder(o)
    setTage(t || [])
    setErsatzteile(e || [])
    setMachine(m)
    setTechniker(tech)
    setHasNachtrag((nachtraege || []).length > 0)
  }

  useEffect(() => { load() }, [id])

  if (!bericht || !order) return <div className="text-sm text-ink-soft">Lädt…</div>

  const isOwner = employee?.id === bericht.techniker_id
  const editable = bericht.status === 'offen' && isOwner
  const totals = calcBerichtTotals(tage)
  const spesen = calcBerichtSpesen(tage)
  const letzterTag = tage[tage.length - 1]
  const fruehereRueckreiseFehlt = tage.length > 1 && tage.slice(0, -1).some((t) => !t.rueckreise_bis)
  const letzteRueckreiseFehlt = tage.length > 0 && bericht.status === 'abgeschlossen' && !letzterTag.rueckreise_bis && !hasNachtrag
  const canDeleteBericht = employee?.role === 'Administrator' || employee?.role === 'Disposition' || employee?.role === 'CEO'

  if (mode === 'sign') {
    return (
      <SignView
        bericht={bericht}
        tage={tage}
        ersatzteile={ersatzteile}
        machine={machine || undefined}
        techniker={techniker || undefined}
        order={order}
        onBack={() => setMode('view')}
        onDone={() => navigate(`/auftraege/${order.id}`)}
      />
    )
  }

  async function updateField(field: keyof Servicebericht, value: string | number | null) {
    const payload: Record<string, string | number | null> = {}
    payload[field] = value
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await supabase.from('serviceberichte').update(payload as any).eq('id', bericht!.id)
    if (error) { toast('Fehler: ' + error.message); return }
    setBericht((prev) => (prev ? { ...prev, [field]: value } : prev))
  }

  async function deleteTag(tagId: string) {
    const ok = await confirm({ message: 'Diesen Tag wirklich löschen?', danger: true, confirmLabel: 'Löschen' })
    if (!ok) return
    const { error } = await supabase.from('servicebericht_tage').delete().eq('id', tagId)
    if (error) { toast('Fehler: ' + error.message); return }
    load()
  }

  async function deleteTeil(teilId: string) {
    const ok = await confirm({ message: 'Dieses Ersatzteil wirklich löschen?', danger: true, confirmLabel: 'Löschen' })
    if (!ok) return
    const { error } = await supabase.from('servicebericht_ersatzteile').delete().eq('id', teilId)
    if (error) { toast('Fehler: ' + error.message); return }
    load()
  }

  async function buildPdfForDownload() {
    if (!bericht || !order) return null
    const [techDataUrl, kundeDataUrl] = await Promise.all([
      bericht.techniker_unterschrift_url ? urlToDataUrl(bericht.techniker_unterschrift_url) : Promise.resolve(null),
      bericht.kunde_unterschrift_url ? urlToDataUrl(bericht.kunde_unterschrift_url) : Promise.resolve(null),
    ])
    return buildBerichtPdf({
      bericht, tage, ersatzteile, machine: machine || undefined, techniker: techniker || undefined, order,
      technikerSignatureDataUrl: techDataUrl,
      kundeSignatureDataUrl: kundeDataUrl,
    })
  }

  async function handleDownloadPdf() {
    if (!bericht) return
    setDownloadingPdf(true)
    try {
      const pdf = await buildPdfForDownload()
      pdf?.save(berichtPdfFilename(bericht))
    } catch (e) {
      toast(e instanceof Error ? e.message : 'PDF konnte nicht erzeugt werden.')
    } finally {
      setDownloadingPdf(false)
    }
  }

  async function handleSharePdf() {
    if (!bericht) return
    setSharingPdf(true)
    try {
      const pdf = await buildPdfForDownload()
      if (!pdf) return
      const result = await sharePdf(pdf, berichtPdfFilename(bericht), `Servicebericht ${bericht.bericht_nummer}`, `Servicebericht ${bericht.bericht_nummer} für Auftrag #${order?.id}`)
      if (result === 'unsupported') toast('Teilen wird auf diesem Gerät nicht unterstützt — bitte stattdessen herunterladen.')
      else if (result === 'error') toast('Teilen fehlgeschlagen.')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'PDF konnte nicht erzeugt werden.')
    } finally {
      setSharingPdf(false)
    }
  }

  async function handleDeleteBericht() {
    if (!bericht || !order) return
    const ok = await confirm({ message: `Servicebericht ${bericht.bericht_nummer} wirklich unwiderruflich löschen?`, danger: true, confirmLabel: 'Löschen' })
    if (!ok) return
    const { error } = await supabase.from('serviceberichte').delete().eq('id', bericht.id)
    if (error) {
      toast(error.code === '23503' ? 'Dieser Bericht hat einen Nachtrag — bitte zuerst den Nachtrag löschen.' : 'Fehler: ' + error.message)
      return
    }
    toast('Servicebericht gelöscht.')
    navigate(`/auftraege/${order.id}`)
  }

  async function markAbgerechnet() {
    const ok = await confirm({ message: `Servicebericht für ${machine?.bezeichnung || ''} wirklich als abgerechnet markieren?` })
    if (!ok) return
    const { error } = await supabase.from('serviceberichte').update({ abgerechnet: true }).eq('id', bericht!.id)
    if (error) { toast('Fehler: ' + error.message); return }
    toast('Servicebericht als abgerechnet markiert.')
    load()
  }

  return (
    <div>
      <button className="text-sm text-steel bg-transparent border-none cursor-pointer p-0 mb-4" onClick={() => navigate(`/auftraege/${order.id}`)}>← Zurück zu Auftrag #{order.id}</button>

      <div className="flex items-start justify-between gap-4 flex-wrap mb-4 card p-4">
        <div>
          <div className="text-lg font-semibold text-amber">{machine?.bezeichnung || bericht.maschine_id}</div>
          <div className="font-semibold">Auftrag #{order.id} · {techniker?.name || '–'}</div>
          <div className="font-mono text-xs text-ink-soft">{bericht.bericht_nummer}</div>
        </div>
        <div className="flex items-center gap-2">
          <BerichtStatusTag status={bericht.status} abgerechnet={bericht.abgerechnet} />
          {canDeleteBericht && <button className="btn btn-danger btn-sm" onClick={handleDeleteBericht}>Löschen</button>}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3.5 mb-3.5 max-sm:grid-cols-1">
        <div>
          <label>Betriebsstunden</label>
          <input type="number" disabled={!editable} defaultValue={bericht.betriebsstunden ?? ''} onBlur={(e) => updateField('betriebsstunden', e.target.value ? parseInt(e.target.value) : null)} />
        </div>
        <div>
          <label>Spindelstunden</label>
          <input type="number" disabled={!editable} defaultValue={bericht.spindelstunden ?? ''} onBlur={(e) => updateField('spindelstunden', e.target.value ? parseInt(e.target.value) : null)} />
        </div>
      </div>
      <div className="mb-3.5"><label>Fehlerbeschreibung</label><textarea rows={2} disabled={!editable} defaultValue={bericht.fehlerbeschreibung || ''} onBlur={(e) => updateField('fehlerbeschreibung', e.target.value)} /></div>
      <div className="mb-3.5"><label>Durchgeführte Arbeiten</label><textarea rows={2} disabled={!editable} defaultValue={bericht.durchgefuehrte_arbeiten || ''} onBlur={(e) => updateField('durchgefuehrte_arbeiten', e.target.value)} /></div>
      <div className="mb-3.5"><label>Empfehlung</label><textarea rows={2} disabled={!editable} defaultValue={bericht.empfehlung || ''} onBlur={(e) => updateField('empfehlung', e.target.value)} /></div>

      <div className="flex items-center gap-2 mt-5 mb-1">
        <div className="font-semibold text-sm uppercase tracking-wide text-ink-soft">Tageserfassung</div>
        {editable && <button className="btn btn-outline btn-sm" onClick={() => setShowTagForm(true)}>+ Tag erfassen</button>}
      </div>
      {bericht.status === 'offen' && fruehereRueckreiseFehlt && (
        <div className="border border-red p-2.5 text-sm text-red mb-2.5">Bei einem früheren Tag fehlt noch die Rückreise. Bitte zuerst ergänzen — erst beim letzten Tag darf sie noch offen sein.</div>
      )}
      {tage.length === 0 ? (
        <div className="text-sm text-ink-soft border border-dashed border-line p-4 text-center mb-4">Noch keine Tage erfasst.</div>
      ) : (
        <div className="flex flex-col gap-1.5 mb-4">
          {tage.map((tag) => {
            const d = calcDay(tag)
            const feiertag = d.arbeitZuschlag100 > 0 || d.reiseZuschlag100 > 0
            const samstag = !feiertag && (d.arbeitZuschlag50 > 0 || d.reiseZuschlag50 > 0) && d.arbeitNormal === 0 && d.reiseNormal === 0
            const zuschlagText = feiertag
              ? `${d.arbeitZuschlag100 ? `${d.arbeitZuschlag100}h Arbeit à 200%` : ''}${d.reiseZuschlag100 ? ` · ${d.reiseZuschlag100}h Reise à 200%` : ''}`
              : samstag
              ? `${d.arbeitZuschlag50 ? `${d.arbeitZuschlag50}h Arbeit à 150%` : ''}${d.reiseZuschlag50 ? ` · ${d.reiseZuschlag50}h Reise à 150%` : ''}`
              : `${d.arbeitNormal}h Arbeit${d.arbeitZuschlag50 ? ` + ${d.arbeitZuschlag50}h à 150%` : ''} · ${d.reiseNormal}h Reise${d.reiseZuschlag50 ? ` + ${d.reiseZuschlag50}h à 150%` : ''}`
            const datumDE = tag.datum.split('-').reverse().join('.')
            return (
              <div key={tag.id} className="card p-3 flex items-center justify-between gap-3 flex-wrap text-sm">
                <div>
                  <span className="font-semibold">{datumDE}</span>
                  {feiertag && <span className="tag tag-unterwegs ml-1.5">Sonn-/Feiertag</span>}
                  {samstag && <span className="tag tag-arbeit ml-1.5">Samstag</span>}
                  {' '}· Hinreise ab {hhmm(tag.hinreise_von) || '–'}{tag.km_hin ? ` (${tag.km_hin} km)` : ''} · Arbeit {hhmm(tag.arbeitsbeginn) || '–'}–{hhmm(tag.arbeitsende) || '–'} · zurück bis {hhmm(tag.rueckreise_bis) || '– noch offen –'}{tag.km_rueck ? ` (${tag.km_rueck} km)` : ''}
                  {tag.pause_von && ` · Pause ${hhmm(tag.pause_von)}–${hhmm(tag.pause_bis)}`}
                  {tag.uebernachtung && ` · 🏨 Übernachtung${tag.hotelkosten ? ` (${tag.hotelkosten.toFixed(2)} €)` : ''}`}
                </div>
                <div className="text-ink-soft text-xs">{zuschlagText}</div>
                {editable && (
                  <div className="flex gap-1.5">
                    <button className="btn btn-outline btn-sm" onClick={() => setRueckreiseTag(tag)}>{tag.rueckreise_bis ? 'Rückreise ändern' : 'Rückreise nachtragen'}</button>
                    <button className="btn btn-danger btn-sm" onClick={() => deleteTag(tag.id)}>Löschen</button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      <div className="flex items-center gap-2 mb-1">
        <div className="font-semibold text-sm uppercase tracking-wide text-ink-soft">Ersatzteile</div>
        {editable && <button className="btn btn-outline btn-sm" onClick={() => setShowTeilForm(true)}>+ Ersatzteil</button>}
      </div>
      {ersatzteile.length === 0 ? (
        <div className="text-sm text-ink-soft border border-dashed border-line p-4 text-center mb-4">Keine Ersatzteile erfasst.</div>
      ) : (
        <div className="flex flex-col gap-1.5 mb-4">
          {ersatzteile.map((t) => (
            <div key={t.id} className="card p-3 flex items-center justify-between gap-3 text-sm">
              <div><span className="font-semibold">{t.id_nummer}</span> · {t.bezeichnung} · {t.menge} Stk</div>
              {editable && <button className="btn btn-danger btn-sm" onClick={() => deleteTeil(t.id)}>Löschen</button>}
            </div>
          ))}
        </div>
      )}

      <div className="border border-line bg-paper-2 p-3 grid grid-cols-2 gap-2 text-sm mt-4">
        <div><b>{totals.arbeitNormal} h</b> Arbeit normal</div>
        <div><b>{totals.arbeitZuschlag50} h</b> Arbeit +50%</div>
        {totals.arbeitZuschlag100 > 0 && <div><b>{totals.arbeitZuschlag100} h</b> Arbeit +100% (Sonn-/Feiertag)</div>}
        <div><b>{totals.reiseNormal} h</b> Reise normal</div>
        <div><b>{totals.reiseZuschlag50} h</b> Reise +50%</div>
        {totals.reiseZuschlag100 > 0 && <div><b>{totals.reiseZuschlag100} h</b> Reise +100% (Sonn-/Feiertag)</div>}
        <div><b>{totals.gesamt} h</b> Gesamt</div>
      </div>
      {tage.length > 0 && (
        <div className="border border-line bg-paper-2 p-3 grid grid-cols-3 gap-2 text-sm mt-2">
          <div><b>{spesen.verpflegungGesamt.toFixed(2)} €</b> Verpflegungsmehraufwand</div>
          <div><b>{spesen.hotelGesamt.toFixed(2)} €</b> Hotelkosten</div>
          <div><b>{spesen.gesamt.toFixed(2)} €</b> Spesen gesamt</div>
        </div>
      )}

      {editable && (
        <div className="mt-5 flex items-center gap-3 flex-wrap">
          <button className="btn btn-amber" disabled={!tage.length || fruehereRueckreiseFehlt} onClick={() => setMode('sign')}>Servicebericht abschließen</button>
          {letzteRueckreiseFehlt && <span className="text-ink-soft text-xs">— Rückreise des letzten Tages darf dabei noch offen sein.</span>}
        </div>
      )}
      {bericht.status === 'abgeschlossen' && (
        <div className="border border-green p-3 text-sm mt-4 flex items-center justify-between gap-3 flex-wrap">
          <span>✓ Abgeschlossen am {bericht.abgeschlossen_am ? new Date(bericht.abgeschlossen_am).toLocaleString('de-DE') : '–'} · Techniker und Kunde haben unterschrieben.</span>
          <div className="flex gap-2 flex-wrap">
            {canShareFiles && <button className="btn btn-amber btn-sm" disabled={sharingPdf} onClick={handleSharePdf}>{sharingPdf ? 'Öffne Teilen…' : '📤 Teilen / E-Mail'}</button>}
            <button className="btn btn-outline btn-sm" disabled={downloadingPdf} onClick={handleDownloadPdf}>{downloadingPdf ? 'Erzeuge PDF…' : 'PDF herunterladen'}</button>
          </div>
        </div>
      )}
      {bericht.status === 'abgeschlossen' && letzteRueckreiseFehlt && isOwner && (
        <div className="border border-amber p-3 text-sm mt-3 flex items-center gap-2 flex-wrap">
          Die Rückreise des letzten Tages ({letzterTag.datum.split('-').reverse().join('.')}) fehlt noch.
          <button className="btn btn-amber btn-sm" onClick={() => setShowRueckreiseNachtrag(true)}>Rückreise eintragen</button>
        </div>
      )}
      {bericht.status === 'abgeschlossen' && hasNachtrag && (
        <div className="border border-line bg-paper-2 p-3 text-sm mt-3">✓ Die Rückreise wurde bereits über einen Nachtrags-Bericht erfasst.</div>
      )}
      {bericht.status === 'abgeschlossen' && !bericht.abgerechnet && employee?.role !== 'Techniker' && (
        <div className="mt-3"><button className="btn btn-outline btn-sm" onClick={markAbgerechnet}>Als abgerechnet markieren</button></div>
      )}

      {showTagForm && <TagFormModal berichtId={bericht.id} onClose={() => setShowTagForm(false)} onSaved={() => { setShowTagForm(false); load() }} />}
      {showTeilForm && <ErsatzteilModal berichtId={bericht.id} onClose={() => setShowTeilForm(false)} onSaved={() => { setShowTeilForm(false); load() }} />}
      {rueckreiseTag && <RueckreiseModal tag={rueckreiseTag} onClose={() => setRueckreiseTag(null)} onSaved={() => { setRueckreiseTag(null); load() }} />}
      {showRueckreiseNachtrag && letzterTag && (
        <RueckreiseNachtragModal bericht={bericht} letzterTag={letzterTag} onClose={() => setShowRueckreiseNachtrag(false)} onSaved={() => { setShowRueckreiseNachtrag(false); load() }} />
      )}
    </div>
  )
}
