// Erzeugt die App-Symbole unter public/icons.
// Aufruf aus dem Projektordner:  node tools/symbole-erzeugen.mjs
// Benoetigt sharp, das bewusst nicht als Abhaengigkeit gefuehrt wird:
//   npm install --no-save sharp

import sharp from 'sharp'

const BLAU = '#0070B8'

/**
 * Wortmarke: blaues "LSD" auf Weiß, darunter ein blauer Balken mit "SERVICE HUB".
 * Alle Maße als Anteil der Kantenlänge, damit jede Größe gleich aussieht.
 */
function symbol(S) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}">
    <rect width="${S}" height="${S}" fill="white"/>
    <rect x="0" y="${S * 0.82}" width="${S}" height="${S * 0.18}" fill="${BLAU}"/>
    <text x="${S / 2}" y="${S * 0.55}" font-family="Arial Black, Arial, sans-serif"
          font-size="${S * 0.36}" font-weight="900" fill="${BLAU}" text-anchor="middle">LSD</text>
    <text x="${S / 2}" y="${S * 0.94}" font-family="Arial, sans-serif" font-size="${S * 0.085}"
          font-weight="700" fill="white" text-anchor="middle" letter-spacing="${S * 0.02}">SERVICE HUB</text>
  </svg>`
}

/**
 * Für Android beschneiden Hersteller das Symbol zu Kreisen und anderen Formen.
 * Deshalb ohne Balken am Rand und mit allem Inhalt in der sicheren Mitte.
 */
function maskable(S) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}">
    <rect width="${S}" height="${S}" fill="white"/>
    <text x="${S / 2}" y="${S * 0.54}" font-family="Arial Black, Arial, sans-serif"
          font-size="${S * 0.28}" font-weight="900" fill="${BLAU}" text-anchor="middle">LSD</text>
    <text x="${S / 2}" y="${S * 0.65}" font-family="Arial, sans-serif" font-size="${S * 0.068}"
          font-weight="700" fill="${BLAU}" text-anchor="middle" letter-spacing="${S * 0.016}">SERVICE HUB</text>
  </svg>`
}

/** Im Browser-Tab ist der Zusatz nur noch Matsch — dort reicht "LSD". */
function favicon(S) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}">
    <rect width="${S}" height="${S}" fill="white"/>
    <text x="${S / 2}" y="${S * 0.72}" font-family="Arial Black, Arial, sans-serif"
          font-size="${S * 0.46}" font-weight="900" fill="${BLAU}" text-anchor="middle">LSD</text>
  </svg>`
}

const dateien = [
  ['public/icons/apple-touch-icon.png', symbol(180)],
  ['public/icons/icon-192.png', symbol(192)],
  ['public/icons/icon-512.png', symbol(512)],
  ['public/icons/icon-512-maskable.png', maskable(512)],
  ['public/icons/favicon-32.png', favicon(32)],
]

for (const [datei, svg] of dateien) {
  await sharp(Buffer.from(svg)).png().toFile(datei)
  console.log(datei)
}
