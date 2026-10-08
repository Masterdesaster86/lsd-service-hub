import { useEffect, useState } from 'react'
import { Modal, ModalActions, ModalTitle } from '../../components/ui/Modal'
import { useToast } from '../../components/ui/Toast'
import { easybillAufruf } from '../../lib/easybillRechnung'
import type { ServiceberichtErsatzteil } from '../../lib/types'

interface Treffer { id: number; nummer: string | null; bezeichnung: string; einheit: string | null; preis: number | null }

/** Ordnet einem Ersatzteil aus dem Bericht einen easybill-Artikel zu — vorhandenen suchen oder neu anlegen. */
export function ErsatzteilArtikelModal({ teil, onClose, onSaved }: { teil: ServiceberichtErsatzteil; onClose: () => void; onSaved: () => void }) {
  const toast = useToast()
  const [suche, setSuche] = useState(teil.id_nummer || teil.bezeichnung)
  const [treffer, setTreffer] = useState<Treffer[] | null>(null)
  const [sucht, setSucht] = useState(false)
  const [neuName, setNeuName] = useState(`${teil.bezeichnung}${teil.id_nummer ? ' ' + teil.id_nummer : ''}`)
  const [neuPreis, setNeuPreis] = useState('')
  const [laeuft, setLaeuft] = useState(false)

  useEffect(() => {
    const t = setTimeout(async () => {
      setSucht(true)
      try { setTreffer((await easybillAufruf<{ treffer: Treffer[] }>({ aktion: 'artikel_suchen', suche })).treffer) }
      catch (e) { toast((e as Error).message) }
      finally { setSucht(false) }
    }, 400)
    return () => clearTimeout(t)
  }, [suche]) // eslint-disable-line react-hooks/exhaustive-deps

  async function zuordnen(positionId: number) {
    setLaeuft(true)
    try {
      await easybillAufruf({ aktion: 'ersatzteil_zuordnen', ersatzteil_id: teil.id, position_id: positionId })
      toast('Ersatzteil zugeordnet.')
      onSaved()
    } catch (e) { toast((e as Error).message) } finally { setLaeuft(false) }
  }

  async function neuAnlegen() {
    const preis = Number(neuPreis.replace(',', '.'))
    if (!neuName.trim() || !(preis >= 0) || neuPreis.trim() === '') { toast('Bitte Bezeichnung und Verkaufspreis (netto) eintragen.'); return }
    setLaeuft(true)
    try {
      const neu = await easybillAufruf<{ id: number; nummer: string }>({ aktion: 'artikel_anlegen', bezeichnung: neuName.trim(), preis })
      await easybillAufruf({ aktion: 'ersatzteil_zuordnen', ersatzteil_id: teil.id, position_id: neu.id })
      toast(`Artikel ${neu.nummer} in easybill angelegt und zugeordnet.`)
      onSaved()
    } catch (e) { toast((e as Error).message) } finally { setLaeuft(false) }
  }

  const euro = (n: number | null) => (n == null ? '–' : `${n.toFixed(2).replace('.', ',')} €`)

  return (
    <Modal onClose={onClose} width={560}>
      <ModalTitle>Ersatzteil in easybill zuordnen</ModalTitle>
      <p className="text-sm text-ink-soft -mt-2 mb-4">{teil.menge} × {teil.bezeichnung}{teil.id_nummer ? ` (${teil.id_nummer})` : ''}</p>

      <div className="abschnitt mb-1.5">Vorhandenen Artikel suchen</div>
      <input value={suche} onChange={(e) => setSuche(e.target.value)} placeholder="Bezeichnung oder Artikelnummer" />
      <div className="bg-white border border-line mt-2 max-h-[260px] overflow-y-auto">
        {sucht && treffer === null ? <div className="p-3 text-sm text-ink-soft">Sucht…</div>
          : !treffer || treffer.length === 0 ? <div className="p-3 text-sm text-ink-soft">Kein passender Artikel in easybill.</div>
          : treffer.map((t) => (
            <button key={t.id} type="button" disabled={laeuft} onClick={() => zuordnen(t.id)}
              className="w-full text-left px-3 py-2.5 border-b border-line last:border-b-0 bg-transparent border-x-0 border-t-0 cursor-pointer hover:bg-paper">
              <div className="text-[15px]">{t.bezeichnung}</div>
              <div className="font-mono text-[12px] text-ink-soft">{t.nummer || '–'} · {euro(t.preis)} · {t.einheit || 'Stück'}</div>
            </button>
          ))}
      </div>

      <div className="abschnitt mt-5 mb-1.5">Oder neu in easybill anlegen</div>
      <div className="grid grid-cols-3 gap-3.5 max-sm:grid-cols-1">
        <div className="col-span-2"><label>Bezeichnung</label><input value={neuName} onChange={(e) => setNeuName(e.target.value)} /></div>
        <div><label>Verkaufspreis netto (€)</label><input inputMode="decimal" value={neuPreis} onChange={(e) => setNeuPreis(e.target.value)} placeholder="z.B. 9,00" /></div>
      </div>
      <p className="text-[13px] text-ink-soft mt-2">Der Artikel bekommt die nächste freie Nummer ab 2400011, 19 % und die Einheit Stück. Preisregel: Einkauf netto + 50 %.</p>

      <ModalActions>
        <button className="btn btn-amber" disabled={laeuft} onClick={neuAnlegen}>{laeuft ? 'Speichert…' : 'Neu anlegen und zuordnen'}</button>
        <button className="btn btn-outline" onClick={onClose}>Abbrechen</button>
      </ModalActions>
    </Modal>
  )
}
