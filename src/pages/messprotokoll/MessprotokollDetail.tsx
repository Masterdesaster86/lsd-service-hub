import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/AuthContext'
import { useConfirm } from '../../components/ui/ConfirmProvider'
import { useToast } from '../../components/ui/Toast'
import { Icon } from '../../components/ui/Icon'
import type { Customer, Employee, Machine, Messprotokoll, Order } from '../../lib/types'
import {
  ERGEBNIS_KEY, MESSPROTOKOLL_TYPEN, alleMesspunkte, bemerkungKey, bewerte, grenzwertMm, messwertZahl, mm,
  type Bewertung, type MessprotokollTyp,
} from '../../lib/messprotokoll'
import { buildMessprotokollPdf, messprotokollPdfFilename } from '../../lib/pdf'
import { formatDateDE } from '../../lib/format'

type Ansicht = { art: 'uebersicht' } | { art: 'messung'; index: number } | { art: 'zusammenfassung' }

const BEWERTUNG_TEXT: Record<Bewertung, string> = {
  offen: 'offen',
  io: 'in Ordnung',
  nio: 'über Toleranz',
  erfasst: 'erfasst',
}

/** Kleines Status-Etikett mit Quadrat — Grün/Rot nur als Zusatz, der Text sagt es. */
function BewertungTag({ b }: { b: Bewertung }) {
  const quadrat =
    b === 'io' ? 'bg-green border-green' : b === 'nio' ? 'bg-red border-red' : b === 'erfasst' ? 'bg-ink border-ink' : 'bg-transparent border-ink-soft'
  return (
    <span className={`inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.06em] whitespace-nowrap ${b === 'nio' ? 'text-red font-semibold' : b === 'offen' ? 'text-ink-soft' : 'text-ink'}`}>
      <span className={`w-2 h-2 border-2 ${quadrat}`} />
      {BEWERTUNG_TEXT[b]}
    </span>
  )
}

