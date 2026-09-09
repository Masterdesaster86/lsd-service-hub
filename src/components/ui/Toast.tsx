import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'

interface ToastState {
  msg: string
  visible: boolean
}

const ToastContext = createContext<((msg: string) => void) | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastState>({ msg: '', visible: false })
  const timer = useRef<number | undefined>(undefined)

  const show = useCallback((msg: string) => {
    setToast({ msg, visible: true })
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setToast((t) => ({ ...t, visible: false })), 2600)
  }, [])

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div
        className={`fixed bottom-6 left-1/2 -translate-x-1/2 bg-graphite text-white text-sm px-4 py-3 shadow-lg z-[200] transition-opacity ${toast.visible ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
      >
        {toast.msg}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast muss innerhalb von ToastProvider verwendet werden')
  return ctx
}
