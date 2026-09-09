const HOURS = Array.from({ length: 24 }, (_, i) => i)
const MINUTES = [0, 15, 30, 45]

export function TimeSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [h, m] = value ? value.split(':').map(Number) : [7, 0]
  const vh = h ?? 7
  const vm = m !== undefined ? (Math.round(m / 15) * 15) % 60 : 0

  function set(nh: number, nm: number) {
    onChange(`${String(nh).padStart(2, '0')}:${String(nm).padStart(2, '0')}`)
  }

  return (
    <div className="flex gap-1.5">
      <select value={vh} onChange={(e) => set(Number(e.target.value), vm)} className="flex-1">
        {HOURS.map((hh) => <option key={hh} value={hh}>{String(hh).padStart(2, '0')}</option>)}
      </select>
      <select value={vm} onChange={(e) => set(vh, Number(e.target.value))} className="flex-1">
        {MINUTES.map((mm) => <option key={mm} value={mm}>{String(mm).padStart(2, '0')}</option>)}
      </select>
    </div>
  )
}
