import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import type { jsPDF } from 'jspdf'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/AuthContext'
import { useConfirm } from '../../components/ui/ConfirmProvider'
import { useToast } from '../../components/ui/Toast'
import { Icon } from '../../components/ui/Icon'
import { SignaturePad, type SignaturePadHandle } from '../../components/ui/SignaturePad'
import type { Customer, Employee, Machine, Order, Wartungsprotokoll } from '../../lib/types'
import {
  WARTUNG_BEMERKUNG_KEY, WARTUNG_ERGEBNIS_TEXT, WARTUNG_GRUPPEN, alleWartungspunkte,
  wAngebotKey, wBemerkungKey, wErgebnisKey, wReparaturKey, wartungErgebnis, wartungStatus,
  type WartungErgebnis, type WartungStatus, type Wartungspunkt,
} from '../../lib/wartung'
import { buildWartungPdf, sharePdf, urlToDataUrl, wartungPdfFilename } from '../../lib/pdf'
import { formatDateDE } from '../../lib/format'

type Ansicht = { art: 'uebersicht' } | { art: 'gruppe'; index: number } | { art: 'zusammenfassung' } | { art: 'unterschrift' }
interface Unterschrift { dataUrl: string; blob: Blob }

const ERGEBNIS_KURZ: Record<WartungErgebnis, string> = { '1': 'In Ordnung', '2': 'Verschleißspuren', '3': 'Verschleißgrenze' }

/** Ergebnis-Marke: 1 ruhig, 2 betont, 3 rot. */
function ErgebnisTag({ e }: { e: WartungErgebnis }) {
  const farbe = e === '3' ? 'border-red text-red' : e === '2' ? 'border-ink text-ink' : 'border-line text-ink-soft'
  return <span className={`inline-flex items-center gap-1.5 border px-1.5 py-0.5 font-mono text-[11px] uppercase tracking-[0.06em] whitespace-nowrap ${farbe}`}><b>{e}</b> {ERGEBNIS_KURZ[e]}</span>
}

