import { useCallback, useEffect, useState } from 'react'
import { useToast } from './ui/Toast'
import { pushAboAuffrischen, pushAusschalten, pushEinschalten, pushProbe, pushZustand, type PushZustand } from '../lib/push'

const HINWEIS_WEG = 'lsd-push-hinweis-weg'

function usePush() {
  const [zustand, setZustand] = useState<PushZustand | null>(null)
  const [laeuft, setLaeuft] = useState(false)
  const toast = useToast()

  useEffect(() => {
    pushZustand().then(setZustand).catch(() => setZustand('nicht-moeglich'))
  }, [])

  const einschalten = useCallback(async () => {
    setLaeuft(true)
    try {
      const z = await pushEinschalten()
      setZustand(z)
      if (z === 'an') toast('Push-Nachrichten sind eingeschaltet.')
      else if (z === 'blockiert') toast('Mitteilungen sind für die App gesperrt (Einstellungen von Handy bzw. Browser).')
    } catch (e) {
      toast(`Einschalten hat nicht geklappt: ${(e as Error).message}`)
    } finally {
      setLaeuft(false)
    }
  }, [toast])

  const ausschalten = useCallback(async () => {
    setLaeuft(true)
    try { setZustand(await pushAusschalten()) } finally { setLaeuft(false) }
  }, [])

  const probe = useCallback(async () => {
    setLaeuft(true)
    try {
      const r = await pushProbe()
      toast(r.ok > 0 ? 'Probe-Nachricht verschickt. Sie sollte gleich erscheinen.' : 'Kein Gerät erreicht. Bitte Push aus- und wieder einschalten.')
    } catch (e) {
      toast(`Probe fehlgeschlagen: ${(e as Error).message}`)
    } finally {
      setLaeuft(false)
    }
  }, [toast])

  return { zustand, laeuft, einschalten, ausschalten, probe }
}

const TEXTE: Record<PushZustand, string> = {
  'an': 'Eingeschaltet: Du bekommst eine Nachricht, wenn dir ein neuer Auftrag zugewiesen wird.',
  'aus': 'Ausgeschaltet.',
  'blockiert': 'Gesperrt. In den Einstellungen (Handy bzw. Browser) für „Service Hub“ Mitteilungen erlauben, dann hier einschalten.',
  'ios-installieren': 'Am iPhone geht das nur in der installierten App: In Safari auf „Teilen“ → „Zum Home-Bildschirm“, dann die App von dort öffnen.',
  'nicht-moeglich': 'Dieser Browser unterstützt keine Push-Nachrichten.',
}

/** Eintrag im Menü „Mehr“ (Handy) bzw. in der Seitenleiste (Desktop). */
export function PushSchalter({ dunkel = false }: { dunkel?: boolean }) {
  const { zustand, laeuft, einschalten, ausschalten, probe } = usePush()
  if (!zustand) return null
  const text = dunkel ? 'text-[#b7bec5]' : 'text-ink-soft'
  return (
    <div className={dunkel ? 'px-4 py-3 border-t border-white/10' : 'px-4 py-3.5 border-b border-line'}>
      <div className={dunkel ? 'font-mono text-[11.5px] uppercase tracking-[0.05em] text-[#eef0ee]' : 'font-semibold text-[16px]'}>
        Push bei neuem Auftrag
      </div>
      <div className={`text-[13px] mt-1 ${text}`}>{TEXTE[zustand]}</div>
      {(zustand === 'aus' || zustand === 'an') && (
        <div className="flex gap-2 mt-2.5 flex-wrap">
          {zustand === 'aus' && (
            <button disabled={laeuft} onClick={einschalten} className="btn btn-amber btn-sm">Einschalten</button>
          )}
          {zustand === 'an' && (
            <>
              <button disabled={laeuft} onClick={probe} className={`btn btn-sm ${dunkel ? '!bg-transparent !text-[#eef0ee] !border-[#9aa7ac]' : 'btn-outline'}`}>Probe senden</button>
              <button disabled={laeuft} onClick={ausschalten} className={`btn btn-sm ${dunkel ? '!bg-transparent !text-[#9aa7ac] !border-transparent' : 'btn-outline'}`}>Ausschalten</button>
            </>
          )}
        </div>
      )}
    </div>
  )
}

/** Einmaliger Hinweis oben auf der Seite, solange Push noch nicht eingeschaltet ist. */
export function PushHinweis() {
  const { zustand, laeuft, einschalten } = usePush()
  const [weg, setWeg] = useState(() => {
    try { return localStorage.getItem(HINWEIS_WEG) === '1' } catch { return false }
  })

  // Abo bei jedem Start dem angemeldeten Mitarbeiter zuordnen / erneuern.
  useEffect(() => { pushAboAuffrischen() }, [])

  if (weg || (zustand !== 'aus' && zustand !== 'ios-installieren')) return null
  const ausblenden = () => {
    try { localStorage.setItem(HINWEIS_WEG, '1') } catch { /* egal */ }
    setWeg(true)
  }
  return (
    <div className="mb-4 border-[1.5px] border-amber bg-white p-3.5 flex items-start gap-3 max-md:flex-col">
      <div className="flex-1 text-[14px]">
        <div className="font-semibold">Neue Aufträge aufs Handy melden lassen?</div>
        <div className="text-ink-soft text-[13px] mt-0.5">
          {zustand === 'ios-installieren'
            ? TEXTE['ios-installieren']
            : 'Dann kommt eine Push-Nachricht, sobald dir ein Auftrag zugewiesen wird.'}
        </div>
      </div>
      <div className="flex gap-2 shrink-0">
        {zustand === 'aus' && <button disabled={laeuft} onClick={einschalten} className="btn btn-amber btn-sm">Einschalten</button>}
        <button onClick={ausblenden} className="btn btn-outline btn-sm">{zustand === 'aus' ? 'Später' : 'Verstanden'}</button>
      </div>
    </div>
  )
}
