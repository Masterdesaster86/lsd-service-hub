import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'

export interface SignaturePadHandle {
  hasStroke: () => boolean
  clear: () => void
  toBlob: () => Promise<Blob | null>
  toDataUrl: () => string | null
}

export const SignaturePad = forwardRef<SignaturePadHandle>((_props, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const hasStroke = useRef(false)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.strokeStyle = '#20242A'
    let drawing = false

    function pos(e: MouseEvent | TouchEvent) {
      const r = canvas!.getBoundingClientRect()
      const point = 'touches' in e ? e.touches[0] : e
      const cx = point.clientX - r.left
      const cy = point.clientY - r.top
      return { x: cx * (canvas!.width / r.width), y: cy * (canvas!.height / r.height) }
    }
    function start(e: MouseEvent | TouchEvent) {
      drawing = true; hasStroke.current = true
      const p = pos(e); ctx.beginPath(); ctx.moveTo(p.x, p.y); e.preventDefault()
    }
    function move(e: MouseEvent | TouchEvent) {
      if (!drawing) return
      const p = pos(e); ctx.lineTo(p.x, p.y); ctx.stroke(); e.preventDefault()
    }
    function end() { drawing = false }

    canvas.addEventListener('mousedown', start)
    canvas.addEventListener('mousemove', move)
    window.addEventListener('mouseup', end)
    canvas.addEventListener('touchstart', start, { passive: false })
    canvas.addEventListener('touchmove', move, { passive: false })
    canvas.addEventListener('touchend', end)
    return () => {
      canvas.removeEventListener('mousedown', start)
      canvas.removeEventListener('mousemove', move)
      window.removeEventListener('mouseup', end)
      canvas.removeEventListener('touchstart', start)
      canvas.removeEventListener('touchmove', move)
      canvas.removeEventListener('touchend', end)
    }
  }, [])

  useImperativeHandle(ref, () => ({
    hasStroke: () => hasStroke.current,
    clear: () => {
      const canvas = canvasRef.current
      if (!canvas) return
      canvas.getContext('2d')!.clearRect(0, 0, canvas.width, canvas.height)
      hasStroke.current = false
    },
    toBlob: () => new Promise((resolve) => {
      if (!canvasRef.current) { resolve(null); return }
      canvasRef.current.toBlob(resolve)
    }),
    toDataUrl: () => canvasRef.current?.toDataURL('image/png') ?? null,
  }))

  return <canvas ref={canvasRef} width={520} height={150} className="border border-line bg-white touch-none w-full max-w-[520px]" />
})
SignaturePad.displayName = 'SignaturePad'
