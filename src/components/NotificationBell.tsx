import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { formatDateDE } from '../lib/format'

const zeitraum = (von: string, bis: string) => (von === bis ? formatDateDE(von) : `${formatDateDE(von)} – ${formatDateDE(bis)}`)

interface PendingItem { type: 'urlaub' | 'krank'; text: string }

const DREI_TAGE_MS = 3 * 24 * 60 * 60 * 1000

export function NotificationBell() {
  const { employee } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<PendingItem[]>([])
  const visible = employee?.role === 'Administrator' || employee?.role === 'Disposition' || employee?.role === 'CEO'

  async function load() {
    const [{ data: antraege }, { data: emp }, { data: abw }] = await Promise.all([
      supabase.from('urlaubsantraege').select('*').eq('status', 'beantragt'),
      supabase.from('employees').select('id, name'),
      supabase.from('abwesenheiten').select('*').gte('created_at', new Date(Date.now() - DREI_TAGE_MS).toISOString()),
    ])
    const nameById = Object.fromEntries((emp || []).map((e) => [e.id, e.name]))
    const list: PendingItem[] = []
    ;(antraege || []).forEach((a) => list.push({
      type: 'urlaub',
      text: `Urlaubsantrag von ${nameById[a.techniker_id] || '–'}: ${zeitraum(a.von, a.bis)}`,
    }))
    ;(abw || []).filter((a) => a.art !== 'Urlaub').forEach((a) => list.push({
      type: 'krank',
      text: `${a.art} gemeldet: ${nameById[a.techniker_id] || '–'} (${zeitraum(a.von, a.bis)})`,
    }))
    setItems(list)
  }

  useEffect(() => {
    if (!visible) return
    load()
    const interval = window.setInterval(load, 60000)
    return () => window.clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible])

  if (!visible) return null

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative btn btn-outline btn-sm"
        aria-label="Benachrichtigungen"
      >
        🔔
        {items.length > 0 && (
          <span className="absolute -top-1.5 -right-1.5 bg-red text-white text-[10px] font-bold rounded-full min-w-[16px] h-4 px-1 flex items-center justify-center">
            {items.length}
          </span>
        )}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 w-80 max-w-[85vw] bg-white text-ink border border-line shadow-xl z-50 max-h-80 overflow-y-auto">
            {items.length === 0 ? (
              <div className="p-3 text-sm text-ink-soft">Keine offenen Meldungen.</div>
            ) : (
              items.map((item, i) => (
                <div
                  key={i}
                  className="p-3 text-sm border-b border-line last:border-b-0 cursor-pointer hover:bg-paper-2"
                  onClick={() => { setOpen(false); navigate('/plantafel') }}
                >
                  {item.type === 'urlaub' ? '🏖️ ' : '🤒 '}{item.text}
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  )
}
