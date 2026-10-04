import type { ReactNode } from 'react'

/** Dialog. Auf dem Handy fährt er als Sheet von unten herein und füllt die
 * Breite, am Desktop steht er mittig. Hintergrund antippen schließt ihn. */
export function Modal({ onClose, children, width = 520 }: { onClose: () => void; children: ReactNode; width?: number }) {
  return (
    <div
      className="fixed inset-0 bg-[rgba(9,11,13,0.72)] z-[100] flex items-end justify-center sm:items-start sm:overflow-y-auto sm:p-6"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="modal-blatt bg-paper border-t-2 border-ink w-full max-sm:max-h-[92%] max-sm:overflow-y-auto sm:border sm:border-line sm:mt-10 sm:mb-10"
        style={{ maxWidth: width }}
      >
        <div className="p-5 sm:p-6" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 20px)' }}>{children}</div>
      </div>
    </div>
  )
}

export function ModalTitle({ children }: { children: ReactNode }) {
  return <h2 className="mb-4 mt-0">{children}</h2>
}

export function ModalActions({ children }: { children: ReactNode }) {
  return <div className="mt-5 flex gap-2.5 flex-wrap">{children}</div>
}
