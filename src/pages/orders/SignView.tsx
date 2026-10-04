import { useEffect, useRef, useState } from 'react'
import type { jsPDF } from 'jspdf'
import { supabase } from '../../lib/supabase'
import { SignaturePad, type SignaturePadHandle } from '../../components/ui/SignaturePad'
import { Icon } from '../../components/ui/Icon'
import { useToast } from '../../components/ui/Toast'
import { calcBerichtTotalsMitKontext, type Tageskontext } from '../../lib/zeit'
import { formatDateDE } from '../../lib/format'
import { berichtPdfFilename, buildBerichtPdf, sharePdf } from '../../lib/pdf'
import { adresseInZwischenablage, berichtMailBetreff, berichtMailText, berichtMailtoUrl } from '../../lib/berichtMail'
import type { Employee, Machine, OrderWithRelations, Servicebericht, ServiceberichtErsatzteil, ServiceberichtTag } from '../../lib/types'

interface Props {
  bericht: Servicebericht
  tage: ServiceberichtTag[]
  tageskontext: Tageskontext
  ersatzteile: ServiceberichtErsatzteil[]
  machine: Machine | undefined
  techniker: Employee | undefined
  order: OrderWithRelations
  onBack: () => void
  onDone: () => void
}

interface Unterschrift { dataUrl: string; blob: Blob }

const runde = (n: number) => Math.round(n * 100) / 100
const stunden = (n: number) => `${runde(n).toLocaleString('de-DE')} h`

/** Abschluss mit Unterschrift: erst der Techniker, dann der Kunde. Am Tablet
 * quer steht links die Kurzfassung, rechts die große Unterschriftsfläche. */