export function WartungsprotokollDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { employee } = useAuth()
  const confirm = useConfirm()
  const toast = useToast()

  const [protokoll, setProtokoll] = useState<Wartungsprotokoll | null>(null)
  const [order, setOrder] = useState<Order | null>(null)
  const [machine, setMachine] = useState<Machine | null>(null)
  const [kunde, setKunde] = useState<Customer | null>(null)
  const [techniker, setTechniker] = useState<Employee | null>(null)
  const [abnehmer, setAbnehmer] = useState('')
  const [werte, setWerte] = useState<Record<string, string>>({})
  const [ansicht, setAnsicht] = useState<Ansicht>({ art: 'uebersicht' })
  const [saving, setSaving] = useState(false)
  const [downloadingPdf, setDownloadingPdf] = useState(false)
  const [bemerkungOffen, setBemerkungOffen] = useState<Record<string, boolean>>({})
  const gespeichert = useRef('')

  // Unterschrift
  const padRef = useRef<SignaturePadHandle>(null)
  const [schritt, setSchritt] = useState<'techniker' | 'kunde'>('techniker')
  const [hatStrich, setHatStrich] = useState(false)
  const [technikerUnterschrift, setTechnikerUnterschrift] = useState<Unterschrift | null>(null)
  const [fertigPdf, setFertigPdf] = useState<jsPDF | null>(null)
  const [sharing, setSharing] = useState(false)

  async function load() {
    if (!id) return
    const { data: p } = await supabase.from('wartungsprotokolle').select('*').eq('id', id).maybeSingle()
    if (!p) { setProtokoll(null); return }
    setProtokoll(p)
    setAbnehmer(p.abnehmer || '')
    const w = (p.werte as Record<string, string>) || {}
    setWerte(w)
    gespeichert.current = JSON.stringify({ a: p.abnehmer || '', w })
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
  useEffect(() => { document.querySelector('.app-inhalt')?.scrollTo({ top: 0 }) }, [ansicht, schritt, fertigPdf])

  const punkte = useMemo(() => alleWartungspunkte(), [])

  if (!protokoll) return <div className="text-sm text-ink-soft">Lädt…</div>

  const editable = protokoll.status === 'offen' && employee?.id === protokoll.techniker_id
  const canDelete = employee?.role === 'Administrator' || employee?.role === 'Disposition' || employee?.role === 'CEO'

  const bearbeitet = punkte.filter((p) => wartungStatus(werte, p.key)).length
  const anzahlErgebnis = (e: WartungErgebnis) => punkte.filter((p) => wartungErgebnis(werte, p.key) === e).length
  const auffaellig = punkte.filter((p) => {
    const e = wartungErgebnis(werte, p.key)
    return e === '2' || e === '3' || werte[wReparaturKey(p.key)] === '1' || werte[wAngebotKey(p.key)] === '1'
  })
  const ersteOffeneGruppe = WARTUNG_GRUPPEN.findIndex((g) => g.abschnitte.some((a) => a.punkte.some((p) => !wartungStatus(werte, p.key))))

  async function speichern(leise: boolean): Promise<boolean> {
    if (!editable) return true
    const stand = JSON.stringify({ a: abnehmer, w: werte })
    if (stand === gespeichert.current) { if (!leise) toast('Gespeichert.'); return true }
    setSaving(true)
    const { error } = await supabase.from('wartungsprotokolle').update({ abnehmer: abnehmer || null, werte }).eq('id', protokoll!.id)
    setSaving(false)
    if (error) { toast('Fehler beim Speichern: ' + error.message); return false }
    gespeichert.current = stand
    if (!leise) toast('Gespeichert.')
    return true
  }

  async function wechsle(ziel: Ansicht) {
    await speichern(true)
    setAnsicht(ziel)
  }

  const zurueckZiel = protokoll.servicebericht_id ? `/berichte/${protokoll.servicebericht_id}` : `/auftraege/${protokoll.auftrag_id}`
  const zurueckText = protokoll.servicebericht_id ? 'Zum Bericht' : 'Zum Auftrag'

  async function schliessen() {
    const ok = await speichern(true)
    if (!ok) return
    if (editable) toast('Gespeichert. Du kannst später weitermachen.')
    navigate(zurueckZiel)
  }

  async function handleDelete() {
    const ok = await confirm({ message: 'Dieses Wartungsprotokoll wirklich unwiderruflich löschen?', danger: true, confirmLabel: 'Löschen' })
    if (!ok) return
    const { error } = await supabase.from('wartungsprotokolle').delete().eq('id', protokoll!.id)
    if (error) { toast('Fehler: ' + error.message); return }
    toast('Wartungsprotokoll gelöscht.')
    navigate(zurueckZiel)
  }

  async function pdfErzeugen(tech?: string | null, kund?: string | null) {
    const [t, k] = await Promise.all([
      tech ?? (protokoll!.techniker_unterschrift_url ? urlToDataUrl(protokoll!.techniker_unterschrift_url) : null),
      kund ?? (protokoll!.kunde_unterschrift_url ? urlToDataUrl(protokoll!.kunde_unterschrift_url) : null),
    ])
    return buildWartungPdf({ protokoll: protokoll!, machine, kunde, techniker, abnehmer, werte, technikerSignatureDataUrl: t, kundeSignatureDataUrl: k })
  }

  async function handleDownloadPdf() {
    setDownloadingPdf(true)
    try {
      const pdf = await pdfErzeugen()
      pdf.save(wartungPdfFilename(protokoll!))
    } catch (e) {
      toast(e instanceof Error ? e.message : 'PDF konnte nicht erzeugt werden.')
    } finally {
      setDownloadingPdf(false)
    }
  }

  // ------------------------------------------------------------ Werte setzen
  const setze = (k: string, v: string) => setWerte((w) => {
    const neu = { ...w }
    if (v) neu[k] = v
    else delete neu[k]
    return neu
  })
  const statusSetzen = (p: Wartungspunkt, s: WartungStatus | null) => setWerte((w) => {
    const neu = { ...w }
    if (!s) {
      delete neu[p.key]
    } else {
      neu[p.key] = s
      // Geprüft ohne Ergebnis heißt in der Praxis fast immer "in Ordnung" — vorbelegen, änderbar.
      if (s === 'geprueft' && p.art !== 'erledigt' && !neu[wErgebnisKey(p.key)]) neu[wErgebnisKey(p.key)] = '1'
      if (s !== 'geprueft') { delete neu[wErgebnisKey(p.key)]; delete neu[wReparaturKey(p.key)]; delete neu[wAngebotKey(p.key)] }
    }
    return neu
  })
  const gruppeAbhaken = (gi: number) => setWerte((w) => {
    const neu = { ...w }
    WARTUNG_GRUPPEN[gi].abschnitte.forEach((a) => a.punkte.forEach((p) => {
      if (neu[p.key]) return
      neu[p.key] = 'geprueft'
      if (p.art !== 'erledigt') neu[wErgebnisKey(p.key)] = '1'
    }))
    return neu
  })

  // --------------------------------------------------------------- Unterschrift
  async function uploadSignature(blob: Blob, who: 'techniker' | 'kunde') {
    // Eigener Dateiname je Abschluss: für die Unterschriften gibt es nur "Anlegen", kein Überschreiben.
    const path = `wartung/${protokoll!.id}/${who}-${Date.now()}.png`
    const { error } = await supabase.storage.from('signatures').upload(path, blob, { contentType: 'image/png' })
    if (error) throw error
    return supabase.storage.from('signatures').getPublicUrl(path).data.publicUrl
  }

  async function aktuelleUnterschrift(): Promise<Unterschrift | null> {
    const pad = padRef.current
    if (!pad?.hasStroke()) return null
    const dataUrl = pad.toDataUrl()
    const blob = await pad.toBlob()
    return dataUrl && blob ? { dataUrl, blob } : null
  }

  async function bestaetigen() {
    const u = await aktuelleUnterschrift()
    if (!u) { toast('Bitte zuerst unterschreiben.'); return }
    if (schritt === 'techniker') {
      setTechnikerUnterschrift(u)
      setHatStrich(false)
      setSchritt('kunde')
      return
    }
    if (!abnehmer.trim()) { toast('Bitte den Namen des Unterschreibenden beim Kunden eintragen.'); return }
    await abschliessen(technikerUnterschrift!, u)
  }

  async function abschliessen(tech: Unterschrift, kund: Unterschrift) {
    setSaving(true)
    try {
      const [techUrl, kundeUrl] = await Promise.all([uploadSignature(tech.blob, 'techniker'), uploadSignature(kund.blob, 'kunde')])
      const abgeschlossenAm = new Date().toISOString()
      const { error } = await supabase.from('wartungsprotokolle').update({
        abnehmer: abnehmer || null,
        werte,
        status: 'abgeschlossen',
        abgeschlossen_am: abgeschlossenAm,
        techniker_unterschrift_url: techUrl,
        kunde_unterschrift_url: kundeUrl,
      }).eq('id', protokoll!.id)
      if (error) throw error
      const neu = { ...protokoll!, status: 'abgeschlossen', abgeschlossen_am: abgeschlossenAm, techniker_unterschrift_url: techUrl, kunde_unterschrift_url: kundeUrl, abnehmer: abnehmer || null, werte }
      setProtokoll(neu)
      gespeichert.current = JSON.stringify({ a: abnehmer, w: werte })
      const pdf = await buildWartungPdf({ protokoll: neu, machine, kunde, techniker, abnehmer, werte, technikerSignatureDataUrl: tech.dataUrl, kundeSignatureDataUrl: kund.dataUrl })
      toast('Wartungsprotokoll abgeschlossen.')
      setFertigPdf(pdf)
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Unbekannter Fehler beim Abschließen.')
    } finally {
      setSaving(false)
    }
  }

  async function handleShare() {
    if (!fertigPdf) return
    setSharing(true)
    const r = await sharePdf(fertigPdf, wartungPdfFilename(protokoll!), `Wartungsprotokoll Auftrag #${protokoll!.auftrag_id}`, `Wartungsprotokoll zu Auftrag #${protokoll!.auftrag_id}, ${machine?.bezeichnung || ''}`)
    setSharing(false)
    if (r === 'unsupported') toast('Teilen wird auf diesem Gerät nicht unterstützt — bitte stattdessen herunterladen.')
    else if (r === 'error') toast('Teilen fehlgeschlagen.')
  }

  const kopfzeile = (text: string) => (
    <p className="font-mono text-[12px] uppercase tracking-[0.14em] text-amber m-0 mb-2 flex items-center gap-2"><span className="inline-block w-[22px] h-0.5 bg-amber" />{text}</p>
  )

  // ------------------------------------------------------------------ Fertig
  if (fertigPdf) {
    return (
      <div className="max-w-2xl">
        {kopfzeile('Wartungsprotokoll')}
        <h1 className="flex items-center gap-3 mb-3"><Icon name="erledigt" size={34} strokeWidth={3.5} /> Abgeschlossen</h1>
        <p className="text-ink-soft mt-0 mb-5">Beide Unterschriften sind gespeichert. Das Protokoll liegt im Auftrag #{protokoll.auftrag_id} und kann dort jederzeit heruntergeladen werden.</p>
        <div className="grid gap-2 sm:grid-cols-2">
          <button className="btn btn-amber" disabled={sharing} onClick={handleShare}><Icon name="teilen" size={20} /> {sharing ? 'Öffne Teilen…' : 'Teilen / E-Mail'}</button>
          <button className="btn btn-outline" onClick={() => fertigPdf.save(wartungPdfFilename(protokoll))}><Icon name="pdf" size={20} /> PDF herunterladen</button>
          <button className="btn btn-outline sm:col-span-2" onClick={() => navigate(zurueckZiel)}>Fertig, {zurueckText.toLowerCase()}</button>
        </div>
      </div>
    )
  }

  // ------------------------------------------------------------ Unterschrift
  if (ansicht.art === 'unterschrift') {
    const istTechniker = schritt === 'techniker'
    return (
      <div>
        <button className="btn btn-outline btn-sm mb-4" disabled={saving} onClick={() => setAnsicht({ art: 'zusammenfassung' })}><Icon name="zurueck" size={18} /> Zur Zusammenfassung</button>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] md:landscape:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] items-start">
          <div>
            {kopfzeile('Kurzfassung')}
            <div className="bg-white border border-line">
              {([
                ['Auftrag', `#${protokoll.auftrag_id}`],
                ['Kunde', kunde?.name || '–'],
                ['Maschine', machine?.bezeichnung || '–'],
                ['Bearbeitet', `${bearbeitet} von ${punkte.length} Punkten`],
                ['Ergebnis 2', String(anzahlErgebnis('2'))],
                ['Ergebnis 3', String(anzahlErgebnis('3'))],
              ] as [string, string][]).map(([label, wert]) => (
                <div key={label} className="grid grid-cols-[minmax(0,7rem)_1fr] gap-3 px-3.5 py-2.5 border-b border-line last:border-b-0">
                  <span className="font-mono text-[11.5px] uppercase tracking-[0.06em] text-ink-soft">{label}</span>
                  <span className="text-right font-medium">{wert}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <div className="grid grid-cols-2 gap-0.5 p-0.5 bg-line mb-4">
              {(['techniker', 'kunde'] as const).map((s, i) => {
                const aktiv = schritt === s
                const erledigt = s === 'techniker' && !!technikerUnterschrift && schritt === 'kunde'
                return (
                  <div key={s} className={`min-h-[44px] flex items-center justify-center gap-2 font-mono text-[12px] font-semibold uppercase tracking-[0.05em] ${aktiv ? 'bg-ink text-paper' : 'bg-white text-ink-soft'}`}>
                    {erledigt ? <Icon name="erledigt" size={16} /> : <span>{i + 1}</span>} {s === 'techniker' ? 'Techniker' : 'Kunde'}
                  </div>
                )
              })}
            </div>
            <h1 className="mb-1">Unterschrift {istTechniker ? 'Techniker' : 'Kunde'}</h1>
            {istTechniker ? (
              <div className="text-ink-soft mb-3">{techniker?.name || '–'}</div>
            ) : (
              <div className="mb-3">
                <label>Name des Unterschreibenden beim Kunden</label>
                <input type="text" value={abnehmer} onChange={(e) => setAbnehmer(e.target.value)} placeholder="Vor- und Nachname" />
              </div>
            )}
            <SignaturePad key={schritt} ref={padRef} hoehe="clamp(180px, 42vh, 420px)" onChange={setHatStrich} />
            {!istTechniker && (
              <p className="text-[13px] text-ink-soft mt-2.5 mb-0">Mit den Unterschriften wird das Inspektionsergebnis bestätigt. Danach ist das Protokoll nicht mehr änderbar.</p>
            )}
            <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)] gap-2 mt-4">
              <button className="btn btn-outline" disabled={saving || !hatStrich} onClick={() => padRef.current?.clear()}><Icon name="loeschen" size={18} /> Löschen</button>
              <button className="btn btn-amber !whitespace-normal text-center" disabled={saving || !hatStrich} onClick={bestaetigen}>
                {saving ? 'Schließe ab…' : istTechniker ? 'Bestätigen, weiter zum Kunden' : 'Bestätigen und abschließen'}
              </button>
            </div>
            {!istTechniker && (
              <button className="bg-transparent border-0 p-0 mt-3 text-steel underline underline-offset-2 cursor-pointer text-[14px]" disabled={saving} onClick={() => { setTechnikerUnterschrift(null); setHatStrich(false); setSchritt('techniker') }}>
                Techniker-Unterschrift wiederholen
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  // ------------------------------------------------------------------ Gruppe
  if (ansicht.art === 'gruppe') {
    const gi = ansicht.index
    const g = WARTUNG_GRUPPEN[gi]
    const naechste = WARTUNG_GRUPPEN[gi + 1]
    const offenInGruppe = g.abschnitte.reduce((n, a) => n + a.punkte.filter((p) => !wartungStatus(werte, p.key)).length, 0)
    return (
      <div>
        <div className="flex items-center justify-between mb-4">
          <button className="btn btn-outline btn-sm" onClick={() => wechsle({ art: 'uebersicht' })}><Icon name="zurueck" size={18} /> Übersicht</button>
          <span className="flex items-center gap-3">
            <span className="font-mono text-[13px] text-ink-soft">{gi + 1} / {WARTUNG_GRUPPEN.length}</span>
            {editable && <button className="btn btn-outline btn-sm" disabled={saving} onClick={schliessen}>Schließen</button>}
          </span>
        </div>
        {kopfzeile(`Gruppe ${String(gi + 1).padStart(2, '0')}`)}
        <h1 className="mb-3">{g.titel}</h1>

        {gi === 0 && (
          <div className="bg-white border border-line px-3.5 py-2.5 mb-4 text-[13px] leading-snug">
            <span className="font-mono text-[11px] uppercase tracking-[0.06em] text-ink-soft block mb-1">Ergebnis</span>
            {(['1', '2', '3'] as WartungErgebnis[]).map((e) => <div key={e}><b className="font-mono">{e}</b> {WARTUNG_ERGEBNIS_TEXT[e]}</div>)}
          </div>
        )}

        {editable && offenInGruppe > 0 && (
          <button className="btn btn-outline w-full mb-4" onClick={() => gruppeAbhaken(gi)}>
            <Icon name="erledigt" size={18} /> Alle {offenInGruppe} offenen Punkte: geprüft, in Ordnung
          </button>
        )}

        {g.abschnitte.map((a, ai) => (
          <div key={ai} className="mb-5">
            {a.titel && <div className="font-mono text-[12px] uppercase tracking-[0.1em] text-ink-soft mb-2">{a.titel}</div>}
            <div className="bg-white border border-line px-3.5">
              {a.punkte.map((p) => {
                const status = wartungStatus(werte, p.key)
                const ergebnis = wartungErgebnis(werte, p.key)
                const reparatur = werte[wReparaturKey(p.key)] === '1'
                const angebot = werte[wAngebotKey(p.key)] === '1'
                const bemerkung = werte[wBemerkungKey(p.key)] || ''
                const zeigeBemerkung = bemerkungOffen[p.key] || !!bemerkung
                const statusOptionen: [WartungStatus, string][] = p.art === 'erledigt'
                  ? [['geprueft', 'Erledigt'], ['nicht_moeglich', 'Nicht möglich'], ['entfaellt', 'Entfällt']]
                  : [['geprueft', 'Geprüft'], ['nicht_moeglich', 'Nicht möglich'], ['entfaellt', 'Entfällt']]
                return (
                  <div key={p.key} className="py-3 border-b border-line last:border-b-0">
                    <div className="text-[14.5px] font-medium leading-snug mb-2">{p.bezeichnung}</div>
                    <div className="grid grid-cols-3 gap-1">
                      {statusOptionen.map(([s, label]) => {
                        const aktiv = status === s
                        return (
                          <button
                            key={s}
                            type="button"
                            disabled={!editable}
                            aria-pressed={aktiv}
                            onClick={() => statusSetzen(p, aktiv ? null : s)}
                            className={`min-h-[44px] px-1 font-mono text-[11.5px] uppercase tracking-[0.04em] border-2 cursor-pointer disabled:cursor-default ${aktiv ? 'border-ink bg-ink text-white' : 'border-line bg-white text-ink'}`}
                          >
                            {label}
                          </button>
                        )
                      })}
                    </div>
                    {status === 'geprueft' && p.art !== 'erledigt' && (
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        <span className="font-mono text-[11px] uppercase tracking-[0.06em] text-ink-soft mr-1">Ergebnis</span>
                        {(['1', '2', '3'] as WartungErgebnis[]).map((e) => {
                          const aktiv = ergebnis === e
                          const farbe = e === '3' ? 'border-red bg-red text-white' : e === '2' ? 'border-ink bg-ink text-white' : 'border-green bg-green text-white'
                          return (
                            <button
                              key={e}
                              type="button"
                              disabled={!editable}
                              aria-pressed={aktiv}
                              aria-label={`Ergebnis ${e}: ${WARTUNG_ERGEBNIS_TEXT[e]}`}
                              onClick={() => setze(wErgebnisKey(p.key), e)}
                              className={`w-11 h-11 border-2 font-mono font-bold text-[16px] cursor-pointer disabled:cursor-default ${aktiv ? farbe : 'border-line bg-white text-ink'}`}
                            >
                              {e}
                            </button>
                          )
                        })}
                        <span className="flex-1" />
                        {([['Reparatur', wReparaturKey(p.key), reparatur], ['Angebot', wAngebotKey(p.key), angebot]] as [string, string, boolean][]).map(([label, k, an]) => (
                          <button
                            key={k}
                            type="button"
                            disabled={!editable}
                            aria-pressed={an}
                            onClick={() => setze(k, an ? '' : '1')}
                            className={`min-h-[44px] px-2.5 font-mono text-[11.5px] uppercase tracking-[0.04em] border-2 cursor-pointer disabled:cursor-default ${an ? 'border-ink bg-ink text-white' : 'border-line bg-white text-ink'}`}
                          >
                            {an ? '■ ' : '□ '}{label}
                          </button>
                        ))}
                      </div>
                    )}
                    {status && (
                      zeigeBemerkung ? (
                        <textarea
                          rows={2}
                          className="mt-2"
                          disabled={!editable}
                          value={bemerkung}
                          onChange={(e) => setze(wBemerkungKey(p.key), e.target.value)}
                          placeholder="Bemerkung"
                        />
                      ) : editable && (
                        <button type="button" className="bg-transparent border-0 p-0 mt-2 text-steel underline underline-offset-2 cursor-pointer text-[13px]" onClick={() => setBemerkungOffen((b) => ({ ...b, [p.key]: true }))}>
                          Bemerkung hinzufügen
                        </button>
                      )
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ))}

        <div className="sticky bottom-0 z-30 -mx-4 md:-mx-6 mt-6 bg-paper border-t border-line px-4 md:px-6 py-3 grid grid-cols-[1fr_2fr] gap-2">
          <button className="btn btn-outline" disabled={saving} onClick={() => wechsle(gi > 0 ? { art: 'gruppe', index: gi - 1 } : { art: 'uebersicht' })}>Zurück</button>
          <button className="btn btn-amber" disabled={saving} onClick={() => wechsle(naechste ? { art: 'gruppe', index: gi + 1 } : { art: 'zusammenfassung' })}>
            {naechste ? `Weiter: ${naechste.titel}` : 'Zusammenfassung'}
          </button>
        </div>
      </div>
    )
  }

  // -------------------------------------------------------- Zusammenfassung
  if (ansicht.art === 'zusammenfassung') {
    const offen = punkte.length - bearbeitet
    return (
      <div>
        <div className="flex items-center justify-between mb-4">
          <button className="btn btn-outline btn-sm" onClick={() => wechsle({ art: 'uebersicht' })}><Icon name="zurueck" size={18} /> Übersicht</button>
          <span className={`tag ${protokoll.status === 'abgeschlossen' ? 'tag-abgeschlossen' : 'tag-offen'}`}>{protokoll.status === 'abgeschlossen' ? 'Abgeschlossen' : 'Offen'}</span>
        </div>
        {kopfzeile('Wartungsprotokoll')}
        <h1 className="mb-4">Zusammenfassung</h1>

        <div className="grid grid-cols-3 border border-line bg-white mb-1">
          {([['1', 'in Ordnung'], ['2', 'Verschleißspuren'], ['3', 'Verschleißgrenze']] as [WartungErgebnis, string][]).map(([e, label], idx) => (
            <div key={e} className={`p-3 ${idx > 0 ? 'border-l border-line' : ''}`}>
              <div className={`text-[40px] font-extrabold leading-none ${e === '3' && anzahlErgebnis('3') > 0 ? 'text-red' : ''}`} style={{ fontFamily: 'var(--font-display)' }}>{anzahlErgebnis(e)}</div>
              <div className="font-mono text-[11px] uppercase tracking-[0.06em] text-ink-soft mt-1.5">{label}</div>
            </div>
          ))}
        </div>
        <p className="text-[13px] text-ink-soft mt-1.5 mb-0">{bearbeitet} von {punkte.length} Punkten bearbeitet{offen > 0 ? `, ${offen} offen (erscheinen nicht im PDF)` : ''}.</p>

        <div className="font-mono text-[12px] uppercase tracking-[0.1em] text-ink-soft mt-6 mb-2">Auffälligkeiten, Reparaturen, Angebote</div>
        {auffaellig.length === 0 ? (
          <div className="text-sm text-ink-soft border border-dashed border-line p-4 text-center">Keine Auffälligkeiten.</div>
        ) : (
          <div className="flex flex-col gap-2">
            {auffaellig.map((p) => {
              const e = wartungErgebnis(werte, p.key)
              const gi = WARTUNG_GRUPPEN.findIndex((g) => g.abschnitte.some((a) => a.punkte.some((x) => x.key === p.key)))
              return (
                <button key={p.key} onClick={() => wechsle({ art: 'gruppe', index: gi })} className={`w-full text-left bg-white border border-l-4 p-3 cursor-pointer ${e === '3' ? 'border-red' : 'border-line border-l-ink'}`}>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="flex-1 font-medium leading-snug">{p.bezeichnung}</span>
                    {e && <ErgebnisTag e={e} />}
                    {werte[wReparaturKey(p.key)] === '1' && <span className="font-mono text-[11px] uppercase tracking-[0.06em] border border-ink px-1.5 py-0.5">Reparatur</span>}
                    {werte[wAngebotKey(p.key)] === '1' && <span className="font-mono text-[11px] uppercase tracking-[0.06em] border border-ink px-1.5 py-0.5">Angebot</span>}
                  </div>
                  <div className="text-[12.5px] text-ink-soft mt-1">{p.gruppe}{p.abschnitt ? ` · ${p.abschnitt}` : ''}{werte[wBemerkungKey(p.key)] ? ` — ${werte[wBemerkungKey(p.key)]}` : ''}</div>
                </button>
              )
            })}
          </div>
        )}

        <div className="mt-5">
          <label>Bemerkungen zum Protokoll</label>
          <textarea rows={3} disabled={!editable} value={werte[WARTUNG_BEMERKUNG_KEY] || ''} onChange={(e) => setze(WARTUNG_BEMERKUNG_KEY, e.target.value)} placeholder="z. B. nächste Inspektion in 12 Monaten" />
        </div>

        {editable ? (
          <div className="grid grid-cols-2 gap-2 mt-5">
            <button className="btn btn-outline" disabled={saving} onClick={() => speichern(false)}>Speichern</button>
            <button className="btn btn-amber" disabled={saving} onClick={async () => { if (await speichern(true)) setAnsicht({ art: 'unterschrift' }) }}><Icon name="unterschrift" size={20} /> Abschließen mit Unterschrift</button>
          </div>
        ) : protokoll.status === 'abgeschlossen' && (
          <button className="btn btn-amber w-full mt-5" disabled={downloadingPdf} onClick={handleDownloadPdf}>{downloadingPdf ? 'Erzeuge PDF…' : 'PDF herunterladen'}</button>
        )}
      </div>
    )
  }

  // --------------------------------------------------------------- Übersicht
  const kopf: [string, ReactNode][] = [
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
        {kopfzeile('Wartung · Inspektion')}
        <span className={`tag ${protokoll.status === 'abgeschlossen' ? 'tag-abgeschlossen' : 'tag-offen'}`}>{protokoll.status === 'abgeschlossen' ? 'Abgeschlossen' : 'Offen'}</span>
      </div>
      <h1 className="mb-4">Wartungsprotokoll</h1>

      <div className="bg-white border border-line mb-4">
        {kopf.map(([label, wert]) => (
          <div key={label} className="grid grid-cols-[minmax(0,9rem)_1fr] gap-3 px-3.5 py-2.5 border-b border-line last:border-b-0">
            <span className="font-mono text-[11.5px] uppercase tracking-[0.06em] text-ink-soft">{label}</span>
            <span className="text-right font-medium">{wert}</span>
          </div>
        ))}
      </div>

      <div className="bg-white border border-line p-4 mb-6">
        <div className="flex items-baseline justify-between gap-3">
          <div>
            <span className="text-[38px] font-extrabold leading-none" style={{ fontFamily: 'var(--font-display)' }}>{bearbeitet}</span>
            <span className="text-ink-soft"> von {punkte.length} Prüfpunkten</span>
          </div>
          {anzahlErgebnis('3') > 0 && <span className="font-mono text-[11.5px] uppercase tracking-[0.06em] text-red font-semibold border border-red px-2 py-1">{anzahlErgebnis('3')} × Ergebnis 3</span>}
        </div>
        <div className="h-2 bg-line mt-3">
          <div className="h-2 bg-amber" style={{ width: `${punkte.length ? (bearbeitet / punkte.length) * 100 : 0}%` }} />
        </div>
        {editable && (
          <button className="btn btn-amber w-full mt-4" onClick={() => wechsle(ersteOffeneGruppe >= 0 ? { art: 'gruppe', index: ersteOffeneGruppe } : { art: 'zusammenfassung' })}>
            {ersteOffeneGruppe >= 0 ? `${bearbeitet === 0 ? 'Start mit' : 'Weiter mit'} ${WARTUNG_GRUPPEN[ersteOffeneGruppe].titel}` : 'Zur Zusammenfassung'}
          </button>
        )}
        {editable && <button className="btn btn-outline w-full mt-2" disabled={saving} onClick={schliessen}>Speichern und schließen</button>}
      </div>

      <div className="bg-white border border-line mb-6">
        {WARTUNG_GRUPPEN.map((g, gi) => {
          const alle = g.abschnitte.flatMap((a) => a.punkte)
          const fertig = alle.filter((p) => wartungStatus(werte, p.key)).length
          const schlecht = alle.filter((p) => wartungErgebnis(werte, p.key) === '3').length
          const mittel = alle.filter((p) => wartungErgebnis(werte, p.key) === '2').length
          return (
            <button key={g.titel} onClick={() => wechsle({ art: 'gruppe', index: gi })} className="w-full text-left flex items-center gap-3 px-3.5 py-3 border-0 border-b border-line last:border-b-0 bg-transparent cursor-pointer min-h-[56px]">
              <span className="font-mono font-semibold text-[13px] w-8 shrink-0">{String(gi + 1).padStart(2, '0')}</span>
              <span className="flex-1 text-[14.5px] leading-snug">{g.titel}</span>
              <span className="flex items-center gap-2 shrink-0">
                {schlecht > 0 && <span className="font-mono text-[11px] text-red font-semibold">{schlecht} × 3</span>}
                {mittel > 0 && <span className="font-mono text-[11px] text-ink">{mittel} × 2</span>}
                <span className={`font-mono text-[12px] ${fertig === alle.length ? 'text-ink' : 'text-ink-soft'}`}>{fertig} / {alle.length}</span>
              </span>
            </button>
          )
        })}
      </div>

      <div className="flex flex-col gap-2 mb-2">
        <button className="btn btn-outline w-full" onClick={() => wechsle({ art: 'zusammenfassung' })}>Zusammenfassung</button>
        {protokoll.status === 'abgeschlossen' && (
          <>
            <div className="text-[13.5px] text-ink-soft text-center mt-1">Abgeschlossen am {protokoll.abgeschlossen_am ? new Date(protokoll.abgeschlossen_am).toLocaleString('de-DE') : '–'}{protokoll.abnehmer ? ` · Kunde: ${protokoll.abnehmer}` : ''}</div>
            <button className="btn btn-amber w-full" disabled={downloadingPdf} onClick={handleDownloadPdf}>{downloadingPdf ? 'Erzeuge PDF…' : 'PDF herunterladen'}</button>
          </>
        )}
        {canDelete && <button className="btn btn-danger w-full mt-3" onClick={handleDelete}>Wartungsprotokoll löschen</button>}
      </div>
    </div>
  )
}
