// Push-Nachrichten "Neuer Auftrag" (Web-Push).
//
// Das Gerät meldet sich beim Push-Dienst des Browsers (Apple/Google/Mozilla) an und
// speichert die Adresse über push_abo_speichern() in Supabase. Verschickt wird serverseitig
// von der Edge Function push-senden, ausgelöst durch einen Trigger auf order_techniker.
//
// iPhone/iPad: geht nur, wenn die App über "Zum Home-Bildschirm" installiert ist (iOS 16.4+)
// und von dort gestartet wird.

import { supabase } from './supabase'

/** Öffentlicher VAPID-Schlüssel (darf öffentlich sein; der private liegt nur im Supabase-Vault). */
const VAPID_PUBLIC = 'BPmkLL8aMgccIZM5VPCoygGFFal_8lI6pUJUVNwKZW4tnzVnRIGOa0YFNKQJDJ7hzZxVXxuOaXxeyKq4yw6AN1E'

export type PushZustand =
  | 'nicht-moeglich' // Browser kann kein Push
  | 'ios-installieren' // iPhone im Safari-Tab: erst zum Home-Bildschirm
  | 'blockiert' // Erlaubnis wurde verweigert
  | 'aus'
  | 'an'

export const istIOS = () =>
  /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

export const istInstalliert = () =>
  window.matchMedia?.('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true

function schluesselBytes(b64: string): Uint8Array<ArrayBuffer> {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4)
  const roh = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'))
  const out = new Uint8Array(new ArrayBuffer(roh.length))
  for (let i = 0; i < roh.length; i++) out[i] = roh.charCodeAt(i)
  return out
}

async function registrierung(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null
  // Im Entwicklungsmodus gibt es keinen Service Worker; dann nicht ewig warten.
  return Promise.race([
    navigator.serviceWorker.ready,
    new Promise<null>((r) => setTimeout(() => r(null), 4000)),
  ])
}

export async function pushZustand(): Promise<PushZustand> {
  const kannPush = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
  if (!kannPush) return istIOS() && !istInstalliert() ? 'ios-installieren' : 'nicht-moeglich'
  if (Notification.permission === 'denied') return 'blockiert'
  if (Notification.permission !== 'granted') return 'aus'
  const reg = await registrierung()
  const abo = await reg?.pushManager.getSubscription()
  return abo ? 'an' : 'aus'
}

function geraetename() {
  const ua = navigator.userAgent
  if (/iPhone/.test(ua)) return 'iPhone'
  if (/iPad/.test(ua) || istIOS()) return 'iPad'
  if (/Android/.test(ua)) return 'Android'
  if (/Windows/.test(ua)) return 'Windows'
  if (/Mac/.test(ua)) return 'Mac'
  return 'Gerät'
}

/** Muss direkt aus einem Tippen heraus aufgerufen werden (sonst fragt iOS nicht). */
export async function pushEinschalten(): Promise<PushZustand> {
  const erlaubnis = await Notification.requestPermission()
  if (erlaubnis !== 'granted') return erlaubnis === 'denied' ? 'blockiert' : 'aus'
  const reg = await registrierung()
  if (!reg) throw new Error('Die App ist noch nicht fertig geladen. Bitte kurz warten und nochmal tippen.')
  let abo = await reg.pushManager.getSubscription()
  if (!abo) abo = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: schluesselBytes(VAPID_PUBLIC) })
  const j = abo.toJSON()
  const { error } = await supabase.rpc('push_abo_speichern', {
    p_endpoint: abo.endpoint,
    p_p256dh: j.keys?.p256dh ?? '',
    p_auth: j.keys?.auth ?? '',
    p_geraet: geraetename(),
  })
  if (error) throw new Error(error.message)
  return 'an'
}

export async function pushAusschalten(): Promise<PushZustand> {
  const reg = await registrierung()
  const abo = await reg?.pushManager.getSubscription()
  if (abo) {
    await supabase.rpc('push_abo_loeschen', { p_endpoint: abo.endpoint })
    await abo.unsubscribe()
  }
  return 'aus'
}

/** Schickt eine Probe-Nachricht an alle eigenen Geräte. */
export async function pushProbe(): Promise<{ geraete: number; ok: number }> {
  const { data, error } = await supabase.functions.invoke('push-senden', { body: { test: true } })
  if (error) throw new Error(error.message)
  return data as { geraete: number; ok: number }
}

/**
 * Bei jedem App-Start: Ist die Erlaubnis da, das Abo erneuern bzw. dem gerade
 * angemeldeten Mitarbeiter zuordnen (Push-Dienste wechseln die Adresse gelegentlich).
 */
export async function pushAboAuffrischen() {
  try {
    if (!('PushManager' in window) || Notification.permission !== 'granted') return
    const reg = await registrierung()
    const abo = await reg?.pushManager.getSubscription()
    if (!abo) return
    const j = abo.toJSON()
    await supabase.rpc('push_abo_speichern', {
      p_endpoint: abo.endpoint, p_p256dh: j.keys?.p256dh ?? '', p_auth: j.keys?.auth ?? '', p_geraet: geraetename(),
    })
  } catch { /* offline oder egal */ }
}
