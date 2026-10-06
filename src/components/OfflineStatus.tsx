import { useEffect, useState } from 'react'
import { useAuth } from '../lib/AuthContext'
import {
  aufZustandHoeren, erneutVersuchen, offlineZustand, synchronisieren, verbindungPruefen, verwerfen, warteschlangeAnzeigen,
  type OfflineZustand, type WarteEintrag,
} from '../lib/offline'
import { datenstand, fuerEinsatzVorbereiten, letzteVorbereitung, type Fortschritt } from '../lib/vorbereiten'
import { Modal, ModalActions, ModalTitle } from './ui/Modal'
import { useConfirm } from './ui/ConfirmProvider'
import { useToast } from './ui/Toast'

export function useOfflineZustand(): OfflineZustand {
  const [z, setZ] = useState(offlineZustand())
  useEffect(() => aufZustandHoeren(setZ), [])
  return z
}

/** Kleine Anzeige in der Kopfleiste: Netzstatus und wartende Änderungen. Antippen öffnet Details. */
export function OfflineStatus({ onOpen }: { onOpen: () => void }) {
  const z = useOfflineZustand()
  const problem = z.fehler !== null
  const farbe = problem ? 'bg-[#c0392b]' : z.offline ? 'bg-[#d68a00]' : z.wartend ? 'bg-amber' : 'bg-[#2f9e5b]'
  const text = problem ? 'Fehler' : z.offline ? 'Offline' : z.wartend ? 'Lädt hoch' : 'Online'
  return (
    <button
      onClick={onOpen}
      className="flex items-center gap-2 min-h-[44px] px-2 bg-transparent border-0 cursor-pointer text-[#eef0ee]"
      aria-label={`Verbindung: ${text}${z.wartend ? `, ${z.wartend} Änderungen warten` : ''}`}
    >
      <span className={`w-2.5 h-2.5 ${farbe}`} />
      <span className={`font-mono text-[11.5px] uppercase tracking-[0.08em] ${z.offline || z.wartend || problem ? '' : 'max-md:hidden'}`}>
        {text}{z.wartend ? ` · ${z.wartend}` : ''}
      </span>
    </button>
  )
}

