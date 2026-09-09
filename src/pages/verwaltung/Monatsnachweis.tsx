import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/AuthContext'
import { useToast } from '../../components/ui/Toast'
import { calcDay, calcTagesspesen } from '../../lib/zeit'
import { buildNachweisPdf } from '../../lib/pdf'
import type { ServiceberichtTag } from '../../lib/types'

const MONATSNAMEN = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember']

interface BerichtWithTage {
  id: string
  auftrag_id: string
  maschine_id: string
  tage: ServiceberichtTag[]
  machines: { bezeichnung: string } | null
}

interface Zeile {
  datum: string
  auftrag: string
  maschine: string
  d: ReturnType<typeof calcDay>
  verpflegung: number
  hotelkosten: number
}

export function Monatsnachweis({ monatWert, onBack }: { monatWert: string; onBack: () => void }) {
  const { employee } = useAuth()
  const toast = useToast()
  const [zeilen, setZeilen] = useState<Zeile[] | null>(null)
  const [fehlzeiten, setFehlzeiten] = useState<{ art: string; von: string; bis: string }[]>([])

  const [jahrStr, monatStr] = monatWert.split('-')
  const jahr = Number(jahrStr), monat = Number(monatStr)

  useEffect(() => {
    if (!employee) return
    supabase
      .from('serviceberichte')
      .select('id, auftrag_id, maschine_id, machines(bezeichnung), tage:servicebericht_tage(*)')
      .eq('techniker_id', employee.id)
      .then(({ data }) => {
        const berichte = (data as unknown as BerichtWithTage[]) || []
        const rows: Zeile[] = []
        berichte.forEach((b) => {
          const spesen = calcTagesspesen(b.tage)
          b.tage.forEach((tag, i) => {
            const [ty, tm] = tag.datum.split('-').map(Number)
            if (ty !== jahr || tm !== monat) return
            rows.push({
              datum: tag.datum,
              auftrag: b.auftrag_id,
              maschine: b.machines?.bezeichnung || b.maschine_id,
              d: calcDay(tag),
              verpflegung: spesen[i].verpflegung,
              hotelkosten: spesen[i].hotelkosten,
            })
          })
        })
        rows.sort((a, b) => a.datum.localeCompare(b.datum))
        setZeilen(rows)
      })
    supabase.from('abwesenheiten').select('art, von, bis').eq('techniker_id', employee.id).then(({ data }) => setFehlzeiten(data || []))
  }, [employee, jahr, monat])

  if (zeilen === null) return <div className="text-sm text-ink-soft">Lädt…</div>

  const sum = zeilen.reduce((s, z) => ({
    arbeitNormal: s.arbeitNormal + z.d.arbeitNormal,
    arbeitZuschlag50: s.arbeitZuschlag50 + z.d.arbeitZuschlag50,
    arbeitZuschlag100: s.arbeitZuschlag100 + z.d.arbeitZuschlag100,
    reiseNormal: s.reiseNormal + z.d.reiseNormal,
    reiseZuschlag50: s.reiseZuschlag50 + z.d.reiseZuschlag50,
    reiseZuschlag100: s.reiseZuschlag100 + z.d.reiseZuschlag100,
    verpflegung: s.verpflegung + z.verpflegung,
    hotel: s.hotel + z.hotelkosten,
  }), { arbeitNormal: 0, arbeitZuschlag50: 0, arbeitZuschlag100: 0, reiseNormal: 0, reiseZuschlag50: 0, reiseZuschlag100: 0, verpflegung: 0, hotel: 0 })
  const round2 = (n: number) => Math.round(n * 100) / 100

  const zaehleArt = (art: string) => fehlzeiten.filter((a) => {
    if (a.art !== art) return false
    const [vy, vm] = a.von.split('-').map(Number)
    const [by, bm] = a.bis.split('-').map(Number)
    return (vy === jahr && vm === monat) || (by === jahr && bm === monat)
  }).length

  return (
    <div>
      <button className="text-sm text-steel bg-transparent border-none cursor-pointer p-0 mb-4" onClick={onBack}>← Zurück zur Verwaltung</button>
      <div className="card p-4 mb-4">
        <div className="text-lg font-semibold text-amber">Stundennachweis</div>
        <div className="font-semibold">{employee?.name} · {MONATSNAMEN[monat - 1]} {jahr}</div>
      </div>

      <div className="font-semibold text-sm uppercase tracking-wide text-ink-soft mb-1.5">Erfasste Tage</div>
      {zeilen.length === 0 ? (
        <div className="text-sm text-ink-soft border border-dashed border-line p-4 text-center mb-4">Keine Zeiten in diesem Monat erfasst.</div>
      ) : (
        <div className="flex flex-col gap-1.5 mb-4">
          {zeilen.map((z, i) => (
            <div key={i} className="card p-3 flex items-center justify-between gap-3 flex-wrap text-sm">
              <div>{z.datum.split('-').reverse().join('.')} · Auftrag #{z.auftrag} · {z.maschine}</div>
              <div className="text-ink-soft">{z.d.gesamt} h{(z.verpflegung || z.hotelkosten) ? ` · ${(z.verpflegung + z.hotelkosten).toFixed(2)} € Spesen` : ''}</div>
            </div>
          ))}
        </div>
      )}

      <div className="border border-line bg-paper-2 p-3 grid grid-cols-3 gap-2 text-sm mt-2">
        <div><b>{round2(sum.arbeitNormal)} h</b> Arbeit normal</div>
        <div><b>{round2(sum.arbeitZuschlag50)} h</b> Arbeit +50%</div>
        <div><b>{round2(sum.arbeitZuschlag100)} h</b> Arbeit +100%</div>
        <div><b>{round2(sum.reiseNormal)} h</b> Reise normal</div>
        <div><b>{round2(sum.reiseZuschlag50)} h</b> Reise +50%</div>
        <div><b>{round2(sum.reiseZuschlag100)} h</b> Reise +100%</div>
      </div>
      <div className="border border-line bg-paper-2 p-3 grid grid-cols-3 gap-2 text-sm mt-2">
        <div><b>{sum.verpflegung.toFixed(2)} €</b> Verpflegungsmehraufwand</div>
        <div><b>{sum.hotel.toFixed(2)} €</b> Hotelkosten</div>
        <div><b>{(sum.verpflegung + sum.hotel).toFixed(2)} €</b> Spesen gesamt</div>
      </div>
      <div className="border border-line bg-paper-2 p-3 grid grid-cols-4 gap-2 text-sm mt-2">
        <div><b>{zaehleArt('Krank')}</b> Krankheitstage</div>
        <div><b>{zaehleArt('Schulung')}</b> Schulungstage</div>
        <div><b>{zaehleArt('Kurzarbeit')}</b> Kurzarbeitstage</div>
        <div><b>{zaehleArt('Urlaub')}</b> Urlaubstage</div>
      </div>

      <div className="mt-5">
        <button
          className="btn btn-amber"
          onClick={async () => {
            const pdf = await buildNachweisPdf({
              technikerName: employee?.name || '–',
              monatLabel: `${MONATSNAMEN[monat - 1]} ${jahr}`,
              zeilen,
              sum: { arbeitNormal: sum.arbeitNormal, arbeitZuschlag50: sum.arbeitZuschlag50, arbeitZuschlag100: sum.arbeitZuschlag100, reiseNormal: sum.reiseNormal, reiseZuschlag50: sum.reiseZuschlag50, reiseZuschlag100: sum.reiseZuschlag100, verpflegung: sum.verpflegung, hotel: sum.hotel },
              fehltage: { krank: zaehleArt('Krank'), schulung: zaehleArt('Schulung'), kurzarbeit: zaehleArt('Kurzarbeit'), urlaub: zaehleArt('Urlaub') },
            })
            pdf.save(`Stundennachweis-${employee?.name?.replace(/\s+/g, '_') || 'Techniker'}-${monatWert}.pdf`)
            toast('Stundennachweis als PDF heruntergeladen.')
          }}
        >
          Als PDF erzeugen
        </button>
      </div>
    </div>
  )
}
