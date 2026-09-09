import type { ReactNode } from 'react'

export function Modal({ onClose, children, width = 520 }: { onClose: () => void; children: ReactNode; width?: number }) {
  return (
    <div
      className="fixed inset-0 bg-black/50 z-[100] flex items-start justify-center overflow-y-auto p-6"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-paper border border-line shadow-xl mt-10 mb-10 w-full" style={{ maxWidth: width }}>
        <div className="p-6">{children}</div>
      </div>
    </div>
  )
}

export function ModalTitle({ children }: { children: ReactNode }) {
  return <h2 className="text-lg font-semibold mb-4 mt-0">{children}</h2>
}

export function ModalActions({ children }: { children: ReactNode }) {
  return <div className="mt-5 flex gap-2.5 flex-wrap">{children}</div>
}