/** Details: Warteschlange, Fehler und "Für Einsatz vorbereiten". */
export function OfflineDialog({ onClose }: { onClose: () => void }) {
  const z = useOfflineZustand()
  const { employee } = useAuth()
  const toast = useToast()
  const confirm = useConfirm()
  const [liste, setListe] = useState<WarteEintrag[]>([])
  const [fortschritt, setFortschritt] = useState<Fortschritt | null>(null)
  // Stand des Geräts gegenüber der Datenbank: 'pruefe' | 'aktuell' | 'veraltet' | 'unbekannt'
  const [stand, setStand] = useState<'pruefe' | 'aktuell' | 'veraltet' | 'unbekannt'>('pruefe')
  const [pruefe, setPruefe] = useState(false)
  const letzte = letzteVorbereitung()

  useEffect(() => { void warteschlangeAnzeigen().then(setListe) }, [z.wartend, z.fehler])

  // Beim Öffnen (und nach jedem Hochladen) prüfen, ob das Gerät noch dem Stand der Datenbank entspricht.
  useEffect(() => {
    if (!employee || fortschritt) return
    if (z.offline || !letzte) { setStand('unbekannt'); return }
    let aktiv = true
    setStand('pruefe')
    datenstand(employee)
      .then((s) => { if (aktiv) setStand(s === letzte.stand ? 'aktuell' : 'veraltet') })
      .catch(() => { if (aktiv) setStand('unbekannt') })
    return () => { aktiv = false }
    // letzte ändert sich nur durch vorbereiten(), das fortschritt setzt
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employee, z.offline, z.wartend, fortschritt])

  async function vorbereiten() {
    if (!employee) return
    try {
      const n = await fuerEinsatzVorbereiten(employee, setFortschritt)
      toast(`Fertig: ${n} offene Aufträge sind auf dem Gerät gespeichert.`)
    } catch (e) {
      toast('Vorbereiten fehlgeschlagen: ' + (e instanceof Error ? e.message : 'unbekannter Fehler'))
    } finally {
      setFortschritt(null)
    }
  }

  async function pruefen() {
    setPruefe(true)
    try {
      const ok = await verbindungPruefen()
      toast(ok ? 'Server erreichbar.' : 'Server nicht erreichbar. Hilft auch Warten nicht: App einmal schließen und neu öffnen.')
    } finally {
      setPruefe(false)
    }
  }

  async function wegwerfen(e: WarteEintrag) {
    const ok = await confirm({ message: `„${e.titel}“ wirklich verwerfen? Diese Änderung geht dann verloren.`, confirmLabel: 'Verwerfen', danger: true })
    if (ok) await verwerfen(e.id!)
  }

  const uhrzeit = (t: number) => new Date(t).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })

  return (
    <Modal onClose={onClose}>
      <ModalTitle>Verbindung</ModalTitle>
      <p className="text-sm leading-relaxed -mt-1">
        {z.offline
          ? 'Kein Netz. Du kannst weiterarbeiten: Änderungen werden auf dem Gerät gespeichert und hochgeladen, sobald wieder Netz da ist.'
          : z.wartend
            ? 'Netz ist da, die gespeicherten Änderungen werden gerade hochgeladen.'
            : 'Online. Alle Änderungen sind hochgeladen.'}
      </p>
      {z.pruefung && (
        <div className="font-mono text-[12px] text-ink-soft mt-2">
          Letzte Prüfung {uhrzeit(z.pruefung.zeit)}: {z.pruefung.ok ? 'Server erreichbar' : z.pruefung.grund}
        </div>
      )}
      {z.offline && (
        <button className="btn btn-outline mt-3" disabled={pruefe} onClick={() => void pruefen()}>
          {pruefe ? 'Prüfe …' : 'Verbindung prüfen'}
        </button>
      )}

      {liste.length > 0 && (
        <div className="mt-4 border border-line">
          <div className="px-3 py-2 border-b border-line font-mono text-[11.5px] uppercase tracking-[0.06em] text-ink-soft">
            Noch nicht hochgeladen ({liste.length})
          </div>
          {liste.map((e) => (
            <div key={e.id} className="px-3 py-2.5 border-b border-line last:border-b-0">
              <div className="flex justify-between gap-3 text-sm">
                <span className="font-semibold">{e.titel}</span>
                <span className="font-mono text-[12px] text-ink-soft shrink-0">{uhrzeit(e.zeit)}</span>
              </div>
              {e.fehler && (
                <>
                  <div className="text-[13px] text-[#c0392b] mt-1">{e.fehler}</div>
                  <div className="flex gap-2 mt-2">
                    <button className="btn btn-sm btn-amber" onClick={() => void erneutVersuchen(e.id!)}>Erneut versuchen</button>
                    <button className="btn btn-sm btn-outline" onClick={() => void wegwerfen(e)}>Verwerfen</button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="mt-5 border-t border-line pt-4">
        <h3 className="m-0 text-[15px] font-semibold">Für Einsatz vorbereiten</h3>
        <p className="text-sm text-ink-soft leading-relaxed mt-1 mb-3">
          Vor der Fahrt zum Kunden mit Netz antippen: Deine offenen Aufträge mit Berichten, Messprotokollen, Maschinen und Kunden werden auf dem Gerät gespeichert.
        </p>
        {fortschritt ? (
          <div>
            <div className="h-2 bg-line">
              <div className="h-2 bg-amber transition-[width]" style={{ width: `${fortschritt.gesamt ? (fortschritt.fertig / fortschritt.gesamt) * 100 : 0}%` }} />
            </div>
            <div className="font-mono text-[12px] text-ink-soft mt-1.5">
              {fortschritt.fertig} / {fortschritt.gesamt} {fortschritt.aktuell && `· ${fortschritt.aktuell}`}
            </div>
          </div>
        ) : (
          <>
            <button className="btn btn-amber w-full" disabled={z.offline || stand === 'pruefe' || stand === 'aktuell'} onClick={() => void vorbereiten()}>
              {z.offline ? 'Nur mit Netz möglich'
                : stand === 'pruefe' ? 'Vergleiche mit Datenbank …'
                : stand === 'aktuell' ? 'Alles auf dem Gerät'
                : 'Jetzt vorbereiten'}
            </button>
            {letzte && (
              <div className="font-mono text-[12px] text-ink-soft mt-1.5">
                Zuletzt vorbereitet {uhrzeit(letzte.zeit)}
                {stand === 'aktuell' && ' · unverändert'}
                {stand === 'veraltet' && ' · seitdem gab es Änderungen'}
              </div>
            )}
          </>
        )}
      </div>

      <ModalActions>
        {liste.length > 0 && !z.offline && <button className="btn btn-outline" onClick={() => void synchronisieren()}>Jetzt hochladen</button>}
        <button className="btn btn-outline" onClick={onClose}>Schließen</button>
      </ModalActions>
    </Modal>
  )
}
