import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/AuthContext'
import { useToast } from '../../components/ui/Toast'
import { calcTagMitKontext, calcTagesspesenMitKontext, type DayTotals, type Tageskontext } from '../../lib/zeit'
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
  d: DayTotals
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

        // Alle Tage dieses Technikers (über alle seine Serviceberichte hinweg,
        // egal welcher Auftrag/welche Maschine) nach Kalendertag gruppieren.
        // So lässt sich die 10h-Schwelle korrekt einmal pro echtem Arbeitstag
        // anwenden, auch wenn an einem Tag mehrere Maschinen bearbeitet
        // wurden — statt (falsch) für jeden Servicebericht neu bei 0 zu starten.
        const kontext: Tageskontext = {}
        berichte.forEach((b) => b.tage.forEach((tag) => { (kontext[tag.datum] ||= []).push(tag) }))

        const rows: Zeile[] = []
        berichte.forEach((b) => {
          // Spesen ebenfalls je Kalendertag über alle Berichte: die 8h-Grenze gilt für den ganzen Tag.
          const spesen = calcTagesspesenMitKontext(b.tage, kontext)
          b.tage.forEach((tag, i) => {
            const [ty, tm] = tag.datum.split('-').map(Number)
            if (ty !== jahr || tm !== monat) return
            rows.push({
              datum: tag.datum,
              auftrag: b.auftrag_id,
              maschine: b.machines?.bezeichnung || b.maschine_id,
              d: calcTagMitKontext(tag, kontext[tag.datum] || [tag]),
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

  const euro = (n: number) => `${n.toFixed(2).replace('.', ',')} €`
  const std = (n: number) => `${round2(n).toLocaleString('de-DE')} h`
  // Summen als Tafel: Bezeichnung links, Wert rechts — liest sich am Handy ohne Überlappung.
  const tafel = (titel: string, zeilenTafel: [string, string, boolean?][]) => (
    <div className="mb-4">
      <div className="abschnitt mb-1.5">{titel}</div>
      <div className="bg-white border border-line">
        {zeilenTafel.map(([label, wert, fett]) => (
          <div key={label} className="flex items-center justify-between gap-3 px-3.5 py-2.5 border-b border-line last:border-b-0">
            <span className="font-mono text-[11.5px] uppercase tracking-[0.06em] text-ink-soft">{label}</span>
            <span className={`font-mono text-[14px] ${fett ? 'font-bold' : ''}`}>{wert}</span>
          </div>
        ))}
      </div>
    </div>
  )
  const stundenGesamt = sum.arbeitNormal + sum.arbeitZuschlag50 + sum.arbeitZuschlag100 + sum.reiseNormal + sum.reiseZuschlag50 + sum.reiseZuschlag100

  return (
    <div>
      <button className="btn btn-outline btn-sm mb-4" onClick={onBack}>← Zurück zur Verwaltung</button>
      <p className="eyebrow">Stundennachweis</p>
      <h1>{MONATSNAMEN[monat - 1]} {jahr}</h1>
      <p className="text-sm text-ink-soft mt-1.5 mb-4">{employee?.name}</p>

      <div className="abschnitt mb-1.5">Erfasste Tage</div>
      {zeilen.length === 0 ? (
        <div className="text-sm text-ink-soft border border-dashed border-line p-4 text-center mb-4">Keine Zeiten in diesem Monat erfasst.</div>
      ) : (
        <div className="bg-white border border-line mb-4">
          {zeilen.map((z, i) => (
            <div key={i} className="px-3.5 py-2.5 border-b border-line last:border-b-0">
              <div className="flex items-baseline justify-between gap-3">
                <span className="font-mono text-[13.5px] font-semibold">{z.datum.split('-').reverse().join('.')}</span>
                <span className="font-mono text-[14px] font-semibold">{std(z.d.gesamt)}</span>
              </div>
              <div className="flex items-baseline justify-between gap-3 text-[13px] text-ink-soft mt-0.5">
                <span>#{z.auftrag} · {z.maschine}</span>
                {(z.verpflegung || z.hotelkosten) ? <span className="font-mono shrink-0">{euro(z.verpflegung + z.hotelkosten)} Spesen</span> : null}
              </div>
            </div>
          ))}
        </div>
      )}

      {tafel('Stunden', [
        ['Arbeit normal', std(sum.arbeitNormal)],
        ['Arbeit +50 %', std(sum.arbeitZuschlag50)],
        ['Arbeit +100 %', std(sum.arbeitZuschlag100)],
        ['Reise normal', std(sum.reiseNormal)],
        ['Reise +50 %', std(sum.reiseZuschlag50)],
        ['Reise +100 %', std(sum.reiseZuschlag100)],
        ['Gesamt', std(stundenGesamt), true],
      ])}
      {tafel('Spesen', [
        ['Verpflegung', euro(sum.verpflegung)],
        ['Hotelkosten', euro(sum.hotel)],
        ['Spesen gesamt', euro(sum.verpflegung + sum.hotel), true],
      ])}
      {tafel('Fehltage', [
        ['Krankheit', String(zaehleArt('Krank'))],
        ['Schulung', String(zaehleArt('Schulung'))],
        ['Kurzarbeit', String(zaehleArt('Kurzarbeit'))],
        ['Urlaub', String(zaehleArt('Urlaub'))],
      ])}

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
