import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/AuthContext'
import type { Abwesenheit, Urlaubsantrag } from '../../lib/types'
import { AntragStatusTag } from '../../components/ui/StatusTag'
import { FehlzeitModal } from './FehlzeitModal'
import { UrlaubsantragModal } from './UrlaubsantragModal'
import { Monatsnachweis } from './Monatsnachweis'
import { formatDateDE } from '../../lib/format'

const zeitraum = (von: string, bis: string) => (von === bis ? formatDateDE(von) : `${formatDateDE(von)} – ${formatDateDE(bis)}`)

function currentMonthValue() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function Verwaltung() {
  const { employee } = useAuth()
  const [antraege, setAntraege] = useState<Urlaubsantrag[]>([])
  const [abwesenheiten, setAbwesenheiten] = useState<Abwesenheit[]>([])
  const [showFehlzeit, setShowFehlzeit] = useState(false)
  const [showUrlaub, setShowUrlaub] = useState(false)
  const [monat, setMonat] = useState(currentMonthValue())
  const [nachweisMonat, setNachweisMonat] = useState<string | null>(null)

  async function load() {
    if (!employee) return
    const [{ data: a }, { data: ab }] = await Promise.all([
      supabase.from('urlaubsantraege').select('*').eq('techniker_id', employee.id).order('von', { ascending: false }),
      supabase.from('abwesenheiten').select('*').eq('techniker_id', employee.id).order('von', { ascending: false }),
    ])
    setAntraege(a || [])
    setAbwesenheiten(ab || [])
  }

  useEffect(() => { load() }, [employee])

  if (nachweisMonat) return <Monatsnachweis monatWert={nachweisMonat} onBack={() => setNachweisMonat(null)} />

  return (
    <div>
      <h1 className="text-xl font-semibold m-0">Meine Verwaltung</h1>
      <p className="text-sm text-ink-soft mt-1 mb-4">{employee?.name}</p>

      <div className="flex items-center gap-3 flex-wrap mb-1">
        <div className="font-semibold text-sm uppercase tracking-wide text-ink-soft">Fehlzeit melden</div>
        <button className="btn btn-outline btn-sm" onClick={() => setShowFehlzeit(true)}>+ Krankheit / Schulung / Kurzarbeit</button>
      </div>
      <div className="flex items-center gap-3 flex-wrap mb-3">
        <div className="font-semibold text-sm uppercase tracking-wide text-ink-soft">Urlaub</div>
        <button className="btn btn-amber btn-sm" onClick={() => setShowUrlaub(true)}>+ Urlaub beantragen</button>
      </div>

      {antraege.length === 0 ? (
        <div className="text-sm text-ink-soft border border-dashed border-line p-4 text-center mb-6">Noch keine Urlaubsanträge gestellt.</div>
      ) : (
        <div className="flex flex-col gap-1.5 mb-6">
          {antraege.map((a) => (
            <div key={a.id} className={`card p-3 flex items-center justify-between gap-3 flex-wrap ${a.status === 'storniert' ? 'opacity-70' : ''}`}>
              <div>
                <div className="font-semibold text-sm">Urlaub {zeitraum(a.von, a.bis)}</div>
                <div className="text-[13px] text-ink-soft">{a.bemerkung || '–'} · beantragt am {new Date(a.beantragt_am).toLocaleDateString('de-DE')}</div>
                {a.status === 'storniert' && (
                  <div className="text-[13px] text-ink-soft mt-0.5">Dieser Urlaub wurde wieder aus der Planung genommen. Bei Bedarf bitte neu beantragen.</div>
                )}
              </div>
              <AntragStatusTag status={a.status} />
            </div>
          ))}
        </div>
      )}

      <div className="font-semibold text-sm uppercase tracking-wide text-ink-soft mb-1.5">Meine erfassten Fehlzeiten</div>
      {abwesenheiten.length === 0 ? (
        <div className="text-sm text-ink-soft border border-dashed border-line p-4 text-center mb-6">Noch keine Fehlzeiten erfasst.</div>
      ) : (
        <div className="flex flex-col gap-1.5 mb-6">
          {abwesenheiten.map((a) => (
            <div key={a.id} className="card p-3">
              <div className="font-semibold text-sm">{a.art} · {zeitraum(a.von, a.bis)}</div>
              <div className="text-[13px] text-ink-soft">{a.bemerkung || '–'}</div>
            </div>
          ))}
        </div>
      )}

      <div className="font-semibold text-sm uppercase tracking-wide text-ink-soft mb-1.5">Monats-Stundennachweis</div>
      <div className="max-w-xs"><label>Monat</label><input type="month" value={monat} onChange={(e) => setMonat(e.target.value)} /></div>
      <button className="btn btn-amber mt-3.5" onClick={() => monat && setNachweisMonat(monat)}>Stundennachweis erstellen</button>

      {showFehlzeit && <FehlzeitModal onClose={() => setShowFehlzeit(false)} onSaved={() => { setShowFehlzeit(false); load() }} />}
      {showUrlaub && <UrlaubsantragModal onClose={() => setShowUrlaub(false)} onSaved={() => { setShowUrlaub(false); load() }} />}
    </div>
  )
}
