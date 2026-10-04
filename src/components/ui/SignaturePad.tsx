import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'

export interface SignaturePadHandle {
  hasStroke: () => boolean
  clear: () => void
  toBlob: () => Promise<Blob | null>
  toDataUrl: () => string | null
}

/**
 * Unterschriftsfeld. Passt sich der Breite des Containers an und zeichnet in
 * voller Bildschirmauflösung (scharf auf iPad/Handy). Pointer-Events decken
 * Finger, Stift und Maus gleich ab. Beim Export wird der leere Rand um die
 * Unterschrift abgeschnitten, damit sie im PDF das Feld gut ausfüllt.
 */
export const SignaturePad = forwardRef<SignaturePadHandle, { hoehe?: string; onChange?: (hatStrich: boolean) => void }>(
  ({ hoehe = '160px', onChange }, ref) => {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const hasStroke = useRef(false)
    const onChangeRef = useRef(onChange)
    onChangeRef.current = onChange

    useEffect(() => {
      const canvas = canvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext('2d')!
      let drawing = false
      let last: { x: number; y: number } | null = null
      // Der Fingertipp auf "Bestätigen" darf nicht als erster Punkt im
      // nächsten (gerade erst eingeblendeten) Feld landen.
      const bereitAb = performance.now() + 400

      // Zeichenfläche an die tatsächliche Größe anpassen. Eine Größenänderung
      // (z. B. Drehen des Tablets) leert das Feld — sonst wäre die Unterschrift verzerrt.
      function anpassen() {
        const dpr = window.devicePixelRatio || 1
        const r = canvas!.getBoundingClientRect()
        const w = Math.round(r.width * dpr), h = Math.round(r.height * dpr)
        if (canvas!.width === w && canvas!.height === h) return
        canvas!.width = w
        canvas!.height = h
        ctx.lineWidth = 2.6 * dpr
        ctx.lineCap = 'round'
        ctx.lineJoin = 'round'
        ctx.strokeStyle = '#14181d'
        if (hasStroke.current) { hasStroke.current = false; onChangeRef.current?.(false) }
      }
      anpassen()
      const beobachter = new ResizeObserver(anpassen)
      beobachter.observe(canvas)

      function pos(e: PointerEvent) {
        const r = canvas!.getBoundingClientRect()
        return { x: (e.clientX - r.left) * (canvas!.width / r.width), y: (e.clientY - r.top) * (canvas!.height / r.height) }
      }
      function start(e: PointerEvent) {
        if (performance.now() < bereitAb) return
        drawing = true
        canvas!.setPointerCapture(e.pointerId)
        last = pos(e)
        // Punkt, falls nur getippt wird
        ctx.beginPath(); ctx.arc(last.x, last.y, ctx.lineWidth / 2, 0, Math.PI * 2); ctx.fillStyle = '#14181d'; ctx.fill()
        if (!hasStroke.current) { hasStroke.current = true; onChangeRef.current?.(true) }
        e.preventDefault()
      }
      function move(e: PointerEvent) {
        if (!drawing || !last) return
        const p = pos(e)
        ctx.beginPath(); ctx.moveTo(last.x, last.y); ctx.lineTo(p.x, p.y); ctx.stroke()
        last = p
        e.preventDefault()
      }
      function end() { drawing = false; last = null }

      canvas.addEventListener('pointerdown', start)
      canvas.addEventListener('pointermove', move)
      canvas.addEventListener('pointerup', end)
      canvas.addEventListener('pointercancel', end)
      return () => {
        beobachter.disconnect()
        canvas.removeEventListener('pointerdown', start)
        canvas.removeEventListener('pointermove', move)
        canvas.removeEventListener('pointerup', end)
        canvas.removeEventListener('pointercancel', end)
      }
    }, [])

    /** Kopie der Unterschrift ohne leeren Rand (mit etwas Luft drumherum). */
    function zugeschnitten(): HTMLCanvasElement | null {
      const canvas = canvasRef.current
      if (!canvas) return null
      const { width, height } = canvas
      const daten = canvas.getContext('2d')!.getImageData(0, 0, width, height).data
      let minX = width, minY = height, maxX = -1, maxY = -1
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          if (daten[(y * width + x) * 4 + 3] > 0) {
            if (x < minX) minX = x
            if (x > maxX) maxX = x
            if (y < minY) minY = y
            if (y > maxY) maxY = y
          }
        }
      }
      if (maxX < 0) return canvas
      const rand = Math.round(Math.max(width, height) * 0.02)
      minX = Math.max(0, minX - rand); minY = Math.max(0, minY - rand)
      maxX = Math.min(width - 1, maxX + rand); maxY = Math.min(height - 1, maxY + rand)
      const ziel = document.createElement('canvas')
      ziel.width = maxX - minX + 1
      ziel.height = maxY - minY + 1
      ziel.getContext('2d')!.drawImage(canvas, minX, minY, ziel.width, ziel.height, 0, 0, ziel.width, ziel.height)
      return ziel
    }

    useImperativeHandle(ref, () => ({
      hasStroke: () => hasStroke.current,
      clear: () => {
        const canvas = canvasRef.current
        if (!canvas) return
        canvas.getContext('2d')!.clearRect(0, 0, canvas.width, canvas.height)
        if (hasStroke.current) { hasStroke.current = false; onChangeRef.current?.(false) }
      },
      toBlob: () => new Promise((resolve) => {
        const c = zugeschnitten()
        if (!c) { resolve(null); return }
        c.toBlob(resolve, 'image/png')
      }),
      toDataUrl: () => zugeschnitten()?.toDataURL('image/png') ?? null,
    }))

    return (
      <div className="relative bg-white border-2 border-ink" style={{ height: hoehe }}>
        {/* Unterschriftslinie als Orientierung — nicht Teil des Bildes */}
        <div className="absolute left-[6%] right-[6%] bottom-[22%] border-b border-line pointer-events-none" />
        <span className="absolute left-[6%] bottom-[22%] mb-1 font-mono text-[18px] text-ink-soft pointer-events-none">×</span>
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full touch-none cursor-crosshair" />
      </div>
    )
  },
)
SignaturePad.displayName = 'SignaturePad'
