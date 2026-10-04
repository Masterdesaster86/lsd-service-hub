import { Fragment, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Abwesenheit, OrderWithRelations } from '../../lib/types'
import { OrderStatusTag } from '../../components/ui/StatusTag'
import { Icon } from '../../components/ui/Icon'
import { useToast } from '../../components/ui/Toast'
import { useAuth } from '../../lib/AuthContext'
import { WOCHENTAGE, addDays, formatDMY, parseISO } from '../../lib/zeit'
import { AbwesenheitFormModal } from './AbwesenheitFormModal'
import { VerschiebenSheet, kalenderwoche } from './PlantafelMobil'
import { SPERR_TEXT, mondayOfWeek, orderCoversDate, usePlantafelDaten, zeitraum, type DragData, type Sperre } from './usePlantafel'

const MONATSNAMEN = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez']
const MONATSNAMEN_LANG = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember']
const ABW_KURZ: Record<string, string> = { Urlaub: 'U', Krank: 'K', Schulung: 'S', Kurzarbeit: 'KA' }

function abwesenheitUeberschneidetMonat(a: Abwesenheit, jahr: number, monat: number): boolean {
  const von = parseISO(a.von), bis = parseISO(a.bis)
  if (!von || !bis) return false
  const monatsStart = new Date(jahr, monat, 1), monatsEnde = new Date(jahr, monat + 1, 0)
  return von <= monatsEnde && bis >= monatsStart
}

const kante = (s: Sperre) => (s === 'gesperrt' ? 'border-l-ink' : s === 'nurTag' ? 'border-l-amber' : 'border-l-line')

type ViewMode = 'woche' | 'monat' | 'jahr'

/** Plantafel für große Bildschirme: Raster Techniker × Tage, daneben offene
 * Aufträge, Urlaubsanträge und Abwesenheiten. Umplanen per Antippen (Fenster
 * „Techniker und Datum wählen“), Ziehen geht zusätzlich, wo der Browser es kann. */
