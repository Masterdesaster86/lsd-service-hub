import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { fetchTageskontext } from '../../lib/queries'
import type { Employee, Machine, OrderWithRelations, Servicebericht, ServiceberichtErsatzteil, ServiceberichtTag } from '../../lib/types'
import type { Tageskontext } from '../../lib/zeit'
import { Modal, ModalActions, ModalTitle } from '../../components/ui/Modal'
import { useToast } from '../../components/ui/Toast'
import { buildBerichtPdf, urlToDataUrl } from '../../lib/pdf'
import { baueRechnungsplan, easybillAufruf, pdfDateiname, type BerichtMitDaten, type PlanErgebnis } from '../../lib/easybillRechnung'
import { ErsatzteilArtikelModal } from './ErsatzteilArtikelModal'
import { formatDateDE } from '../../lib/format'

interface Vorbereitung {
  easybill_auftrag_id: number
  kunde: { id: number; name: string; preisstufe: string; vat_prozent: number }
  items: { type: string; position: number; description: string; quantity: number; unit?: string; single_price_net?: number; position_id?: number }[]
  fehlend: string[]
  vorhandene: { easybill_rechnung_id: number; erstellt_am: string; rechnung_nummer: string | null }[]
}

const euro = (cent: number) => `${(cent / 100).toFixed(2).replace('.', ',')} €`

