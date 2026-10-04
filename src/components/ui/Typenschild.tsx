import type { ReactNode } from 'react'

/** Datentafel im Stil eines Typenschilds: Beschriftung links (Mono, versal),
 * Wert rechts. Leere Zeilen (null/undefined) werden ausgelassen. */
export function Typenschild({ titel, zeilen, className = '' }: {
  titel?: ReactNode
  zeilen: ([string, ReactNode] | null | false | undefined | '' | 0)[]
  className?: string
}) {
  const sichtbar = zeilen.filter((z): z is [string, ReactNode] => !!z)
  return (
    <div className={`bg-white border border-line ${className}`}>
      {titel && (
        <div className="flex items-center gap-2 px-3.5 py-2.5 border-b border-line font-mono text-[12px] uppercase tracking-[0.14em] text-ink-soft">
          <span className="w-[7px] h-[7px] bg-amber shrink-0" />
          {titel}
        </div>
      )}
      {sichtbar.map(([label, wert]) => (
        <div key={label} className="grid grid-cols-[minmax(0,8.5rem)_minmax(0,1fr)] gap-3 px-3.5 py-2.5 border-b border-line last:border-b-0">
          <span className="font-mono text-[11.5px] uppercase tracking-[0.06em] text-ink-soft pt-0.5">{label}</span>
          <span className="font-medium text-[15px] min-w-0 break-words">{wert}</span>
        </div>
      ))}
    </div>
  )
}
