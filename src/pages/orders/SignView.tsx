import { useRef, useState } from 'react'
import type { jsPDF } from 'jspdf'
import { supabase } from '../../lib/supabase'
import { SignaturePad, type SignaturePadHandle } from '../../components/ui/SignaturePad'
import { useToast } from '../../components/ui/Toast'
import { calcBerichtSpesen, calcBerichtTotals } from '../../lib/zeit'
import { berichtPdfFilename, buildBerichtPdf, sharePdf } from '../../lib/pdf'
import { adresseInZwischenablage, berichtMailBetreff, berichtMailText, berichtMailtoUrl } from '../../lib/berichtMail'
import type { Employee, Machine, OrderWithRelations, Servicebericht, ServiceberichtErsatzteil, ServiceberichtTag } from '../../lib/types'

interface Props {
  bericht: Servicebericht
  tage: ServiceberichtTag[]
  ersatzteile: ServiceberichtErsatzteil[]
  machine: Machine | undefined
  techniker: Employee | undefined
  order: OrderWithRelations
  onBack: () => void
  onDone: () => void
}

export function SignView({ bericht, tage, ersatzteile, machine, techniker, order, onBack, onDone }: Props) {
  const toast = useToast()
  const sigTechRef = useRef<SignaturePadHandle>(null)
  const sigKundeRef = useRef<SignaturePadHandle>(null)
  const [saving, setSaving] = useState(false)
  const [sharing, setSharing] = useState(false)
  const [completedPdf, setCompletedPdf] = useState<jsPDF | null>(null)
  const totals = calcBerichtTotals(tage)
  const spesen = calcBerichtSpesen(tage)

  async function uploadSignature(blob: Blob, who: 'techniker' | 'kunde') {
    const path = `${bericht.id}/${who}.png`
    const { error } = await supabase.storage.from('signatures').upload(path, blob, { upsert: true, contentType: 'image/png' })
    if (error) throw error
    return supabase.storage.from('signatures').getPublicUrl(path).data.publicUrl
  }

  async function handleSave() {
    if (!sigTechRef.current?.hasStroke()) { toast('Bitte zuerst die Techniker-Unterschrift eintragen.'); return }
    if (!sigKundeRef.current?.hasStroke()) { toast('Bitte zuerst die Kunden-Unterschrift eintragen.'); return }
    setSaving(true)
    try {
      const techDataUrl = sigTechRef.current.toDataUrl()
      const kundeDataUrl = sigKundeRef.current.toDataUrl()
      const [techBlob, kundeBlob] = await Promise.all([sigTechRef.current.toBlob(), sigKundeRef.current.toBlob()])
      if (!techBlob || !kundeBlob) throw new Error('Unterschrift konnte nicht erzeugt werden.')
      const [techUrl, kundeUrl] = await Promise.all([uploadSignature(techBlob, 'techniker'), uploadSignature(kundeBlob, 'kunde')])
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
        tage, ersatzteile, machine, techniker, order,
        technikerSignatureDataUrl: techDataUrl,
        kundeSignatureDataUrl: kundeDataUrl,
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
      berichtMailText(order, bericht, techniker?.name),
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

  if (completedPdf) {
    return (
      <div>
        <div className="border border-green p-4 mb-5">
          <div className="font-semibold mb-1">✓ Servicebericht {bericht.bericht_nummer} abgeschlossen</div>
          <p className="text-sm text-ink-soft m-0">Beide Unterschriften wurden gespeichert. Der Bericht liegt jetzt in Auftrag #{order.id} — die Disposition kann ihn dort jederzeit herunterladen. Du kannst ihn hier optional direkt an den Kunden schicken oder herunterladen.</p>
        </div>
        {order.ansprechpartner?.email && (
          <p className="text-sm text-ink-soft -mt-3 mb-4">
            ✉️ Ansprechpartner: <b className="text-ink">{order.ansprechpartner.email}</b> — Begleittext ist vorbereitet. Das Empfängerfeld füllen Apple und Android beim Teilen nicht aus; die Adresse wird beim Teilen in die Zwischenablage gelegt, du musst sie nur einfügen.
          </p>
        )}
        <div className="flex gap-2.5 flex-wrap">
          <button className="btn btn-amber" disabled={sharing} onClick={handleShare}>{sharing ? 'Öffne Teilen…' : '📤 Per E-Mail / Teilen senden'}</button>
          {order.ansprechpartner?.email && (
            <a
              className="btn btn-outline"
              href={berichtMailtoUrl(order, bericht, techniker?.name)}
              onClick={() => completedPdf.save(berichtPdfFilename(bericht))}
            >
              ✉️ E-Mail mit Empfänger öffnen
            </a>
          )}
          <button className="btn btn-outline" onClick={() => completedPdf.save(berichtPdfFilename(bericht))}>PDF herunterladen</button>
          <button className="btn btn-outline" onClick={onDone}>Fertig, zurück zum Auftrag</button>
        </div>
        {order.ansprechpartner?.email && (
          <p className="text-[13px] text-ink-soft mt-3 mb-0">
            „E-Mail mit Empfänger öffnen" trägt Empfänger, Betreff und Text ein und lädt das PDF herunter — anhängen musst du es dann selbst. Anhänge lassen sich über diesen Weg technisch nicht mitgeben.
          </p>
        )}
      </div>
    )
  }

  return (
    <div>
      <button className="text-sm text-steel bg-transparent border-none cursor-pointer p-0 mb-4" onClick={onBack}>← Zurück zum Servicebericht</button>
      <h1 className="text-xl font-semibold m-0">Servicebericht — Vorschau vor der Unterschrift</h1>
      <p className="text-sm text-ink-soft mt-1 mb-4">So sieht es aus, bevor beide unterschreiben.</p>

      <div className="grid grid-cols-2 gap-x-6 gap-y-3 mb-6 max-sm:grid-cols-1">
        <div><label>Servicebericht-Nr.</label><div className="val">{bericht.bericht_nummer}</div></div>
        <div><label>Auftrag</label><div className="val">#{order.id}</div></div>
        <div><label>Maschine</label><div className="val">{machine?.bezeichnung || bericht.maschine_id}</div></div>
        <div><label>Techniker</label><div className="val">{techniker?.name || '–'}</div></div>
        <div><label>Tage</label><div className="val">{tage.length}</div></div>
        <div><label>Betriebsstunden</label><div className="val">{bericht.betriebsstunden ?? '–'} h</div></div>
        <div><label>Spindelstunden</label><div className="val">{bericht.spindelstunden ?? '–'} h</div></div>
        <div className="col-span-2"><label>Fehlerbeschreibung</label><div className="val">{bericht.fehlerbeschreibung || '–'}</div></div>
        <div className="col-span-2"><label>Durchgeführte Arbeiten</label><div className="val">{bericht.durchgefuehrte_arbeiten || '–'}</div></div>
        {bericht.empfehlung && <div className="col-span-2"><label>Empfehlung</label><div className="val">{bericht.empfehlung}</div></div>}
        <div><label>Arbeit normal / +50% / +100%</label><div className="val">{totals.arbeitNormal} h / {totals.arbeitZuschlag50} h / {totals.arbeitZuschlag100} h</div></div>
        <div><label>Reise normal / +50% / +100%</label><div className="val">{totals.reiseNormal} h / {totals.reiseZuschlag50} h / {totals.reiseZuschlag100} h</div></div>
        <div><label>Spesen (Verpflegung / Hotel)</label><div className="val">{spesen.verpflegungGesamt.toFixed(2)} € / {spesen.hotelGesamt.toFixed(2)} €</div></div>
        {ersatzteile.length > 0 && (
          <div className="col-span-2">
            <label>Ersatzteile</label>
            <div className="val">{ersatzteile.map((t) => `${t.id_nummer || '–'} · ${t.bezeichnung} · ${t.menge} Stk`).join(' · ')}</div>
          </div>
        )}
      </div>

      <div className="font-semibold text-sm uppercase tracking-wide text-ink-soft mb-1.5">Unterschrift Techniker ({techniker?.name || '–'})</div>
      <SignaturePad ref={sigTechRef} />
      <div className="mt-2 mb-5"><button className="btn btn-outline btn-sm" onClick={() => sigTechRef.current?.clear()}>Löschen</button></div>

      <div className="font-semibold text-sm uppercase tracking-wide text-ink-soft mb-1.5">Unterschrift Kunde</div>
      <SignaturePad ref={sigKundeRef} />
      <p className="text-xs text-ink-soft mt-2 max-w-md">Beide Unterschriften bestätigen die oben aufgeführten Leistungen und Stunden. Nach dem Abschließen ist der Bericht für niemanden mehr änderbar.</p>
      <div className="mt-2 mb-5"><button className="btn btn-outline btn-sm" onClick={() => sigKundeRef.current?.clear()}>Löschen</button></div>

      <div className="flex gap-2.5 flex-wrap">
        <button className="btn btn-amber" disabled={saving} onClick={handleSave}>{saving ? 'Schließe ab…' : 'Beide Unterschriften bestätigen & abschließen'}</button>
        <button className="btn btn-outline" onClick={onBack}>Zurück, noch nicht fertig</button>
      </div>
    </div>
  )
}
