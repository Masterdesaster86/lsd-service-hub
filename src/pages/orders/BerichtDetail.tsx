import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../lib/AuthContext'
import { supabase } from '../../lib/supabase'
import { fetchOrder, fetchTageskontext } from '../../lib/queries'
import type { Employee, Machine, Messprotokoll, OrderWithRelations, Servicebericht, ServiceberichtErsatzteil, ServiceberichtTag, Wartungsprotokoll } from '../../lib/types'
import { MessprotokollListe } from '../messprotokoll/MessprotokollListe'
import { WartungsprotokollListe } from '../wartung/WartungsprotokollListe'
import { Icon } from '../../components/ui/Icon'
import { Typenschild } from '../../components/ui/Typenschild'
import { BerichtStatusTag } from '../../components/ui/StatusTag'
import { WOCHENTAGE, calcBerichtSpesen, calcBerichtTotalsMitKontext, calcTagMitKontext, istSamstag, istSonnOderFeiertag, type Tageskontext } from '../../lib/zeit'
import { hhmm } from '../../lib/format'
import { berichtPdfFilename, buildBerichtPdf, sharePdf, urlToDataUrl } from '../../lib/pdf'
import { adresseInZwischenablage, berichtMailBetreff, berichtMailText, berichtMailtoUrl } from '../../lib/berichtMail'
import { useConfirm } from '../../components/ui/ConfirmProvider'
import { useToast } from '../../components/ui/Toast'
import { TagFormModal } from './TagFormModal'
import { ErsatzteilModal } from './ErsatzteilModal'
import { NeuesMessprotokollModal } from '../messprotokoll/NeuesMessprotokollModal'
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
  const [tageskontext, setTageskontext] = useState<Tageskontext>({})
  const [ersatzteile, setErsatzteile] = useState<ServiceberichtErsatzteil[]>([])
  const [machine, setMachine] = useState<Machine | null>(null)
  const [techniker, setTechniker] = useState<Employee | null>(null)
  const [hasNachtrag, setHasNachtrag] = useState(false)
  const [messprotokolle, setMessprotokolle] = useState<Messprotokoll[]>([])
  const [wartungsprotokolle, setWartungsprotokolle] = useState<Wartungsprotokoll[]>([])
  const [legeWartungAn, setLegeWartungAn] = useState(false)

  const [mode, setMode] = useState<'view' | 'sign'>('view')
  const [showTagForm, setShowTagForm] = useState(false)
  const [showTeilForm, setShowTeilForm] = useState(false)
  const [showMessprotokollForm, setShowMessprotokollForm] = useState(false)
  const [editTag, setEditTag] = useState<ServiceberichtTag | null>(null)
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
    const [o, { data: t }, { data: e }, { data: m }, { data: tech }, { data: nachtraege }, { data: mp }, { data: wp }] = await Promise.all([
      fetchOrder(b.auftrag_id),
      supabase.from('servicebericht_tage').select('*').eq('servicebericht_id', b.id).order('datum'),
      supabase.from('servicebericht_ersatzteile').select('*').eq('servicebericht_id', b.id),
      supabase.from('machines').select('*').eq('id', b.maschine_id).maybeSingle(),
      supabase.from('employees').select('*').eq('id', b.techniker_id).maybeSingle(),
      supabase.from('serviceberichte').select('id').eq('nachtrag_zu', b.id),
      supabase.from('messprotokolle').select('*').eq('servicebericht_id', b.id).order('erstellt_am'),
      supabase.from('wartungsprotokolle').select('*').eq('servicebericht_id', b.id).order('erstellt_am'),
    ])
    setMessprotokolle(mp || [])
    setWartungsprotokolle(wp || [])
    setOrder(o)
    setTage(t || [])
    setErsatzteile(e || [])
    setMachine(m)
    setTechniker(tech)
    setHasNachtrag((nachtraege || []).length > 0)
    // Für die korrekte 10h-Schwelle: auch die Zeiten anderer Serviceberichte
    // desselben Technikers an denselben Kalendertagen laden (z.B. wenn an
    // einem Tag mehrere Maschinen bearbeitet wurden).
    setTageskontext(await fetchTageskontext(b.techniker_id, (t || []).map((x) => x.datum)))
  }

  useEffect(() => { load() }, [id])

  if (!bericht || !order) return <div className="text-sm text-ink-soft">Lädt…</div>

  const isOwner = employee?.id === bericht.techniker_id
  const editable = bericht.status === 'offen' && isOwner
  const totals = calcBerichtTotalsMitKontext(tage, tageskontext)
  const spesen = calcBerichtSpesen(tage)
  const letzterTag = tage[tage.length - 1]
  // Die Rückreise darf per Nachtrag ergänzt werden, solange der Bericht nicht abgerechnet ist.
  const letzteRueckreiseFehlt = tage.length > 0 && bericht.status === 'abgeschlossen' && !bericht.abgerechnet && !letzterTag.rueckreise_bis && !hasNachtrag
  const canDeleteBericht = employee?.role === 'Administrator' || employee?.role === 'Disposition' || employee?.role === 'CEO'

  if (mode === 'sign') {
    return (
      <SignView
        bericht={bericht}
        tage={tage}
        tageskontext={tageskontext}
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
      bericht, tage, tageskontext, ersatzteile, machine: machine || undefined, techniker: techniker || undefined, order,
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
      if (!order) return
      // Adresse vor dem Teilen-Dialog kopieren — danach lässt Safari keinen
      // Zugriff auf die Zwischenablage mehr zu.
      const kopiert = await adresseInZwischenablage(order.ansprechpartner?.email)
      const result = await sharePdf(
        pdf,
        berichtPdfFilename(bericht),
        berichtMailBetreff(order, bericht),
        berichtMailText(order, bericht),
      )
      if (result === 'unsupported') toast('Teilen wird auf diesem Gerät nicht unterstützt — bitte stattdessen herunterladen.')
      else if (result === 'error') toast('Teilen fehlgeschlagen.')
      else if (result === 'shared' && kopiert) toast('Geteilt. Die E-Mail-Adresse liegt in der Zwischenablage — im Empfängerfeld einfügen.')
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

  const h = (n: number) => `${(Math.round(n * 100) / 100).toLocaleString('de-DE')} h`
  const euro = (n: number) => `${n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`

  return (
    <div>
      <button className="btn btn-outline btn-sm mb-4" onClick={() => navigate(`/auftraege/${order.id}`)}><Icon name="zurueck" size={18} /> Auftrag #{order.id}</button>

      <p className="eyebrow">Servicebericht</p>
      <div className="flex items-start justify-between gap-3">
        <h1>{bericht.bericht_nummer}</h1>
        <BerichtStatusTag status={bericht.status} abgerechnet={employee?.role !== 'Techniker' && bericht.abgerechnet} />
      </div>
      <div className="font-semibold text-[17px] leading-snug mt-1.5">{machine?.bezeichnung || bericht.maschine_id}</div>
      <div className="text-ink-soft text-[14px] mb-5">{order.einsatzkunde?.name || '–'} · {techniker?.name || '–'}</div>

      <div className="grid grid-cols-2 gap-3 mb-3.5">
        <div>
          <label>Betriebsstunden</label>
          <input type="number" inputMode="numeric" className="font-mono" disabled={!editable} defaultValue={bericht.betriebsstunden ?? ''} onBlur={(e) => updateField('betriebsstunden', e.target.value ? parseInt(e.target.value) : null)} />
        </div>
        <div>
          <label>Spindelstunden</label>
          <input type="number" inputMode="numeric" className="font-mono" disabled={!editable} defaultValue={bericht.spindelstunden ?? ''} onBlur={(e) => updateField('spindelstunden', e.target.value ? parseInt(e.target.value) : null)} />
        </div>
      </div>
      <div className="mb-3.5"><label>Fehlerbeschreibung</label><textarea rows={3} disabled={!editable} defaultValue={bericht.fehlerbeschreibung || ''} onBlur={(e) => updateField('fehlerbeschreibung', e.target.value)} /></div>
      <div className="mb-3.5"><label>Durchgeführte Arbeiten</label><textarea rows={4} disabled={!editable} defaultValue={bericht.durchgefuehrte_arbeiten || ''} onBlur={(e) => updateField('durchgefuehrte_arbeiten', e.target.value)} /></div>
      <div className="mb-3.5"><label>Empfehlung</label><textarea rows={2} disabled={!editable} defaultValue={bericht.empfehlung || ''} onBlur={(e) => updateField('empfehlung', e.target.value)} /></div>

      {/* ------------------------------------------------ Tageserfassung */}
      <div className="flex items-center justify-between gap-2 mt-7 mb-2">
        <div className="abschnitt">Tageserfassung</div>
        <span className="font-mono text-[13px] font-semibold">{h(totals.gesamt)}</span>
      </div>
      {tage.length === 0 ? (
        <div className="text-sm text-ink-soft border border-dashed border-line p-4 text-center mb-2">Noch keine Tage erfasst.</div>
      ) : (
        <div className="flex flex-col gap-2 mb-2">
          {tage.map((tag) => {
            const d = calcTagMitKontext(tag, tageskontext[tag.datum] || [tag])
            // Anhand des echten Datums bestimmen, nicht daran, ob zufällig
            // 0h normal rauskommt — das passiert bei einem ganz normalen
            // Werktag genauso, sobald die 10h-Schwelle schon durch einen
            // früheren Bericht desselben Tages aufgebraucht ist.
            const feiertag = istSonnOderFeiertag(tag.datum)
            const samstag = !feiertag && istSamstag(tag.datum)
            const zuschlagText = feiertag
              ? `${d.arbeitZuschlag100 ? `${h(d.arbeitZuschlag100)} Arbeit à 200%` : ''}${d.reiseZuschlag100 ? ` · ${h(d.reiseZuschlag100)} Reise à 200%` : ''}`
              : samstag
              ? `${d.arbeitZuschlag50 ? `${h(d.arbeitZuschlag50)} Arbeit à 150%` : ''}${d.reiseZuschlag50 ? ` · ${h(d.reiseZuschlag50)} Reise à 150%` : ''}`
              : `${h(d.arbeitNormal)} Arbeit${d.arbeitZuschlag50 ? ` + ${h(d.arbeitZuschlag50)} à 150%` : ''} · ${h(d.reiseNormal)} Reise${d.reiseZuschlag50 ? ` + ${h(d.reiseZuschlag50)} à 150%` : ''}`
            const datum = new Date(`${tag.datum}T00:00:00`)
            const datumDE = `${WOCHENTAGE[datum.getDay()]}, ${tag.datum.split('-').reverse().join('.')}`
            return (
              <div key={tag.id} className="card p-3.5">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-mono font-semibold text-[14px]">{datumDE}</span>
                    {feiertag && <span className="tag tag-voll">Sonn-/Feiertag</span>}
                    {samstag && <span className="tag tag-voll">Samstag</span>}
                    {bericht.ist_nachtrag && <span className="tag tag-gestrichelt">Nachtrag</span>}
                  </div>
                  <span className="font-mono font-semibold text-[15px]">{h(d.gesamt)}</span>
                </div>
                <div className="grid grid-cols-[1fr_1.45fr_1fr] gap-px bg-line border border-line mt-2.5">
                  {([
                    ['Hinreise', hhmm(tag.hinreise_von) || '–', tag.km_hin ? `${tag.km_hin} km` : ''],
                    ['Arbeit', `${hhmm(tag.arbeitsbeginn) || '–'}–${hhmm(tag.arbeitsende) || '–'}`, tag.pause_von ? `Pause ${hhmm(tag.pause_von)}–${hhmm(tag.pause_bis)}` : ''],
                    ['Rückreise', hhmm(tag.rueckreise_bis) || 'offen', tag.km_rueck ? `${tag.km_rueck} km` : ''],
                  ] as const).map(([label, wert, zusatz]) => (
                    <div key={label} className="bg-white px-2 py-2 min-w-0">
                      <div className="font-mono text-[10.5px] uppercase tracking-[0.06em] text-ink-soft">{label}</div>
                      <div className={`font-mono text-[14px] font-semibold ${wert === 'offen' ? 'text-ink-soft font-normal' : ''}`}>{wert}</div>
                      {zusatz && <div className="font-mono text-[11.5px] text-ink-soft">{zusatz}</div>}
                    </div>
                  ))}
                </div>
                <div className="text-[13px] text-ink-soft mt-2">
                  {zuschlagText}
                  {tag.uebernachtung && <> · Übernachtung{tag.hotelkosten ? ` (${euro(tag.hotelkosten)})` : ''}</>}
                </div>
                {editable && (
                  <div className="grid grid-cols-2 gap-2 mt-3">
                    <button className="btn btn-outline btn-sm" onClick={() => setEditTag(tag)}><Icon name="bearbeiten" size={16} /> Bearbeiten</button>
                    <button className="btn btn-danger btn-sm" onClick={() => deleteTag(tag.id)}><Icon name="loeschen" size={16} /> Löschen</button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
      {editable && (
        <button className="btn btn-outline w-full mb-6" onClick={() => setShowTagForm(true)}><Icon name="hinzufuegen" size={20} /> Tag erfassen</button>
      )}

      {/* ------------------------------------------------ Messprotokoll */}
      <div className="flex items-center justify-between gap-2 mt-6 mb-2">
        <div className="abschnitt">Messprotokoll</div>
        {isOwner && <button className="btn btn-outline btn-sm" onClick={() => setShowMessprotokollForm(true)}><Icon name="hinzufuegen" size={16} /> Messprotokoll</button>}
      </div>
      {messprotokolle.length === 0
        ? <div className="text-sm text-ink-soft mb-4">Noch kein Messprotokoll zu diesem Bericht.</div>
        : <MessprotokollListe protokolle={messprotokolle} />}

      {/* ------------------------------------------------ Wartungsprotokoll */}
      <div className="flex items-center justify-between gap-2 mt-6 mb-2">
        <div className="abschnitt">Wartungsprotokoll</div>
        {isOwner && (
          <button
            className="btn btn-outline btn-sm"
            disabled={legeWartungAn}
            onClick={async () => {
              // Ein offenes Protokoll zu diesem Bericht wird weiter benutzt statt ein zweites anzulegen.
              const offenes = wartungsprotokolle.find((w) => w.status === 'offen')
              if (offenes) { navigate(`/wartungsprotokolle/${offenes.id}`); return }
              if (!employee) return
              setLegeWartungAn(true)
              const { data, error } = await supabase
                .from('wartungsprotokolle')
                .insert({ auftrag_id: order.id, maschine_id: bericht.maschine_id, servicebericht_id: bericht.id, techniker_id: employee.id })
                .select('id')
                .single()
              setLegeWartungAn(false)
              if (error || !data) { toast('Fehler beim Anlegen: ' + error?.message); return }
              navigate(`/wartungsprotokolle/${data.id}`)
            }}
          >
            <Icon name="hinzufuegen" size={16} /> Wartungsprotokoll
          </button>
        )}
      </div>
      {wartungsprotokolle.length === 0
        ? <div className="text-sm text-ink-soft mb-4">Noch kein Wartungsprotokoll zu diesem Bericht.</div>
        : <WartungsprotokollListe protokolle={wartungsprotokolle} />}

      {/* ------------------------------------------------ Ersatzteile */}
      <div className="flex items-center justify-between gap-2 mt-6 mb-2">
        <div className="abschnitt">Ersatzteile</div>
        {editable && <button className="btn btn-outline btn-sm" onClick={() => setShowTeilForm(true)}><Icon name="hinzufuegen" size={16} /> Ersatzteil</button>}
      </div>
      {ersatzteile.length === 0 ? (
        <div className="text-sm text-ink-soft border border-dashed border-line p-4 text-center mb-4">Keine Ersatzteile erfasst.</div>
      ) : (
        <div className="bg-white border border-line mb-4">
          {ersatzteile.map((t) => (
            <div key={t.id} className="flex items-center justify-between gap-3 px-3.5 py-2.5 border-b border-line last:border-b-0">
              <div className="min-w-0">
                <div className="font-medium">{t.bezeichnung}</div>
                <div className="font-mono text-[12.5px] text-ink-soft">{t.id_nummer || '–'}</div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="font-mono font-semibold">{t.menge} Stk</span>
                {editable && (
                  <button className="btn btn-outline btn-sm !px-0 w-10" aria-label="Ersatzteil löschen" onClick={() => deleteTeil(t.id)}><Icon name="loeschen" size={16} /></button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ------------------------------------------------ Summen */}
      <div className="abschnitt mt-6 mb-2">Summen</div>
      <Typenschild
        zeilen={[
          ['Arbeit normal', <span className="font-mono">{h(totals.arbeitNormal)}</span>],
          ['Arbeit +50 %', <span className="font-mono">{h(totals.arbeitZuschlag50)}</span>],
          totals.arbeitZuschlag100 > 0 && ['Arbeit +100 %', <span className="font-mono">{h(totals.arbeitZuschlag100)}</span>],
          ['Reise normal', <span className="font-mono">{h(totals.reiseNormal)}</span>],
          ['Reise +50 %', <span className="font-mono">{h(totals.reiseZuschlag50)}</span>],
          totals.reiseZuschlag100 > 0 && ['Reise +100 %', <span className="font-mono">{h(totals.reiseZuschlag100)}</span>],
          ['Gesamt', <span className="font-mono font-bold">{h(totals.gesamt)}</span>],
          tage.length > 0 && ['Verpflegung', <span className="font-mono">{euro(spesen.verpflegungGesamt)}</span>],
          tage.length > 0 && ['Hotelkosten', <span className="font-mono">{euro(spesen.hotelGesamt)}</span>],
          tage.length > 0 && ['Spesen gesamt', <span className="font-mono font-bold">{euro(spesen.gesamt)}</span>],
        ]}
      />

      {/* ------------------------------------------------ Aktionen */}
      {editable && (
        <div className="mt-6">
          <button className="btn btn-amber w-full" disabled={!tage.length} onClick={() => setMode('sign')}><Icon name="unterschrift" size={20} /> Servicebericht abschließen</button>
          {letzteRueckreiseFehlt && <p className="text-ink-soft text-[13px] mt-2 mb-0">Die Rückreise des letzten Tages darf dabei noch offen sein.</p>}
        </div>
      )}
      {bericht.status === 'abgeschlossen' && (
        <div className="bg-white border border-line p-3.5 mt-6">
          <div className="flex items-center gap-2 font-semibold"><Icon name="erledigt" size={20} /> Abgeschlossen am {bericht.abgeschlossen_am ? new Date(bericht.abgeschlossen_am).toLocaleString('de-DE') : '–'}</div>
          <div className="text-[13.5px] text-ink-soft mt-1">Techniker und Kunde haben unterschrieben.{order.ansprechpartner?.email && <> Ansprechpartner: {order.ansprechpartner.email}</>}</div>
          <div className="grid gap-2 sm:grid-cols-2 mt-3">
            {canShareFiles && <button className="btn btn-amber" disabled={sharingPdf} onClick={handleSharePdf}><Icon name="teilen" size={20} /> {sharingPdf ? 'Öffne Teilen…' : 'Teilen / E-Mail'}</button>}
            <button className="btn btn-outline" disabled={downloadingPdf} onClick={handleDownloadPdf}><Icon name="pdf" size={20} /> {downloadingPdf ? 'Erzeuge PDF…' : 'PDF herunterladen'}</button>
            {order.ansprechpartner?.email && (
              <a
                className="btn btn-outline"
                href={berichtMailtoUrl(order, bericht)}
                onClick={handleDownloadPdf}
                title="Öffnet die E-Mail mit Empfänger, Betreff und Text und lädt das PDF herunter — anhängen musst du es selbst."
              >
                E-Mail mit Empfänger
              </a>
            )}
          </div>
        </div>
      )}
      {bericht.status === 'abgeschlossen' && letzteRueckreiseFehlt && isOwner && (
        <div className="border-2 border-ink bg-white p-3.5 mt-3">
          <div className="text-[14.5px] mb-2.5">Die Rückreise des letzten Tages ({letzterTag.datum.split('-').reverse().join('.')}) fehlt noch.</div>
          <button className="btn btn-amber w-full" onClick={() => setShowRueckreiseNachtrag(true)}>Rückreise eintragen</button>
        </div>
      )}
      {bericht.status === 'abgeschlossen' && hasNachtrag && (
        <div className="border border-line bg-white p-3 text-[14px] mt-3 flex items-center gap-2"><Icon name="erledigt" size={18} /> Die Rückreise wurde bereits über einen Nachtrags-Bericht erfasst.</div>
      )}
      {bericht.status === 'abgeschlossen' && !bericht.abgerechnet && employee?.role !== 'Techniker' && (
        <div className="mt-3"><button className="btn btn-outline w-full" onClick={markAbgerechnet}>Als abgerechnet markieren</button></div>
      )}
      {canDeleteBericht && (
        <div className="mt-6"><button className="btn btn-danger w-full" onClick={handleDeleteBericht}><Icon name="loeschen" size={18} /> Servicebericht löschen</button></div>
      )}

      {showTagForm && <TagFormModal berichtId={bericht.id} onClose={() => setShowTagForm(false)} onSaved={() => { setShowTagForm(false); load() }} />}
      {editTag && <TagFormModal berichtId={bericht.id} tag={editTag} onClose={() => setEditTag(null)} onSaved={() => { setEditTag(null); load() }} />}
      {showMessprotokollForm && (
        <NeuesMessprotokollModal
          auftragId={order.id}
          maschineId={bericht.maschine_id}
          berichtId={bericht.id}
          onClose={() => setShowMessprotokollForm(false)}
          onCreated={(id) => navigate(`/messprotokolle/${id}`)}
        />
      )}
      {showTeilForm && <ErsatzteilModal berichtId={bericht.id} onClose={() => setShowTeilForm(false)} onSaved={() => { setShowTeilForm(false); load() }} />}
      {showRueckreiseNachtrag && letzterTag && (
        <RueckreiseNachtragModal bericht={bericht} letzterTag={letzterTag} onClose={() => setShowRueckreiseNachtrag(false)} onSaved={() => { setShowRueckreiseNachtrag(false); load() }} />
      )}
    </div>
  )
}