/** Vorschau und Anlegen des easybill-Rechnungsentwurfs zu einem Auftrag. */
export function EasybillRechnungModal({ order, onClose, onAngelegt }: { order: OrderWithRelations; onClose: () => void; onAngelegt: () => void }) {
  const toast = useToast()
  const [ergebnis, setErgebnis] = useState<PlanErgebnis | null>(null)
  const [vorbereitung, setVorbereitung] = useState<Vorbereitung | null>(null)
  const [fehler, setFehler] = useState<string | null>(null)
  const [laeuft, setLaeuft] = useState<string | null>(null)
  const [zuordnen, setZuordnen] = useState<ServiceberichtErsatzteil | null>(null)
  const [trotzdem, setTrotzdem] = useState(false)
  const [fertig, setFertig] = useState<{ rechnung_id: number; netto: number; brutto: number; anhaenge: string[] } | null>(null)

  async function laden() {
    setFehler(null); setVorbereitung(null); setErgebnis(null)
    setLaeuft('Berichte werden gelesen…')
    try {
      const { data } = await supabase
        .from('serviceberichte')
        .select('*, tage:servicebericht_tage(*), ersatzteile:servicebericht_ersatzteile(*), machine:machines(*), techniker:employees(*)')
        .eq('auftrag_id', order.id)
      const rows = ((data || []) as unknown as (Servicebericht & { tage: ServiceberichtTag[]; ersatzteile: ServiceberichtErsatzteil[]; machine: Machine | null; techniker: Employee | null })[])
        .map((b) => ({ ...b, tage: [...b.tage].sort((x, y) => x.datum.localeCompare(y.datum)) })) as BerichtMitDaten[]
      const technikerIds = [...new Set(rows.map((b) => b.techniker_id))]
      const kontexte: Record<string, Tageskontext> = {}
      await Promise.all(technikerIds.map(async (tid) => { kontexte[tid] = await fetchTageskontext(tid, rows.filter((b) => b.techniker_id === tid).flatMap((b) => b.tage.map((t) => t.datum))) }))
      const erg = baueRechnungsplan(order, rows, kontexte)
      setErgebnis(erg)
      if (erg.berichte.length === 0) { setLaeuft(null); return }
      setLaeuft('Preise werden aus easybill geholt…')
      setVorbereitung(await easybillAufruf<Vorbereitung>({ aktion: 'vorbereiten', plan: erg.plan }))
    } catch (e) {
      setFehler((e as Error).message)
    } finally {
      setLaeuft(null)
    }
  }

  useEffect(() => { laden() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function anlegen() {
    if (!ergebnis || !vorbereitung) return
    try {
      setLaeuft('Bericht-PDFs werden erzeugt…')
      const pdfs: { name: string; base64: string }[] = []
      for (const b of ergebnis.berichte) {
        const [techDataUrl, kundeDataUrl] = await Promise.all([
          b.techniker_unterschrift_url ? urlToDataUrl(b.techniker_unterschrift_url) : Promise.resolve(null),
          b.kunde_unterschrift_url ? urlToDataUrl(b.kunde_unterschrift_url) : Promise.resolve(null),
        ])
        const kontext = await fetchTageskontext(b.techniker_id, b.tage.map((t) => t.datum))
        const doc = await buildBerichtPdf({
          bericht: b, tage: b.tage, tageskontext: kontext, ersatzteile: b.ersatzteile, machine: b.machine || undefined, techniker: b.techniker || undefined, order,
          technikerSignatureDataUrl: techDataUrl, kundeSignatureDataUrl: kundeDataUrl,
        })
        const bytes = new Uint8Array(doc.output('arraybuffer'))
        let bin = ''
        for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
        pdfs.push({ name: pdfDateiname(b, b.machine), base64: btoa(bin) })
      }
      setLaeuft('Rechnungsentwurf wird in easybill angelegt…')
      const r = await easybillAufruf<{ rechnung_id: number; netto: number; brutto: number; anhaenge: string[] }>({ aktion: 'anlegen', plan: { ...ergebnis.plan, pdfs }, trotzdem })
      setFertig(r)
      onAngelegt()
    } catch (e) {
      toast((e as Error).message)
    } finally {
      setLaeuft(null)
    }
  }

  const offeneEntwuerfe = (vorbereitung?.vorhandene || []).filter((v) => !v.rechnung_nummer)
  const blockiert = !vorbereitung || (!trotzdem && (vorbereitung.fehlend.length > 0 || (ergebnis?.offeneTeile.length || 0) > 0))
  const netto = (vorbereitung?.items || []).reduce((s, it) => s + (it.type === 'POSITION' ? (it.single_price_net || 0) * (it.quantity || 0) : 0), 0)

  return (
    <Modal onClose={onClose} width={680}>
      <ModalTitle>Rechnung in easybill anlegen</ModalTitle>
      <p className="text-sm text-ink-soft -mt-2 mb-4">Auftrag #{order.id} · {order.einsatzkunde?.name}</p>

      {fertig ? (
        <div>
          <div className="bg-white border border-line p-4 mb-4">
            <div className="abschnitt mb-2">Entwurf angelegt</div>
            <div className="text-[15px]">Netto <b>{euro(Math.round(fertig.netto * 100))}</b> · Brutto {euro(Math.round(fertig.brutto * 100))}</div>
            <div className="text-[14px] text-ink-soft mt-1">{fertig.anhaenge.length} Bericht-PDF{fertig.anhaenge.length === 1 ? '' : 's'} angehängt.</div>
          </div>
          <p className="text-[14px]">Jetzt in easybill prüfen und abschließen. Sobald die Rechnung eine Nummer hat, setzt die App die Berichte von selbst auf „abgerechnet“.</p>
          <ModalActions>
            <a className="btn btn-amber" href="https://app.easybill.de/" target="_blank" rel="noreferrer">easybill öffnen</a>
            <button className="btn btn-outline" onClick={onClose}>Schließen</button>
          </ModalActions>
        </div>
      ) : (
        <>
          {laeuft && <div className="text-sm text-ink-soft mb-3">{laeuft}</div>}
          {fehler && <div className="border border-red text-red p-3 text-[14px] mb-3">{fehler}</div>}

          {ergebnis && ergebnis.berichte.length === 0 && !laeuft && (
            <div className="text-sm text-ink-soft border border-dashed border-line p-4 text-center">Kein abgeschlossener, noch nicht abgerechneter Bericht zu diesem Auftrag.</div>
          )}

          {ergebnis && ergebnis.warnungen.length > 0 && (
            <ul className="border border-amber bg-white p-3 pl-7 text-[14px] mb-3 m-0">
              {ergebnis.warnungen.map((w, i) => <li key={i}>{w}</li>)}
            </ul>
          )}
          {offeneEntwuerfe.length > 0 && (
            <div className="border border-amber bg-white p-3 text-[14px] mb-3">
              Zu diesem Auftrag gibt es schon einen offenen Entwurf in easybill (vom {formatDateDE(offeneEntwuerfe[0].erstellt_am.slice(0, 10))}). Ein weiterer würde zusätzlich angelegt.
            </div>
          )}

          {ergebnis && ergebnis.offeneTeile.length > 0 && (
            <div className="bg-white border border-line p-3 mb-3">
              <div className="abschnitt mb-1.5">Ersatzteile ohne easybill-Artikel</div>
              {ergebnis.offeneTeile.map(({ teil, bericht }) => (
                <div key={teil.id} className="flex items-center justify-between gap-3 py-1.5 border-b border-line last:border-b-0">
                  <span className="text-[14px]">{teil.menge} × {teil.bezeichnung}{teil.id_nummer ? ` (${teil.id_nummer})` : ''} <span className="text-ink-soft">· {bericht.bericht_nummer}</span></span>
                  <button className="btn btn-outline btn-sm shrink-0" onClick={() => setZuordnen(teil)}>Zuordnen</button>
                </div>
              ))}
            </div>
          )}

          {vorbereitung && (
            <>
              <div className="font-mono text-[12px] text-ink-soft mb-1.5">
                easybill-Kunde: {vorbereitung.kunde.name} · Preisstufe {vorbereitung.kunde.preisstufe.replace('SALEPRICE', '') || '1'} · {vorbereitung.kunde.vat_prozent} % USt.
              </div>
              <div className="bg-white border border-line mb-3">
                {vorbereitung.items.map((it, i) => it.type === 'TEXT' ? (
                  <div key={i} className="px-3 py-2 font-semibold text-[14px] bg-paper border-b border-line">{it.description}</div>
                ) : (
                  <div key={i} className="flex items-baseline justify-between gap-3 px-3 py-1.5 border-b border-line last:border-b-0 text-[14px]">
                    <span>{it.description.replace(/\s+/g, ' ')}</span>
                    <span className="font-mono shrink-0 text-right">
                      {String(it.quantity).replace('.', ',')} {it.unit} × {euro(it.single_price_net || 0)} = <b>{euro(Math.round((it.single_price_net || 0) * (it.quantity || 0)))}</b>
                    </span>
                  </div>
                ))}
                <div className="flex items-baseline justify-between px-3 py-2 font-mono text-[14px]"><span>Netto</span><b>{euro(netto)}</b></div>
              </div>
              <div className="font-mono text-[12px] text-ink-soft mb-3">Leistungszeitraum {formatDateDE(ergebnis?.plan.leistung_von)} – {formatDateDE(ergebnis?.plan.leistung_bis)} · Zahlungsziel 14 Tage · Vorlage Briefpapier</div>
              {vorbereitung.fehlend.length > 0 && (
                <ul className="border border-red text-red bg-white p-3 pl-7 text-[14px] mb-3 m-0">
                  {vorbereitung.fehlend.map((f, i) => <li key={i}>{f}</li>)}
                </ul>
              )}
              {(vorbereitung.fehlend.length > 0 || (ergebnis?.offeneTeile.length || 0) > 0) && (
                <label className="flex items-center gap-2 text-[14px] mb-2 cursor-pointer">
                  <input type="checkbox" checked={trotzdem} onChange={(e) => setTrotzdem(e.target.checked)} /> Trotzdem anlegen (fehlende Teile und Preise trage ich in easybill nach)
                </label>
              )}
            </>
          )}

          <ModalActions>
            <button className="btn btn-amber" disabled={blockiert || !!laeuft} onClick={anlegen}>Entwurf in easybill anlegen</button>
            <button className="btn btn-outline" disabled={!!laeuft} onClick={laden}>Neu berechnen</button>
            <button className="btn btn-outline" onClick={onClose}>Abbrechen</button>
          </ModalActions>
        </>
      )}

      {zuordnen && <ErsatzteilArtikelModal teil={zuordnen} onClose={() => setZuordnen(null)} onSaved={() => { setZuordnen(null); laden() }} />}
    </Modal>
  )
}