export function MessprotokollDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { employee } = useAuth()
  const confirm = useConfirm()
  const toast = useToast()

  const [protokoll, setProtokoll] = useState<Messprotokoll | null>(null)
  const [order, setOrder] = useState<Order | null>(null)
  const [machine, setMachine] = useState<Machine | null>(null)
  const [kunde, setKunde] = useState<Customer | null>(null)
  const [techniker, setTechniker] = useState<Employee | null>(null)
  const [abnehmer, setAbnehmer] = useState('')
  const [ppNummer, setPpNummer] = useState('')
  const [werte, setWerte] = useState<Record<string, string>>({})
  const [ansicht, setAnsicht] = useState<Ansicht>({ art: 'uebersicht' })
  const [saving, setSaving] = useState(false)
  const [downloadingPdf, setDownloadingPdf] = useState(false)
  // Stand der letzten Speicherung — so wird beim Blättern nur gespeichert,
  // wenn sich wirklich etwas geändert hat.
  const gespeichert = useRef('')

  async function load() {
    if (!id) return
    const { data: p } = await supabase.from('messprotokolle').select('*').eq('id', id).maybeSingle()
    if (!p) { setProtokoll(null); return }
    setProtokoll(p)
    setAbnehmer(p.abnehmer || '')
    setPpNummer(p.pp_nummer || '')
    const w = (p.werte as Record<string, string>) || {}
    setWerte(w)
    gespeichert.current = JSON.stringify({ a: p.abnehmer || '', p: p.pp_nummer || '', w })
    const [{ data: o }, { data: m }, { data: tech }] = await Promise.all([
      supabase.from('orders').select('*').eq('id', p.auftrag_id).maybeSingle(),
      supabase.from('machines').select('*').eq('id', p.maschine_id).maybeSingle(),
      supabase.from('employees').select('*').eq('id', p.techniker_id).maybeSingle(),
    ])
    setOrder(o)
    setMachine(m)
    setTechniker(tech)
    if (m) {
      const { data: c } = await supabase.from('customers').select('*').eq('id', m.kunde_id).maybeSingle()
      setKunde(c)
    }
  }

  useEffect(() => { load() }, [id])

  const punkte = useMemo(() => (protokoll ? alleMesspunkte(protokoll.typ as MessprotokollTyp) : []), [protokoll])

  if (!protokoll) return <div className="text-sm text-ink-soft">Lädt…</div>

  const typDef = MESSPROTOKOLL_TYPEN[protokoll.typ as MessprotokollTyp]
  const editable = protokoll.status === 'offen' && employee?.id === protokoll.techniker_id
  const canDelete = employee?.role === 'Administrator' || employee?.role === 'Disposition' || employee?.role === 'CEO'

  const bewertungen = punkte.map((p) => bewerte(p, werte[p.key]))
  const anzahl = (b: Bewertung) => bewertungen.filter((x) => x === b).length
  const erledigt = bewertungen.filter((b) => b !== 'offen').length
  const ersterOffener = bewertungen.findIndex((b) => b === 'offen')

  /** Speichert, wenn sich etwas geändert hat. `leise` = ohne Meldung (beim Blättern). */
  async function speichern(leise: boolean): Promise<boolean> {
    if (!editable) return true
    const stand = JSON.stringify({ a: abnehmer, p: ppNummer, w: werte })
    if (stand === gespeichert.current) { if (!leise) toast('Gespeichert.'); return true }
    setSaving(true)
    const { error } = await supabase.from('messprotokolle').update({
      abnehmer: abnehmer || null,
      pp_nummer: ppNummer || null,
      werte,
    }).eq('id', protokoll!.id)
    setSaving(false)
    if (error) { toast('Fehler beim Speichern: ' + error.message); return false }
    gespeichert.current = stand
    if (!leise) toast('Gespeichert.')
    return true
  }

  async function wechsle(ziel: Ansicht) {
    await speichern(true)
    setAnsicht(ziel)
    document.querySelector('.app-inhalt')?.scrollTo({ top: 0 })
  }

  // Zurück dorthin, wo das Protokoll angelegt wurde: zum Servicebericht, sonst zur Maschine.
  const zurueckZiel = protokoll.servicebericht_id ? `/berichte/${protokoll.servicebericht_id}` : `/maschinen/${protokoll.maschine_id}`
  const zurueckText = protokoll.servicebericht_id ? 'Zum Bericht' : 'Zur Maschine'

  /** Zwischenstand sichern und das Protokoll verlassen — später geht es genau hier weiter. */
  async function schliessen() {
    const ok = await speichern(true)
    if (!ok) return
    if (editable) toast('Gespeichert. Du kannst später weitermachen.')
    navigate(zurueckZiel)
  }

  async function abschliessen() {
    const offen = anzahl('offen')
    const ok = await confirm({
      message: 'Messprotokoll abschließen? Danach lässt es sich nicht mehr ändern.'
        + (offen > 0 ? ` ${offen} Messpunkte sind offen und erscheinen nicht im PDF.` : ''),
    })
    if (!ok) return
    setSaving(true)
    const { error } = await supabase.from('messprotokolle').update({
      abnehmer: abnehmer || null,
      pp_nummer: ppNummer || null,
      werte,
      status: 'abgeschlossen',
      abgeschlossen_am: new Date().toISOString(),
    }).eq('id', protokoll!.id)
    setSaving(false)
    if (error) { toast('Fehler: ' + error.message); return }
    toast('Messprotokoll abgeschlossen.')
    setAnsicht({ art: 'uebersicht' })
    load()
  }

  async function handleDelete() {
    const ok = await confirm({ message: 'Dieses Messprotokoll wirklich unwiderruflich löschen?', danger: true, confirmLabel: 'Löschen' })
    if (!ok) return
    const { error } = await supabase.from('messprotokolle').delete().eq('id', protokoll!.id)
    if (error) { toast('Fehler: ' + error.message); return }
    toast('Messprotokoll gelöscht.')
    navigate(`/maschinen/${protokoll!.maschine_id}`)
  }

  async function handleDownloadPdf() {
    setDownloadingPdf(true)
    try {
      const pdf = await buildMessprotokollPdf({ protokoll: protokoll!, order, machine, kunde, techniker, abnehmer, ppNummer, werte })
      pdf.save(messprotokollPdfFilename(protokoll!))
    } catch (e) {
      toast(e instanceof Error ? e.message : 'PDF konnte nicht erzeugt werden.')
    } finally {
      setDownloadingPdf(false)
    }
  }

  // ---------------------------------------------------------------- Messung
  if (ansicht.art === 'messung') {
    const i = ansicht.index
    const p = punkte[i]
    const wert = werte[p.key] || ''
    const b = bewertungen[i]
    const grenze = grenzwertMm(p.toleranz)
    const zahl = messwertZahl(wert)
    // Balken: Skala bis 1,5 × Grenze (oder bis zum Messwert, wenn der darüber liegt).
    const skala = grenze !== null ? Math.max(grenze * 1.5, zahl !== null ? Math.abs(zahl) : 0) : 0
    const naechster = punkte[i + 1]
    return (
      <div>
        <div className="flex items-center justify-between mb-4">
          <button className="btn btn-outline btn-sm" onClick={() => wechsle({ art: 'uebersicht' })}><Icon name="zurueck" size={18} /> Übersicht</button>
          <span className="flex items-center gap-3">
            <span className="font-mono text-[13px] text-ink-soft">{i + 1} / {punkte.length}</span>
            {editable && <button className="btn btn-outline btn-sm" disabled={saving} onClick={schliessen}>Schließen</button>}
          </span>
        </div>
        <p className="font-mono text-[12px] uppercase tracking-[0.14em] text-amber m-0 mb-2 flex items-center gap-2">
          <span className="inline-block w-[22px] h-0.5 bg-amber" />{p.gruppe}
        </p>
        <h1>Messung {p.nr}</h1>
        <div className="font-semibold text-[17px] mt-2 mb-4 leading-snug">{p.bezeichnung}</div>

        <div className="bg-white border border-line mb-5">
          <div className="grid grid-cols-[minmax(0,9rem)_1fr] gap-3 px-3.5 py-2.5 border-b border-line">
            <span className="font-mono text-[11.5px] uppercase tracking-[0.06em] text-ink-soft">Prüfmittel</span>
            <span className="text-right font-medium">{p.pruefmittel}</span>
          </div>
          <div className="grid grid-cols-[minmax(0,9rem)_1fr] gap-3 px-3.5 py-2.5">
            <span className="font-mono text-[11.5px] uppercase tracking-[0.06em] text-ink-soft">Zulässige Abweichung</span>
            <span className="text-right font-mono font-semibold">{p.toleranz}</span>
          </div>
        </div>

        <label>Gemessen</label>
        <div className={`flex items-center bg-white border-2 ${b === 'nio' ? 'border-red' : 'border-ink'}`}>
          <input
            inputMode="decimal"
            disabled={!editable}
            value={wert}
            onChange={(e) => setWerte((w) => ({ ...w, [p.key]: e.target.value }))}
            placeholder="0,000"
            className="!border-0 !min-h-[64px] !text-[30px] font-mono font-semibold !outline-none flex-1"
            aria-label={`Messwert ${p.nr}`}
          />
          <span className="px-4 font-mono text-[16px] text-ink-soft">mm</span>
        </div>

        {grenze !== null ? (
          <div className="mt-3">
            <div className={`flex items-center justify-between px-3 py-2.5 border ${b === 'nio' ? 'border-red bg-red/5' : b === 'io' ? 'border-green bg-green/5' : 'border-line bg-white'}`}>
              <BewertungTag b={b} />
              <span className="font-mono text-[13px]">{zahl !== null ? mm(Math.abs(zahl)) : '–'} / {mm(grenze)} mm</span>
            </div>
            <div className="relative h-2 bg-line mt-3">
              {zahl !== null && (
                <div className={`absolute left-0 top-0 h-2 ${b === 'nio' ? 'bg-red' : 'bg-green'}`} style={{ width: `${Math.min(100, (Math.abs(zahl) / skala) * 100)}%` }} />
              )}
              <div className="absolute -top-1 w-0.5 h-4 bg-ink" style={{ left: `${(grenze / (skala || grenze * 1.5)) * 100}%` }} />
            </div>
            <div className="flex justify-between font-mono text-[11px] text-ink-soft mt-1">
              <span>0</span><span>zulässig {mm(grenze)}</span>
            </div>
          </div>
        ) : (
          <p className="text-[13.5px] text-ink-soft mt-2.5">
            {p.toleranz === '–' ? 'Maß als Programmierhilfe — keine Toleranz.' : 'Gestaffelte Toleranz — bitte selbst gegen die Angabe prüfen.'}
          </p>
        )}

        <div className="mt-5">
          <label>Bemerkung</label>
          <textarea
            rows={2}
            disabled={!editable}
            value={werte[bemerkungKey(p.key)] || ''}
            onChange={(e) => setWerte((w) => ({ ...w, [bemerkungKey(p.key)]: e.target.value }))}
            placeholder="z. B. nachgestellt, Wiederholungsmessung"
          />
        </div>

        <div className="sticky bottom-0 z-30 -mx-4 md:-mx-6 mt-6 bg-paper border-t border-line px-4 md:px-6 py-3 grid grid-cols-[1fr_2fr] gap-2">
          <button className="btn btn-outline" disabled={saving} onClick={() => wechsle(i > 0 ? { art: 'messung', index: i - 1 } : { art: 'uebersicht' })}>Zurück</button>
          <button className="btn btn-amber" disabled={saving} onClick={() => wechsle(naechster ? { art: 'messung', index: i + 1 } : { art: 'zusammenfassung' })}>
            {naechster ? `Weiter zu ${naechster.nr}` : 'Zusammenfassung'}
          </button>
        </div>
      </div>
    )
  }

  // -------------------------------------------------------- Zusammenfassung
  if (ansicht.art === 'zusammenfassung') {
    const abweichungen = punkte.filter((_, i) => bewertungen[i] === 'nio')
    const offen = anzahl('offen')
    const ohnePruefung = anzahl('erfasst')
    return (
      <div>
        <div className="flex items-center justify-between mb-4">
          <button className="btn btn-outline btn-sm" onClick={() => wechsle({ art: 'uebersicht' })}><Icon name="zurueck" size={18} /> Übersicht</button>
          <span className={`tag ${protokoll.status === 'abgeschlossen' ? 'tag-abgeschlossen' : 'tag-offen'}`}>{protokoll.status === 'abgeschlossen' ? 'Abgeschlossen' : 'Offen'}</span>
        </div>
        <p className="font-mono text-[12px] uppercase tracking-[0.14em] text-amber m-0 mb-2 flex items-center gap-2"><span className="inline-block w-[22px] h-0.5 bg-amber" />Messprotokoll</p>
        <h1 className="mb-4">Zusammenfassung</h1>

        <div className="grid grid-cols-3 border border-line bg-white mb-1">
          {([['io', 'in Ordnung'], ['nio', 'über Toleranz'], ['offen', 'offen']] as [Bewertung, string][]).map(([k, label], idx) => (
            <div key={k} className={`p-3 ${idx > 0 ? 'border-l border-line' : ''}`}>
              <div className={`text-[40px] font-extrabold leading-none ${k === 'nio' && anzahl('nio') > 0 ? 'text-red' : ''}`} style={{ fontFamily: 'var(--font-display)' }}>{anzahl(k)}</div>
              <div className="font-mono text-[11px] uppercase tracking-[0.06em] text-ink-soft mt-1.5">{label}</div>
            </div>
          ))}
        </div>
        {ohnePruefung > 0 && <p className="text-[13px] text-ink-soft mt-1.5 mb-0">Dazu {ohnePruefung} erfasste Werte ohne automatische Prüfung (gestaffelte Toleranz oder Maß).</p>}

        <div className="font-mono text-[12px] uppercase tracking-[0.1em] text-ink-soft mt-6 mb-2">Abweichungen</div>
        {abweichungen.length === 0 ? (
          <div className="text-sm text-ink-soft border border-dashed border-line p-4 text-center">Keine Abweichungen über Toleranz.</div>
        ) : (
          <div className="flex flex-col gap-2">
            {abweichungen.map((p) => (
              <button
                key={p.key}
                onClick={() => wechsle({ art: 'messung', index: punkte.indexOf(p) })}
                className="w-full text-left bg-white border border-red border-l-4 p-3 flex items-center gap-3 cursor-pointer"
              >
                <span className="font-mono font-semibold text-red w-10 shrink-0">{p.nr}</span>
                <span className="flex-1 font-medium leading-snug">{p.bezeichnung}</span>
                <span className="font-mono text-[13px] text-red shrink-0">{mm(Math.abs(messwertZahl(werte[p.key])!))} / {mm(grenzwertMm(p.toleranz)!)}</span>
              </button>
            ))}
          </div>
        )}

        {offen > 0 && (
          <div className="border border-ink bg-white p-3 mt-4 text-[14px]">
            <b>{offen} {offen === 1 ? 'Messpunkt' : 'Messpunkte'} offen.</b> Offene Punkte erscheinen nicht im PDF.
          </div>
        )}

        <div className="mt-5">
          <label>Ergebnis / Bemerkung zum Protokoll</label>
          <textarea
            rows={3}
            disabled={!editable}
            value={werte[ERGEBNIS_KEY] || ''}
            onChange={(e) => setWerte((w) => ({ ...w, [ERGEBNIS_KEY]: e.target.value }))}
            placeholder="z. B. Maschine nach Spindeltausch geometrisch in Ordnung"
          />
        </div>

        {editable ? (
          <div className="grid grid-cols-2 gap-2 mt-5">
            <button className="btn btn-outline" disabled={saving} onClick={() => speichern(false)}>Speichern</button>
            <button className="btn btn-amber" disabled={saving} onClick={abschliessen}><Icon name="erledigt" size={20} /> Abschließen</button>
          </div>
        ) : protokoll.status === 'abgeschlossen' && (
          <button className="btn btn-amber w-full mt-5" disabled={downloadingPdf} onClick={handleDownloadPdf}>{downloadingPdf ? 'Erzeuge PDF…' : 'PDF herunterladen'}</button>
        )}
      </div>
    )
  }

  // --------------------------------------------------------------- Übersicht
  const kopf: [string, ReactNode][] = [
    ['Typ', typDef.label],
    ['Maschine', machine?.bezeichnung || '–'],
    ['Maschinennummer', machine?.nummer || '–'],
    ['Kunde', kunde?.name || '–'],
    ['Techniker', techniker?.name || '–'],
    ['Auftrag', `#${order?.id || protokoll.auftrag_id}`],
    ['Datum', formatDateDE(protokoll.erstellt_am?.slice(0, 10))],
  ]

  return (
    <div>
      <button className="btn btn-outline btn-sm mb-4" disabled={saving} onClick={schliessen}><Icon name="zurueck" size={18} /> {zurueckText}</button>

      <div className="flex items-start justify-between gap-3 mb-1">
        <p className="font-mono text-[12px] uppercase tracking-[0.14em] text-amber m-0 flex items-center gap-2"><span className="inline-block w-[22px] h-0.5 bg-amber" />Messprotokoll</p>
        <span className={`tag ${protokoll.status === 'abgeschlossen' ? 'tag-abgeschlossen' : 'tag-offen'}`}>{protokoll.status === 'abgeschlossen' ? 'Abgeschlossen' : 'Offen'}</span>
      </div>
      <h1 className="mb-4">{typDef.label}</h1>

      <div className="bg-white border border-line mb-4">
        {kopf.map(([label, wert]) => (
          <div key={label} className="grid grid-cols-[minmax(0,9rem)_1fr] gap-3 px-3.5 py-2.5 border-b border-line last:border-b-0">
            <span className="font-mono text-[11.5px] uppercase tracking-[0.06em] text-ink-soft">{label}</span>
            <span className="text-right font-medium">{wert}</span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 mb-5 max-sm:grid-cols-1">
        <div>
          <label>Abnehmer</label>
          <input type="text" disabled={!editable} value={abnehmer} onChange={(e) => setAbnehmer(e.target.value)} placeholder="Name beim Kunden" />
        </div>
        <div>
          <label>PP-Nr. / Projektnummer</label>
          <input type="text" disabled={!editable} value={ppNummer} onChange={(e) => setPpNummer(e.target.value)} placeholder="optional" />
        </div>
      </div>

      <div className="bg-white border border-line p-4 mb-6">
        <div className="flex items-baseline justify-between gap-3">
          <div>
            <span className="text-[38px] font-extrabold leading-none" style={{ fontFamily: 'var(--font-display)' }}>{erledigt}</span>
            <span className="text-ink-soft"> von {punkte.length} Messpunkten</span>
          </div>
          {anzahl('nio') > 0 && <span className="font-mono text-[11.5px] uppercase tracking-[0.06em] text-red font-semibold border border-red px-2 py-1">{anzahl('nio')} über Toleranz</span>}
        </div>
        <div className="h-2 bg-line mt-3">
          <div className="h-2 bg-amber" style={{ width: `${punkte.length ? (erledigt / punkte.length) * 100 : 0}%` }} />
        </div>
        {editable && (
          <button
            className="btn btn-amber w-full mt-4"
            onClick={() => wechsle(ersterOffener >= 0 ? { art: 'messung', index: ersterOffener } : { art: 'zusammenfassung' })}
          >
            {ersterOffener >= 0 ? `${erledigt === 0 ? 'Start mit' : 'Weiter mit'} Messung ${punkte[ersterOffener].nr}` : 'Zur Zusammenfassung'}
          </button>
        )}
        {editable && (
          <button className="btn btn-outline w-full mt-2" disabled={saving} onClick={schliessen}>Speichern und schließen</button>
        )}
      </div>

      {typDef.gruppen.map((gruppe) => (
        <div key={gruppe.titel} className="mb-6">
          <div className="font-mono text-[12px] uppercase tracking-[0.1em] text-ink-soft mb-2">{gruppe.titel}</div>
          <div className="bg-white border border-line">
            {gruppe.punkte.map((p) => {
              const index = punkte.findIndex((x) => x.key === p.key)
              const b = bewertungen[index]
              return (
                <button
                  key={p.key}
                  onClick={() => wechsle({ art: 'messung', index })}
                  className="w-full text-left flex items-center gap-3 px-3.5 py-3 border-0 border-b border-line last:border-b-0 bg-transparent cursor-pointer min-h-[56px]"
                >
                  <span className="font-mono font-semibold text-[13px] w-11 shrink-0">{p.nr}</span>
                  <span className="flex-1 text-[14.5px] leading-snug">{p.bezeichnung}</span>
                  <span className="flex flex-col items-end gap-0.5 shrink-0">
                    {werte[p.key] && <span className="font-mono text-[13px]">{werte[p.key]}</span>}
                    <BewertungTag b={b} />
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      ))}

      <div className="flex flex-col gap-2 mb-2">
        <button className="btn btn-outline w-full" onClick={() => wechsle({ art: 'zusammenfassung' })}>Zusammenfassung</button>
        {protokoll.status === 'abgeschlossen' && (
          <>
            <div className="text-[13.5px] text-ink-soft text-center mt-1">Abgeschlossen am {protokoll.abgeschlossen_am ? new Date(protokoll.abgeschlossen_am).toLocaleString('de-DE') : '–'}</div>
            <button className="btn btn-amber w-full" disabled={downloadingPdf} onClick={handleDownloadPdf}>{downloadingPdf ? 'Erzeuge PDF…' : 'PDF herunterladen'}</button>
          </>
        )}
        {canDelete && <button className="btn btn-danger w-full mt-3" onClick={handleDelete}>Messprotokoll löschen</button>}
      </div>
    </div>
  )
}
