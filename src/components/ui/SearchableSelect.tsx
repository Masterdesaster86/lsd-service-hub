import { useEffect, useRef, useState } from 'react'

export interface SearchableOption { id: string; label: string }

/** Textfeld mit Tipp-zum-Suchen und Dropdown-Liste — Ersatz für ein natives <select>
 * bei langen Listen (z.B. Kundenauswahl). */
export function SearchableSelect({
  value, onChange, options, placeholder,
}: {
  value: string
  onChange: (id: string) => void
  options: SearchableOption[]
  placeholder?: string
}) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  const selected = options.find((o) => o.id === value)

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  const filtered = query.trim()
    ? options.filter((o) => o.label.toLowerCase().includes(query.trim().toLowerCase()))
    : options

  return (
    <div className="relative" ref={wrapRef}>
      <input
        value={open ? query : (selected?.label || '')}
        onChange={(e) => { setQuery(e.target.value); setOpen(true) }}
        onFocus={() => { setQuery(''); setOpen(true) }}
        placeholder={placeholder || '– wählen oder tippen zum Suchen –'}
        autoComplete="off"
      />
      {open && (
        <div className="absolute z-30 left-0 right-0 top-full mt-1 max-h-52 overflow-y-auto bg-white border border-line shadow-lg">
          {filtered.length === 0 ? (
            <div className="p-2.5 text-sm text-ink-soft">Keine Treffer.</div>
          ) : (
            filtered.map((o) => (
              <div
                key={o.id}
                className={`p-2.5 text-sm cursor-pointer hover:bg-paper-2 ${o.id === value ? 'bg-amber/15 font-semibold' : ''}`}
                onClick={() => { onChange(o.id); setQuery(''); setOpen(false) }}
              >
                {o.label}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
