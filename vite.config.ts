import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig, type Plugin } from 'vite'
import { readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const BUILD_ID = Date.now().toString(36)

/** Alle Dateien eines Ordners unter public/ (für die Offline-Liste). */
function dateienUnter(ordner: string): string[] {
  const basis = join(__dirname, 'public')
  const raus: string[] = []
  const gehe = (pfad: string) => {
    for (const name of readdirSync(pfad)) {
      const voll = join(pfad, name)
      if (statSync(voll).isDirectory()) gehe(voll)
      else raus.push(relative(basis, voll).split('\\').join('/'))
    }
  }
  try { gehe(join(basis, ordner)) } catch { /* Ordner fehlt */ }
  return raus
}

/** Schreibt precache.json: alles, was der Service Worker vorab aufs Gerät legt. */
function offlineListe(): Plugin {
  return {
    name: 'lsd-offline-liste',
    apply: 'build',
    generateBundle(_, bundle) {
      const dateien = [
        ...Object.keys(bundle).filter((f) => !f.endsWith('.map')),
        ...dateienUnter('messprotokoll'),
        ...dateienUnter('icons'),
        ...dateienUnter('docs'),
        'manifest.webmanifest',
      ]
      this.emitFile({ type: 'asset', fileName: 'precache.json', source: JSON.stringify(dateien) })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), offlineListe()],
  define: { __BUILD_ID__: JSON.stringify(BUILD_ID) },
})
