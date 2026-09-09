// Firmenlogo, aus der Original-Servicebericht-Vorlage extrahiert. Liegt im
// öffentlichen "machine-photos"-Bucket in Supabase Storage (kein Bild-Asset im
// Build nötig, funktioniert identisch in App-UI und PDF-Export).
const BASE = 'https://cyvjcskxqluqmerjxqty.supabase.co/storage/v1/object/public/machine-photos/branding'

export const LOGO_URL = `${BASE}/lsd-logo.png`
export const ICON_512_URL = `${BASE}/icon-512.png`
export const ICON_192_URL = `${BASE}/icon-192.png`
export const APPLE_TOUCH_ICON_URL = `${BASE}/apple-touch-icon.png`
export const FAVICON_URL = `${BASE}/favicon-32.png`