export function PlantafelDesktop() {
  const navigate = useNavigate()
  const toast = useToast()
  const { employee } = useAuth()
  const {
    technicians, orders, abwesenheiten, antraege, employeesById,
    poolOrders, bevorstehendeAbwesenheiten,
    load, abwesenheitFuer, sperreFuer, verschiebe, genehmigen, ablehnen, abwesenheitLoeschen,
  } = usePlantafelDaten()

  const darfAbwesenheitenPflegen = employee?.role === 'CEO' || employee?.role === 'Disposition' || employee?.role === 'Administrator'
  const [abwesenheitForm, setAbwesenheitForm] = useState<{ open: boolean; eintrag?: Abwesenheit }>({ open: false })
  const [viewMode, setViewMode] = useState<ViewMode>('woche')
  const [weekStart, setWeekStart] = useState(() => mondayOfWeek(new Date()))
  const [monthAnchor, setMonthAnchor] = useState(() => { const d = new Date(); d.setDate(1); return d })
  const [drag, setDrag] = useState<DragData | null>(null)
  const [verschieben, setVerschieben] = useState<{ order: OrderWithRelations; quelle: DragData } | null>(null)

  const heute = useMemo(() => { const h = new Date(); h.setHours(0, 0, 0, 0); return h }, [])
  const weekDates = useMemo(() => [0, 1, 2, 3, 4, 5, 6].map((i) => addDays(weekStart, i)), [weekStart])
  const monthDates = useMemo(() => {
    const jahr = monthAnchor.getFullYear(), monat = monthAnchor.getMonth()
    const tageImMonat = new Date(jahr, monat + 1, 0).getDate()
    return Array.from({ length: tageImMonat }, (_, i) => new Date(jahr, monat, i + 1))
  }, [monthAnchor])

  const zeitraumText = viewMode === 'woche'
    ? `KW ${kalenderwoche(weekStart)} · ${formatDMY(weekStart).slice(0, 6)} – ${formatDMY(addDays(weekStart, 6))}`
    : viewMode === 'monat'
    ? `${MONATSNAMEN_LANG[monthAnchor.getMonth()]} ${monthAnchor.getFullYear()}`
    : `${monthAnchor.getFullYear()}`

  function blaettern(richtung: 1 | -1) {
    if (viewMode === 'woche') setWeekStart(addDays(weekStart, richtung * 7))
    else if (viewMode === 'monat') setMonthAnchor(new Date(monthAnchor.getFullYear(), monthAnchor.getMonth() + richtung, 1))
    else setMonthAnchor(new Date(monthAnchor.getFullYear() + richtung, monthAnchor.getMonth(), 1))
  }

  async function applyDrop(techId: string, dateStr: string) {
    if (!drag) return
    const quelle = drag
    setDrag(null)
    await verschiebe(quelle, techId, dateStr)
  }

  function oeffne(order: OrderWithRelations, fromTech: string, fromDate: string) {
    setVerschieben({ order, quelle: { orderId: order.id, fromTech, fromDate } })
  }

  function Karte({ order, techId, datum }: { order: OrderWithRelations; techId: string; datum: Date }) {
    const dateStr = formatDMY(datum)
    const istStart = !!order.einsatzbeginn && formatDMY(parseISO(order.einsatzbeginn)!) === dateStr
    const sperre = sperreFuer(order.id, techId)
    const ziehbar = istStart && sperre !== 'gesperrt'
    // Folgetage eines mehrtägigen Auftrags nur als schmaler Balken — der
    // Zeitraum ist so auf einen Blick sichtbar, ohne die Zellen zu füllen.
    if (!istStart) {
      return (
        <button
          onClick={() => navigate(`/auftraege/${order.id}`)}
          title={`Fortsetzung von Auftrag #${order.id} (${order.einsatzkunde?.name || ''})`}
          className={`w-full text-left px-2 py-1 bg-paper-2 border border-line border-l-4 ${kante(sperre)} font-mono text-[11.5px] text-ink-soft cursor-pointer`}
        >
          → #{order.id}
        </button>
      )
    }
    return (
      <button
        draggable={ziehbar}
        onDragStart={(e) => {
          if (!ziehbar) return
          // Ohne Nutzdaten bricht Firefox den Zug sofort ab und Safari startet
          // ihn gar nicht erst — Chrome ist da als einziger nachsichtig.
          e.dataTransfer.setData('text/plain', order.id)
          e.dataTransfer.effectAllowed = 'move'
          setDrag({ orderId: order.id, fromTech: techId, fromDate: dateStr })
        }}
        onClick={() => oeffne(order, techId, dateStr)}
        title={sperre !== 'frei' ? SPERR_TEXT[sperre] : 'Antippen zum Verschieben'}
        className={`w-full text-left flex flex-col gap-0.5 px-2 py-1.5 bg-white border border-line border-l-4 ${kante(sperre)} cursor-pointer`}
      >
        <span className="font-mono text-[12.5px] font-semibold">#{order.id}{(order.dauer_tage || 1) > 1 && <span className="font-normal text-ink-soft"> · {order.dauer_tage} T.</span>}</span>
        <span className="text-[13px] leading-tight line-clamp-2">{order.einsatzkunde?.name || '–'}</span>
      </button>
    )
  }

  return (
    <div className="-m-6 max-md:-m-4">
      {/* Kopf: Titel, Zeitraum, Ansicht, Abwesenheit */}
      <div className="flex items-center justify-between gap-6 flex-wrap px-8 py-5 border-b border-line">
        <div className="flex items-center gap-6 flex-wrap">
          <h1 className="!text-[44px]">Plantafel</h1>
          <div className="flex items-center gap-2">
            <button className="w-12 h-12 border-[1.5px] border-ink bg-white font-mono text-[22px] cursor-pointer text-ink" aria-label="Zurück" onClick={() => blaettern(-1)}>‹</button>
            <span className="min-w-[250px] text-center font-mono text-[14px] font-semibold uppercase tracking-[0.06em]">{zeitraumText}</span>
            <button className="w-12 h-12 border-[1.5px] border-ink bg-white font-mono text-[22px] cursor-pointer text-ink" aria-label="Weiter" onClick={() => blaettern(1)}>›</button>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="grid grid-cols-3 gap-0.5 p-0.5 bg-ink">
            {(['woche', 'monat', 'jahr'] as ViewMode[]).map((v) => (
              <button
                key={v}
                onClick={() => setViewMode(v)}
                className={`min-h-[44px] px-5 border-0 cursor-pointer font-mono text-[12.5px] font-semibold uppercase tracking-[0.06em] ${viewMode === v ? 'bg-ink text-paper' : 'bg-white text-ink'}`}
              >
                {v === 'woche' ? 'Woche' : v === 'monat' ? 'Monat' : 'Jahr'}
              </button>
            ))}
          </div>
          {darfAbwesenheitenPflegen && (
            <button className="btn btn-amber" onClick={() => setAbwesenheitForm({ open: true })}><Icon name="hinzufuegen" size={20} /> Abwesenheit</button>
          )}
        </div>
      </div>

      <div className="flex flex-col xl:flex-row items-stretch">
        {/* Raster */}
        <div className="flex-1 min-w-0 px-8 py-6 flex flex-col gap-3.5">
          {viewMode === 'woche' && (
            <div className="border border-line bg-white overflow-x-auto">
              <div className="grid min-w-[760px]" style={{ gridTemplateColumns: '150px repeat(7, minmax(0, 1fr))' }}>
                <span className="border-b-2 border-ink" />
                {weekDates.map((d) => {
                  const istHeute = d.getTime() === heute.getTime()
                  return (
                    <div key={d.toISOString()} className={`px-3 py-2.5 border-l border-line border-b-2 border-b-ink flex flex-col gap-0.5 ${istHeute ? 'bg-paper-2' : ''}`}>
                      <span className="font-mono text-[11.5px] uppercase tracking-[0.08em] text-ink-soft">{WOCHENTAGE[d.getDay()]}{istHeute ? ' · heute' : ''}</span>
                      <span className="text-[26px] font-extrabold leading-[0.94]" style={{ fontFamily: 'var(--font-display)' }}>{d.getDate()}.</span>
                    </div>
                  )
                })}
                {technicians.map((tech) => (
                  <Fragment key={tech.id}>
                    <div className="p-3 font-semibold text-[15px] border-b border-line">{tech.name}</div>
                    {weekDates.map((d) => {
                      const dateStr = formatDMY(d)
                      const abw = abwesenheitFuer(tech.id, d)
                      const dayOrders = orders.filter((o) => o.techniker.some((t) => t.id === tech.id) && orderCoversDate(o, d))
                      return (
                        <div
                          key={tech.id + dateStr}
                          onDragOver={(e) => { if (!abw) { e.preventDefault(); e.dataTransfer.dropEffect = 'move' } }}
                          onDrop={(e) => { e.preventDefault(); if (abw) { toast('Techniker ist an diesem Tag abwesend.'); setDrag(null); return } applyDrop(tech.id, dateStr) }}
                          className={`min-h-[112px] p-1.5 flex flex-col gap-1 border-l border-b border-line ${d.getTime() === heute.getTime() ? 'bg-paper-2/60' : ''}`}
                        >
                          {dayOrders.map((o) => <Karte key={o.id} order={o} techId={tech.id} datum={d} />)}
                          {abw && <div className="px-2 py-1.5 bg-line font-mono text-[11.5px] uppercase tracking-[0.08em]">{abw.art}</div>}
                        </div>
                      )
                    })}
                  </Fragment>
                ))}
              </div>
            </div>
          )}

          {viewMode === 'monat' && (
            <>
              <div className="border border-line bg-white overflow-x-auto">
                <div className="grid" style={{ gridTemplateColumns: `112px repeat(${monthDates.length}, minmax(20px, 1fr))` }}>
                  <span className="border-b-2 border-ink" />
                  {monthDates.map((d) => (
                    <div key={d.toISOString()} className={`py-1.5 border-l border-line border-b-2 border-b-ink text-center flex flex-col ${d.getDay() === 0 || d.getDay() === 6 ? 'bg-paper-2' : ''}`}>
                      <span className="font-mono text-[9.5px] text-ink-soft">{WOCHENTAGE[d.getDay()]}</span>
                      <span className="font-mono text-[12px] font-semibold">{d.getDate()}</span>
                    </div>
                  ))}
                  {technicians.map((tech) => (
                    <Fragment key={tech.id}>
                      <div className="px-2.5 py-2.5 font-semibold text-[13px] leading-tight border-b border-line">{tech.name}</div>
                      {monthDates.map((d) => {
                        const abw = abwesenheitFuer(tech.id, d)
                        const order = orders.find((o) => o.techniker.some((t) => t.id === tech.id) && orderCoversDate(o, d))
                        return (
                          <div key={tech.id + d.toISOString()} className={`min-h-[60px] p-0.5 flex flex-col gap-0.5 border-l border-b border-line ${d.getDay() === 0 || d.getDay() === 6 ? 'bg-paper-2' : ''}`}>
                            {order && (
                              <button
                                onClick={() => navigate(`/auftraege/${order.id}`)}
                                title={`#${order.id} ${order.einsatzkunde?.name || ''}`}
                                className={`py-1 bg-white border border-line border-t-[3px] ${sperreFuer(order.id, tech.id) === 'gesperrt' ? 'border-t-ink' : sperreFuer(order.id, tech.id) === 'nurTag' ? 'border-t-amber' : 'border-t-line'} font-mono text-[9.5px] font-semibold cursor-pointer text-ink overflow-hidden`}
                              >
                                {order.id.slice(-3)}
                              </button>
                            )}
                            {abw && <div className="py-1 bg-line font-mono text-[10px] font-semibold text-center">{ABW_KURZ[abw.art] || abw.art.slice(0, 1)}</div>}
                          </div>
                        )
                      })}
                    </Fragment>
                  ))}
                </div>
              </div>
              <span className="font-mono text-[12px] uppercase tracking-[0.06em] text-ink-soft">Zahl = Ende der Auftragsnummer · U Urlaub · K Krank · S Schulung · KA Kurzarbeit</span>
            </>
          )}

          {viewMode === 'jahr' && (
            <>
              <div className="border border-line bg-white overflow-x-auto">
                <div className="grid min-w-[760px]" style={{ gridTemplateColumns: '150px repeat(12, minmax(0, 1fr))' }}>
                  <span className="border-b-2 border-ink" />
                  {MONATSNAMEN.map((m) => (
                    <div key={m} className="px-1.5 py-3 border-l border-line border-b-2 border-b-ink font-mono text-[12px] font-semibold uppercase tracking-[0.06em] text-center">{m}</div>
                  ))}
                  {technicians.map((tech) => (
                    <Fragment key={tech.id}>
                      <div className="p-3 font-semibold text-[15px] border-b border-line">{tech.name}</div>
                      {MONATSNAMEN.map((_, monat) => {
                        const eintraege = abwesenheiten.filter((a) => a.techniker_id === tech.id && abwesenheitUeberschneidetMonat(a, monthAnchor.getFullYear(), monat))
                        const urlaub = eintraege.filter((a) => a.art === 'Urlaub').length
                        const krank = eintraege.filter((a) => a.art === 'Krank').length
                        const sonst = eintraege.length - urlaub - krank
                        return (
                          <button
                            key={monat}
                            onClick={() => { setMonthAnchor(new Date(monthAnchor.getFullYear(), monat, 1)); setViewMode('monat') }}
                            className="min-h-[72px] p-1.5 flex flex-col justify-center gap-0.5 border-0 border-l border-b border-line bg-white cursor-pointer text-ink font-mono text-[11.5px] text-center"
                          >
                            {urlaub > 0 && <span className="font-semibold">{urlaub} U</span>}
                            {krank > 0 && <span className="font-semibold">{krank} K</span>}
                            {sonst > 0 && <span className="text-ink-soft">{sonst} sonst.</span>}
                            {eintraege.length === 0 && <span className="text-ink-soft">–</span>}
                          </button>
                        )
                      })}
                    </Fragment>
                  ))}
                </div>
              </div>
              <span className="font-mono text-[12px] uppercase tracking-[0.06em] text-ink-soft">Anzahl der Abwesenheits-Einträge je Monat · U Urlaub · K Krank · Monat antippen öffnet die Monatsansicht</span>
            </>
          )}

          {viewMode === 'woche' && (
            <p className="text-[14px] text-ink-soft max-w-[70ch] m-0">
              Auftrag antippen öffnet „Techniker und Datum wählen“. Blauer Rand: Bericht offen, nur der Tag ist änderbar. Schwarzer Rand: Bericht abgeschlossen, gesperrt.
            </p>
          )}
        </div>

        {/* Seitenleiste: offene Aufträge, Urlaubsanträge, Abwesenheiten */}
        <aside className="xl:w-[380px] shrink-0 border-t xl:border-t-0 xl:border-l border-line px-6 py-6 flex flex-col gap-7">
          <section className="flex flex-col gap-2.5">
            <div className="flex justify-between items-baseline">
              <span className="abschnitt">Offene Aufträge</span>
              <span className="font-mono text-[15px] font-semibold">{poolOrders.length}</span>
            </div>
            {poolOrders.length === 0 ? (
              <div className="px-3.5 py-3 border-[1.5px] border-dashed border-line font-mono text-[12.5px] uppercase tracking-[0.08em] text-ink-soft">Keine offenen Aufträge</div>
            ) : poolOrders.map((o) => (
              <button
                key={o.id}
                draggable
                onDragStart={(e) => { e.dataTransfer.setData('text/plain', o.id); e.dataTransfer.effectAllowed = 'move'; setDrag({ orderId: o.id, fromTech: '', fromDate: '' }) }}
                onClick={() => oeffne(o, '', '')}
                className="w-full text-left flex flex-col gap-1 px-3.5 py-3 bg-white border border-line border-l-4 border-l-amber cursor-pointer"
              >
                <span className="flex justify-between gap-2 w-full">
                  <span className="font-mono text-[15px] font-semibold">#{o.id}{(o.dauer_tage || 1) > 1 && <span className="font-normal text-ink-soft"> · {o.dauer_tage} Tage</span>}</span>
                  <OrderStatusTag status={o.status} />
                </span>
                <span className="text-[16px] font-semibold">{o.einsatzkunde?.name || '–'}</span>
                <span className="font-mono text-[12px] uppercase tracking-[0.06em] text-ink-soft">
                  {o.techniker.length === 0 ? 'Techniker fehlt' : `Termin fehlt · ${o.techniker.map((t) => t.name).join(', ')}`}
                </span>
              </button>
            ))}
          </section>

          <section className="flex flex-col gap-2.5">
            <div className="flex justify-between items-baseline">
              <span className="abschnitt">Urlaubsanträge</span>
              <span className="font-mono text-[15px] font-semibold">{antraege.length}</span>
            </div>
            {antraege.length === 0 ? (
              <div className="px-3.5 py-3 border-[1.5px] border-dashed border-line font-mono text-[12.5px] uppercase tracking-[0.08em] text-ink-soft">Keine offenen Anträge</div>
            ) : antraege.map((a) => {
              const von = parseISO(a.von), bis = parseISO(a.bis)
              const tage = von && bis ? Math.round((bis.getTime() - von.getTime()) / 86400000) + 1 : 0
              return (
                <div key={a.id} className="flex flex-col gap-2.5 p-3.5 bg-white border border-line">
                  <div className="flex justify-between items-center gap-2">
                    <span className="font-semibold text-[17px]">{employeesById[a.techniker_id]?.name || '–'}</span>
                    <span className="tag tag-offen">Beantragt</span>
                  </div>
                  <span className="font-mono text-[14px] text-ink-soft">{zeitraum(a.von, a.bis)} · {tage} {tage === 1 ? 'Tag' : 'Tage'}</span>
                  {a.bemerkung && <span className="text-[13.5px] text-ink-soft">{a.bemerkung}</span>}
                  <div className="grid grid-cols-2 gap-2">
                    <button className="btn btn-amber" onClick={() => genehmigen(a)}><Icon name="erledigt" size={20} /> Genehmigen</button>
                    <button className="btn btn-outline" onClick={() => ablehnen(a)}>Ablehnen</button>
                  </div>
                </div>
              )
            })}
          </section>

          <section className="flex flex-col gap-2.5">
            <div className="flex justify-between items-baseline">
              <span className="abschnitt">Abwesenheiten</span>
              <span className="font-mono text-[15px] font-semibold">{bevorstehendeAbwesenheiten.length}</span>
            </div>
            {bevorstehendeAbwesenheiten.length === 0 ? (
              <div className="px-3.5 py-3 border-[1.5px] border-dashed border-line font-mono text-[12.5px] uppercase tracking-[0.08em] text-ink-soft">Keine bevorstehenden</div>
            ) : (
              <div className="bg-white border border-line">
                {bevorstehendeAbwesenheiten.map((a) => (
                  <div key={a.id} className="flex items-center justify-between gap-2 px-3.5 py-2.5 border-b border-line last:border-b-0">
                    <div className="min-w-0">
                      <div className="font-semibold text-[14.5px]">{employeesById[a.techniker_id]?.name || '–'} <span className="font-mono font-normal text-[12px] uppercase tracking-[0.06em] text-ink-soft">· {a.art}</span></div>
                      <div className="font-mono text-[12.5px] text-ink-soft">{zeitraum(a.von, a.bis)}</div>
                    </div>
                    {darfAbwesenheitenPflegen && (
                      <div className="flex gap-1.5 shrink-0">
                        <button className="btn btn-outline btn-sm !px-0 w-9" aria-label="Bearbeiten" onClick={() => setAbwesenheitForm({ open: true, eintrag: a })}><Icon name="bearbeiten" size={15} /></button>
                        <button className="btn btn-outline btn-sm !px-0 w-9" aria-label="Löschen" onClick={() => abwesenheitLoeschen(a)}><Icon name="loeschen" size={15} /></button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        </aside>
      </div>

      {verschieben && (
        <VerschiebenSheet
          order={verschieben.order}
          quelle={verschieben.quelle}
          technicians={technicians}
          sperre={sperreFuer(verschieben.order.id, verschieben.quelle.fromTech)}
          abwesenheitFuer={abwesenheitFuer}
          onOeffnen={() => navigate(`/auftraege/${verschieben.order.id}`)}
          onClose={() => setVerschieben(null)}
          onSpeichern={async (techId, datumDMY) => { const q = verschieben.quelle; setVerschieben(null); await verschiebe(q, techId, datumDMY) }}
        />
      )}

      {abwesenheitForm.open && (
        <AbwesenheitFormModal
          abwesenheit={abwesenheitForm.eintrag}
          mitarbeiter={Object.values(employeesById).filter((e) => e.aktiv).sort((a, b) => a.name.localeCompare(b.name))}
          onClose={() => setAbwesenheitForm({ open: false })}
          onSaved={() => { setAbwesenheitForm({ open: false }); load() }}
        />
      )}
    </div>
  )
}
