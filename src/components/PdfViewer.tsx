import { useEffect, useRef, useState } from 'react'

// pdf.js (~1,4 MB) erst bei Bedarf laden, statt jedem App-Start mitzugeben —
// die Anleitung wird nur gelegentlich geöffnet.
async function ladePdfjs() {
  const [pdfjsLib, { default: workerUrl }] = await Promise.all([
    import('pdfjs-dist'),
    import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
  ])
  pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl
  return pdfjsLib
}

/**
 * Zeigt ein PDF als fortlaufende Liste gerenderter Seiten in einem ganz
 * normalen, scrollbaren Bereich — mit derselben Technik (overflow-y: auto),
 * die im Rest der App zuverlässig funktioniert.
 *
 * Bewusst NICHT über <iframe src="…pdf">: der eingebaute PDF-Betrachter von
 * iOS Safari hat sich als unzuverlässig erwiesen — das PDF blieb dort auf der
 * ersten Seite hängen, ohne dass sich das über CSS beheben ließ. Hier
 * übernimmt pdf.js (Mozillas eigene, in Firefox verbaute Bibliothek) das
 * Rendern jeder Seite als Bild auf einen Canvas; das Scrollen danach ist
 * ganz normales Scrollen eines <div>, kein Browser-Plugin mehr im Spiel.
 */
export function PdfViewer({ url }: { url: string }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [status, setStatus] = useState<'laden' | 'fertig' | 'fehler'>('laden')

  useEffect(() => {
    let abgebrochen = false
    setStatus('laden')
    const container = containerRef.current
    if (container) container.innerHTML = ''

    async function rendern() {
      try {
        const pdfjsLib = await ladePdfjs()
        if (abgebrochen) return
        const doc = await pdfjsLib.getDocument({ url }).promise
        if (abgebrochen || !container) return
        // Auf die verfügbare Breite skalieren, damit die Seite auf dem
        // iPad genauso wie am Desktop formatfüllend und lesbar ist.
        const breite = Math.min(container.clientWidth || 800, 900)
        for (let i = 1; i <= doc.numPages; i++) {
          if (abgebrochen) return
          const page = await doc.getPage(i)
          const basisViewport = page.getViewport({ scale: 1 })
          // Auf hochauflösenden Bildschirmen (Retina/iPad) zusätzlich mit
          // devicePixelRatio hochrechnen, sonst wirkt der Text unscharf.
          const skala = (breite / basisViewport.width) * Math.min(window.devicePixelRatio || 1, 2)
          const viewport = page.getViewport({ scale: skala })

          const canvas = document.createElement('canvas')
          canvas.width = viewport.width
          canvas.height = viewport.height
          canvas.style.width = '100%'
          canvas.style.maxWidth = `${breite}px`
          canvas.style.display = 'block'
          canvas.style.margin = '0 auto 16px'
          canvas.style.boxShadow = '0 1px 6px rgba(0,0,0,0.18)'
          canvas.style.background = '#fff'
          const context = canvas.getContext('2d')
          if (!context) continue
          await page.render({ canvasContext: context, viewport, canvas }).promise
          if (abgebrochen) return
          container.appendChild(canvas)
        }
        if (!abgebrochen) setStatus('fertig')
      } catch {
        if (!abgebrochen) setStatus('fehler')
      }
    }
    rendern()
    return () => { abgebrochen = true }
  }, [url])

  return (
    <div className="flex-1 min-h-0 overflow-y-auto bg-paper-2 relative">
      {status !== 'fertig' && (
        <div className="absolute inset-0 flex items-center justify-center text-sm text-ink-soft px-6 text-center">
          {status === 'fehler' ? 'Das PDF konnte nicht geladen werden.' : 'Lädt…'}
        </div>
      )}
      {/* Dieser div wird ausschließlich per DOM-Zugriff befüllt (appendChild
          oben) — React bekommt hier absichtlich keine eigenen Kind-Elemente,
          damit sich beide Welten nicht in die Quere kommen. */}
      <div ref={containerRef} className="p-4 max-w-[900px] mx-auto" />
    </div>
  )
}