export function SignView({ bericht, tage, tageskontext, ersatzteile, machine, techniker, order, onBack, onDone }: Props) {
  const toast = useToast()
  const padRef = useRef<SignaturePadHandle>(null)
  const [schritt, setSchritt] = useState<'techniker' | 'kunde'>('techniker')
  const [hatStrich, setHatStrich] = useState(false)
  const [technikerUnterschrift, setTechnikerUnterschrift] = useState<Unterschrift | null>(null)
  const [saving, setSaving] = useState(false)
  const [sharing, setSharing] = useState(false)
  const [completedPdf, setCompletedPdf] = useState<jsPDF | null>(null)

  // Beim Öffnen und bei jedem Schritt oben beginnen (sonst bleibt die
  // Scroll-Position des Berichts stehen).
  useEffect(() => { document.querySelector('.app-inhalt')?.scrollTo({ top: 0 }) }, [schritt, completedPdf])

  const totals = calcBerichtTotalsMitKontext(tage, tageskontext)
  const arbeit = totals.arbeitNormal + totals.arbeitZuschlag50 + totals.arbeitZuschlag100
  const reise = totals.reiseNormal + totals.reiseZuschlag50 + totals.reiseZuschlag100
  const tageText = tage.length === 0 ? '–'
    : tage.length === 1 ? formatDateDE(tage[0].datum)
    : `${tage.length} Tage · ${formatDateDE(tage[0].datum)} – ${formatDateDE(tage[tage.length - 1].datum)}`

  async function uploadSignature(blob: Blob, who: 'techniker' | 'kunde') {
    const path = `${bericht.id}/${who}.png`
    const { error } = await supabase.storage.from('signatures').upload(path, blob, { upsert: true, contentType: 'image/png' })
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
    await abschliessen(technikerUnterschrift!, u)
  }

  async function abschliessen(tech: Unterschrift, kunde: Unterschrift) {
    setSaving(true)
    try {
      const [techUrl, kundeUrl] = await Promise.all([uploadSignature(tech.blob, 'techniker'), uploadSignature(kunde.blob, 'kunde')])
      const abgeschlossenAm = new Date().toISOString()
      const { error } = await supabase.from('serviceberichte').update({
        status: 'abgeschlossen',
        abgeschlossen_am: abgeschlossenAm,
        techniker_unterschrift_url: techUrl,
        kunde_unterschrift_url: kundeUrl,
      }).eq('id', bericht.id)
      if (error) throw error

      const pdf = await buildBerichtPdf({
        bericht: { ...bericht, status: 'abgeschlossen', abgeschlossen_am: abgeschlossenAm },
        tage, tageskontext, ersatzteile, machine, techniker, order,
        technikerSignatureDataUrl: tech.dataUrl,
        kundeSignatureDataUrl: kunde.dataUrl,
      })
      toast('Servicebericht abgeschlossen und archiviert.')
      // Kein automatischer Download hier — auf dem iPad beim Kunden ist das unpraktisch.
      // Herunterladen/Teilen ist ab jetzt optional, die Disposition kann den Bericht
      // jederzeit später aus dem Auftrag herunterladen.
      setCompletedPdf(pdf)
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Unbekannter Fehler beim Abschließen.')
    } finally {
      setSaving(false)
    }
  }

  async function handleShare() {
    if (!completedPdf) return
    setSharing(true)
    // Zuerst die Adresse kopieren: nach dem Teilen-Dialog laesst Safari keinen
    // Zugriff auf die Zwischenablage mehr zu.
    const kopiert = await adresseInZwischenablage(order.ansprechpartner?.email)
    const result = await sharePdf(
      completedPdf,
      berichtPdfFilename(bericht),
      berichtMailBetreff(order, bericht),
      berichtMailText(order, bericht),
    )
    setSharing(false)
    if (result === 'unsupported') toast('Teilen wird auf diesem Gerät nicht unterstützt — bitte stattdessen herunterladen.')
    else if (result === 'error') toast('Teilen fehlgeschlagen.')
    else if (result === 'shared') {
      toast(kopiert
        ? 'Geteilt. Die E-Mail-Adresse liegt in der Zwischenablage — im Empfängerfeld einfügen.'
        : 'Servicebericht geteilt.')
    }
  }

  // ------------------------------------------------------------ Bestätigung
  if (completedPdf) {
    return (
      <div className="max-w-2xl">
        <p className="font-mono text-[12px] uppercase tracking-[0.14em] text-amber m-0 mb-2 flex items-center gap-2"><span className="inline-block w-[22px] h-0.5 bg-amber" />Servicebericht {bericht.bericht_nummer}</p>
        <h1 className="flex items-center gap-3 mb-3"><Icon name="erledigt" size={34} strokeWidth={3.5} /> Abgeschlossen</h1>
        <p className="text-ink-soft mt-0 mb-5">
          Beide Unterschriften sind gespeichert. Der Bericht liegt in Auftrag #{order.id}, die Disposition kann ihn dort jederzeit herunterladen.
          Du kannst ihn hier direkt an den Kunden schicken.
        </p>
        {order.ansprechpartner?.email && (
          <div className="bg-white border border-line p-3 mb-4 text-[14px]">
            <span className="font-mono text-[11.5px] uppercase tracking-[0.06em] text-ink-soft block mb-1">Ansprechpartner</span>
            <b>{order.ansprechpartner.email}</b>
            <div className="text-ink-soft text-[13px] mt-1">Beim Teilen liegt die Adresse in der Zwischenablage — im Empfängerfeld nur einfügen.</div>
          </div>
        )}
        <div className="grid gap-2 sm:grid-cols-2">
          <button className="btn btn-amber" disabled={sharing} onClick={handleShare}><Icon name="teilen" size={20} /> {sharing ? 'Öffne Teilen…' : 'Teilen / E-Mail'}</button>
          <button className="btn btn-outline" onClick={() => completedPdf.save(berichtPdfFilename(bericht))}><Icon name="pdf" size={20} /> PDF herunterladen</button>
          {order.ansprechpartner?.email && (
            <a
              className="btn btn-outline"
              href={berichtMailtoUrl(order, bericht)}
              onClick={() => completedPdf.save(berichtPdfFilename(bericht))}
            >
              E-Mail mit Empfänger öffnen
            </a>
          )}
          <button className="btn btn-outline" onClick={onDone}>Fertig, zurück zum Auftrag</button>
        </div>
        {order.ansprechpartner?.email && (
          <p className="text-[13px] text-ink-soft mt-3 mb-0">
            „E-Mail mit Empfänger öffnen" trägt Empfänger, Betreff und Text ein und lädt das PDF herunter — anhängen musst du es dann selbst.
          </p>
        )}
      </div>
    )
  }

  // ----------------------------------------------------------- Unterschrift
  const kurz: [string, string][] = [
    ['Bericht', bericht.bericht_nummer],
    ['Auftrag', `#${order.id}`],
    ['Kunde', order.einsatzkunde?.name || '–'],
    ['Maschine', machine?.bezeichnung || '–'],
    ['Zeitraum', tageText],
    ['Arbeit', stunden(arbeit)],
    ['Reise', stunden(reise)],
    ['Gesamt', stunden(totals.gesamt)],
  ]
  const istTechniker = schritt === 'techniker'
  const name = istTechniker ? techniker?.name : order.ansprechpartner?.name

  return (
    <div>
      <button className="btn btn-outline btn-sm mb-4" onClick={onBack}><Icon name="zurueck" size={18} /> Zurück zum Bericht</button>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] md:landscape:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] items-start">
        {/* Kurzfassung */}
        <div>
          <p className="font-mono text-[12px] uppercase tracking-[0.14em] text-amber m-0 mb-2 flex items-center gap-2"><span className="inline-block w-[22px] h-0.5 bg-amber" />Kurzfassung</p>
          <div className="bg-white border border-line">
            {kurz.map(([label, wert]) => (
              <div key={label} className="grid grid-cols-[minmax(0,7rem)_1fr] gap-3 px-3.5 py-2.5 border-b border-line">
                <span className="font-mono text-[11.5px] uppercase tracking-[0.06em] text-ink-soft">{label}</span>
                <span className={`text-right ${label === 'Gesamt' ? 'font-bold' : 'font-medium'}`}>{wert}</span>
              </div>
            ))}
            <div className="px-3.5 py-2.5 border-b border-line">
              <span className="font-mono text-[11.5px] uppercase tracking-[0.06em] text-ink-soft block mb-1">Durchgeführte Arbeiten</span>
              <span className="text-[14.5px] whitespace-pre-line max-lg:line-clamp-5">{bericht.durchgefuehrte_arbeiten || '–'}</span>
            </div>
            <div className="px-3.5 py-2.5">
              <span className="font-mono text-[11.5px] uppercase tracking-[0.06em] text-ink-soft block mb-1">Ersatzteile</span>
              {ersatzteile.length === 0 ? <span className="text-[14.5px]">–</span> : (
                <ul className="m-0 p-0 list-none text-[14.5px]">
                  {ersatzteile.map((t) => (
                    <li key={t.id} className="flex justify-between gap-3"><span>{t.bezeichnung}{t.id_nummer ? ` · ${t.id_nummer}` : ''}</span><span className="font-mono">{t.menge}</span></li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>

        {/* Unterschrift */}
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
          <div className="text-ink-soft mb-3">{name ? name : istTechniker ? '–' : 'Name des Unterschreibenden beim Kunden'}</div>

          <SignaturePad key={schritt} ref={padRef} hoehe="clamp(180px, 42vh, 420px)" onChange={setHatStrich} />

          {!istTechniker && (
            <p className="text-[13px] text-ink-soft mt-2.5 mb-0">
              Mit den Unterschriften werden die aufgeführten Leistungen und Stunden bestätigt. Danach ist der Bericht nicht mehr änderbar.
            </p>
          )}

          <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)] gap-2 mt-4">
            <button className="btn btn-outline" disabled={saving || !hatStrich} onClick={() => padRef.current?.clear()}><Icon name="loeschen" size={18} /> Löschen</button>
            <button className="btn btn-amber !whitespace-normal text-center" disabled={saving || !hatStrich} onClick={bestaetigen}>
              {saving ? 'Schließe ab…' : istTechniker ? 'Bestätigen, weiter zum Kunden' : 'Bestätigen und abschließen'}
            </button>
          </div>
          {!istTechniker && (
            <button
              className="bg-transparent border-0 p-0 mt-3 text-steel underline underline-offset-2 cursor-pointer text-[14px]"
              disabled={saving}
              onClick={() => { setTechnikerUnterschrift(null); setHatStrich(false); setSchritt('techniker') }}
            >
              Techniker-Unterschrift wiederholen
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
