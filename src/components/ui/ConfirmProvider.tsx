import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import { Modal, ModalActions, ModalTitle } from './Modal'

interface ConfirmOptions {
  message: string
  confirmLabel?: string
  danger?: boolean
}

type ConfirmFn = (options: ConfirmOptions | string) => Promise<boolean>

const ConfirmContext = createContext<ConfirmFn | null>(null)

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{ opts: ConfirmOptions; resolve: (v: boolean) => void } | null>(null)

  const confirm = useCallback<ConfirmFn>((options) => {
    const opts = typeof options === 'string' ? { message: options } : options
    return new Promise<boolean>((resolve) => setState({ opts, resolve }))
  }, [])

  function close(result: boolean) {
    state?.resolve(result)
    setState(null)
  }

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {state && (
        <Modal onClose={() => close(false)} width={420}>
          <ModalTitle>Bestätigen</ModalTitle>
          <p className="text-sm leading-relaxed">{state.opts.message}</p>
          <ModalActions>
            <button className={`btn ${state.opts.danger ? 'btn-danger' : 'btn-amber'}`} onClick={() => close(true)}>
              {state.opts.confirmLabel || 'Ja, fortfahren'}
            </button>
            <button className="btn btn-outline" onClick={() => close(false)}>Abbrechen</button>
          </ModalActions>
        </Modal>
      )}
    </ConfirmContext.Provider>
  )
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext)
  if (!ctx) throw new Error('useConfirm muss innerhalb von ConfirmProvider verwendet werden')
  return ctx
}
