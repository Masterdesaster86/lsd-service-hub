import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Abwesenheit, Employee, OrderWithRelations, Urlaubsantrag } from '../../lib/types'
import { OrderStatusTag } from '../../components/ui/StatusTag'
import { Modal, ModalActions, ModalTitle } from '../../components/ui/Modal'
import { Icon } from '../../components/ui/Icon'
import { useToast } from '../../components/ui/Toast'
import { useAuth } from '../../lib/AuthContext'
import { WOCHENTAGE, addDays, formatDMY, formatISO, parseISO } from '../../lib/zeit'
import { AbwesenheitFormModal } from './AbwesenheitFormModal'
import { SPERR_TEXT, mondayOfWeek, orderCoversDate, usePlantafelDaten, zeitraum, type DragData, type Sperre } from './usePlantafel'

type Tab = 'tag' | 'techniker' | 'offen' | 'antraege'

function kalenderwoche(d: Date): number {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  const tag = t.getUTCDay() || 7
  t.setUTCDate(t.getUTCDate() + 4 - tag)
  const jahresStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1))
  return Math.ceil(((t.getTime() - jahresStart.getTime()) / 86400000 + 1) / 7)
}

const kurzDatum = (d: Date) => formatDMY(d).slice(0, 5)

const SPERR_KURZ: Record<Sperre, string> = {
  frei: 'Antippen zum Verschieben',
  nurTag: 'Bericht offen · nur Tag änderbar',
  gesperrt: 'Bericht abgeschlossen · gesperrt',
}

/** Plantafel für das Handy (Geschäftsführung / Disposition): Tagesansicht,
 * Wochenliste je Techniker, nicht eingeplante Aufträge und Urlaubsanträge.
 * Dieselben Daten und Regeln wie das Raster am Desktop. */
export function PlantafelMobil() {
  const navigate = useNavigate()
  const { employee } = useAuth()
  const {
    technicians, orders, antraege, employeesById, poolOrders, bevorstehendeAbwesenheiten,
    load, abwesenheitFuer, sperreFuer, verschiebe, genehmigen, ablehnen, abwesenheitLoeschen,
  } = usePlantafelDaten()

  const darfAbwesenheitenPflegen = employee?.role === 'CEO' || employee?.role === 'Disposition' || employee?.role === 'Administrator'
  const [tab, setTab] = useState<Tab>('tag')
  const [weekStart, setWeekStart] = useState(() => mondayOfWeek(new Date()))
  const [gewaehlterTag, setGewaehlterTag] = useState(() => { const h = new Date(); h.setHours(0, 0, 0, 0); return h })
  const [gewaehlterTechniker, setGewaehlterTechniker] = useState('')
  const [verschieben, setVerschieben] = useState<{ order: OrderWithRelations; quelle: DragData } | null>(null)
  const [abwesenheitForm, setAbwesenheitForm] = useState<{ open: boolean; eintrag?: Abwesenheit }>({ open: false })

  const wochentage = useMemo(() => [0, 1, 2, 3, 4, 5, 6].map((i) => addDays(weekStart, i)), [weekStart])
  const heute = useMemo(() => { const h = new Date(); h.setHours(0, 0, 0, 0); return h }, [])
  const technikerId = gewaehlterTechniker || technicians[0]?.id || ''

  function woche(delta: number) {
    const neuerStart = addDays(weekStart, delta * 7)
    setWeekStart(neuerStart)
    // Gleicher Wochentag in der neuen Woche bleibt ausgewählt.
    const offset = Math.round((gewaehlterTag.getTime() - weekStart.getTime()) / 86400000)
    setGewaehlterTag(addDays(neuerStart, Math.min(Math.max(offset, 0), 6)))
  }

  function auftraegeFuer(techId: string, d: Date) {
    return orders.filter((o) => o.techniker.some((t) => t.id === techId) && orderCoversDate(o, d))
  }

  function Karte({ order, techId, datum }: { order: OrderWithRelations; techId: string; datum: Date }) {
    const istStart = !!order.einsatzbeginn && formatDMY(parseISO(order.einsatzbeginn)!) === formatDMY(datum)
    const sperre = sperreFuer(order.id, techId)
    const rand = sperre === 'gesperrt' ? 'border-l-ink' : sperre === 'nurTag' ? 'border-l-amber' : 'border-l-line'
    return (
      <button
        onClick={() => {
          // Folgetage eines mehrtägigen Auftrags verschiebt man über den ersten Tag.
          if (!istStart) { navigate(`/auftraege/${order.id}`); return }
          setVerschieben({ order, quelle: { orderId: order.id, fromTech: techId, fromDate: formatDMY(datum) } })
        }}
        className={`w-full text-left bg-white border border-line border-l-4 ${rand} p-3 cursor-pointer block`}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono text-[13px] font-semibold">
            #{order.id}{!istStart && <span className="font-normal text-ink-soft"> · Fortsetzung</span>}
            {istStart && (order.dauer_tage || 1) > 1 && <span className="font-normal text-ink-soft"> · {order.dauer_tage} Tage</span>}
          </span>
          <OrderStatusTag status={order.status} />
        </div>
        <div className="font-semibold mt-1.5 text-[16px] leading-tight">{order.einsatzkunde?.name || '–'}</div>
        <div className="font-mono text-[11px] uppercase tracking-[0.04em] text-steel mt-1.5">
          {istStart ? SPERR_KURZ[sperre] : 'Antippen zum Öffnen'}
        </div>
      </button>
    )
  }

  function AbwesenheitKarte({ art }: { art: string }) {
    return (
      <div className="border border-dashed border-ink-soft bg-paper-2 p-3 font-mono text-[12.5px] uppercase tracking-[0.08em] text-ink-soft">
        {art}
      </div>
    )
  }

  function TagesBlock({ tech, datum, mitName }: { tech: Employee; datum: Date; mitName: boolean }) {
    const abw = abwesenheitFuer(tech.id, datum)
    const liste = abw ? [] : auftraegeFuer(tech.id, datum)
    return (
      <section className="mb-5">
        {mitName && (
          <div className="flex items-baseline justify-between border-b border-line pb-1.5 mb-2.5">
            <h3 className="!text-[22px]">{tech.name}</h3>
            <span className="font-mono text-[11.5px] uppercase tracking-[0.08em] text-ink-soft">
              {abw ? abw.art : `${liste.length} ${liste.length === 1 ? 'Auftrag' : 'Aufträge'}`}
            </span>
          </div>
        )}
        <div className="flex flex-col gap-2">
          {abw ? <AbwesenheitKarte art={abw.art} /> : liste.length === 0 ? (
            <div className="font-mono text-[12.5px] uppercase tracking-[0.08em] text-ink-soft py-2">Frei</div>
          ) : liste.map((o) => <Karte key={o.id} order={o} techId={tech.id} datum={datum} />)}
        </div>
      </section>
    )
  }

  const tabs: { key: Tab; label: string; zaehler: number; akzent?: boolean }[] = [
    { key: 'tag', label: 'Tag', zaehler: 0 },
    { key: 'techniker', label: 'Techniker', zaehler: 0 },
    { key: 'offen', label: 'Offen', zaehler: poolOrders.length, akzent: true },
    { key: 'antraege', label: 'Anträge', zaehler: antraege.length },
  ]

  return (
    <div className="pb-24">
      <p className="lsd-eyebrow-klein m-0 mb-1 font-mono text-[12px] uppercase tracking-[0.14em] text-amber flex items-center gap-2">
        <span className="inline-block w-[22px] h-0.5 bg-amber" />
        KW {kalenderwoche(weekStart)} · {kurzDatum(weekStart)} – {formatDMY(addDays(weekStart, 6))}
      </p>
      <div className="flex items-center justify-between gap-3 mb-3">
        <h1>Plantafel</h1>
        <div className="flex gap-1.5">
          <button className="btn btn-outline !px-0 w-12" aria-label="Vorherige Woche" onClick={() => woche(-1)}><Icon name="zurueck" size={22} /></button>
          <button className="btn btn-outline !px-0 w-12" aria-label="Nächste Woche" onClick={() => woche(1)}><Icon name="zurueck" size={22} style={{ transform: 'rotate(180deg)' }} /></button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 mb-3">
        {wochentage.map((d) => {
          const aktiv = d.getTime() === gewaehlterTag.getTime()
          const istHeute = d.getTime() === heute.getTime()
          const hatAuftrag = orders.some((o) => orderCoversDate(o, d))
          return (
            <button
              key={d.toISOString()}
              onClick={() => { setGewaehlterTag(d); setTab((t) => (t === 'tag' || t === 'techniker' ? t : 'tag')) }}
              className={`flex flex-col items-center gap-0.5 py-2 border cursor-pointer ${aktiv ? 'bg-ink border-ink text-paper' : 'bg-white border-line text-ink'}`}
              aria-pressed={aktiv}
            >
              <span className={`font-mono text-[10.5px] uppercase tracking-[0.06em] ${aktiv ? 'text-paper/70' : 'text-ink-soft'}`}>{WOCHENTAGE[d.getDay()]}</span>
              <span className="font-display text-[22px] font-extrabold leading-none" style={{ fontFamily: 'var(--font-display)' }}>{d.getDate()}</span>
              <span className={`h-1 w-1 ${hatAuftrag ? (aktiv ? 'bg-paper' : 'bg-amber') : ''} ${istHeute && !hatAuftrag ? 'bg-ink-soft' : ''}`} />
            </button>
          )
        })}
      </div>

      <div className="grid grid-cols-4 gap-0.5 p-0.5 bg-line mb-4">
        {tabs.map((t) => {
          const aktiv = tab === t.key
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`relative min-h-[48px] border-0 cursor-pointer font-mono text-[11.5px] font-semibold uppercase tracking-[0.04em] ${aktiv ? 'bg-ink text-paper' : 'bg-white text-ink'}`}
            >
              {t.label}
              {t.zaehler > 0 && (
                <span className={`absolute top-1 right-1 min-w-[18px] h-[18px] px-1 grid place-items-center text-[10.5px] tracking-normal ${aktiv ? 'bg-paper text-ink' : t.akzent ? 'bg-amber text-white' : 'bg-ink text-paper'}`}>
                  {t.zaehler}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {tab === 'tag' && (
        <>
          <div className="font-mono text-[12px] uppercase tracking-[0.1em] text-ink-soft mb-3">
            {WOCHENTAGE[gewaehlterTag.getDay()]}, {formatDMY(gewaehlterTag)}
          </div>
          {technicians.length === 0 ? (
            <div className="text-sm text-ink-soft">Keine Techniker.</div>
          ) : technicians.map((tech) => <TagesBlock key={tech.id} tech={tech} datum={gewaehlterTag} mitName />)}
        </>
      )}

      {tab === 'techniker' && (
        <>
          <div className="flex gap-1.5 overflow-x-auto pb-2 mb-3 -mx-4 px-4">
            {technicians.map((tech) => (
              <button
                key={tech.id}
                onClick={() => setGewaehlterTechniker(tech.id)}
                className={`shrink-0 min-h-[44px] px-4 border cursor-pointer font-mono text-[12px] font-semibold uppercase tracking-[0.04em] ${tech.id === technikerId ? 'bg-ink border-ink text-paper' : 'bg-white border-line text-ink'}`}
              >
                {tech.name}
              </button>
            ))}
          </div>
          {wochentage.map((d) => {
            const tech = technicians.find((t) => t.id === technikerId)
            if (!tech) return null
            return (
              <div key={d.toISOString()}>
                <div className="font-mono text-[12px] uppercase tracking-[0.1em] text-ink-soft mb-2">{WOCHENTAGE[d.getDay()]}, {formatDMY(d)}</div>
                <TagesBlock tech={tech} datum={d} mitName={false} />
              </div>
            )
          })}
        </>
      )}

      {tab === 'offen' && (
        poolOrders.length === 0 ? (
          <div className="text-sm text-ink-soft border border-dashed border-line p-6 text-center">Alles eingeplant.</div>
        ) : (
          <div className="flex flex-col gap-2">
            {poolOrders.map((o) => (
              <button
                key={o.id}
                onClick={() => setVerschieben({ order: o, quelle: { orderId: o.id, fromTech: '', fromDate: '' } })}
                className="w-full text-left bg-white border border-line border-l-4 border-l-amber p-3 cursor-pointer block"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-[13px] font-semibold">
                    #{o.id}{(o.dauer_tage || 1) > 1 && <span className="font-normal text-ink-soft"> · {o.dauer_tage} Tage</span>}
                  </span>
                  <OrderStatusTag status={o.status} />
                </div>
                <div className="font-semibold mt-1.5 text-[16px] leading-tight">{o.einsatzkunde?.name || '–'}</div>
                <div className="font-mono text-[11px] uppercase tracking-[0.04em] text-steel mt-1.5">
                  {o.techniker.length === 0 ? 'Techniker fehlt' : `Termin fehlt · ${o.techniker.map((t) => t.name).join(', ')}`}
                </div>
              </button>
            ))}
          </div>
        )
      )}

      {tab === 'antraege' && (
        <>
          {antraege.length === 0 ? (
            <div className="text-sm text-ink-soft border border-dashed border-line p-6 text-center">Keine offenen Urlaubsanträge.</div>
          ) : (
            <div className="flex flex-col gap-3">
              {antraege.map((a: Urlaubsantrag) => (
                <div key={a.id} className="bg-white border border-line p-3.5">
                  <div className="font-semibold text-[16px]">{employeesById[a.techniker_id]?.name || '–'}</div>
                  <div className="font-mono text-[13px] mt-1">{zeitraum(a.von, a.bis)}</div>
                  <div className="text-[13px] text-ink-soft mt-1">{a.bemerkung || '–'} · beantragt am {new Date(a.beantragt_am).toLocaleDateString('de-DE')}</div>
                  <div className="grid grid-cols-2 gap-2 mt-3">
                    <button className="btn btn-amber" onClick={() => genehmigen(a)}>Genehmigen</button>
                    <button className="btn btn-danger" onClick={() => ablehnen(a)}>Ablehnen</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="font-mono text-[12px] uppercase tracking-[0.1em] text-ink-soft mt-7 mb-2.5">
            Abwesenheiten ({bevorstehendeAbwesenheiten.length})
          </div>
          {bevorstehendeAbwesenheiten.length === 0 ? (
            <div className="text-sm text-ink-soft border border-dashed border-line p-4 text-center">Keine laufenden oder bevorstehenden Abwesenheiten.</div>
          ) : (
            <div className="flex flex-col gap-2">
              {bevorstehendeAbwesenheiten.map((a) => (
                <div key={a.id} className="bg-white border border-line p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold">{employeesById[a.techniker_id]?.name || '–'}</span>
                    <span className="tag">{a.art}</span>
                  </div>
                  <div className="font-mono text-[12.5px] mt-1">{zeitraum(a.von, a.bis)}</div>
                  {darfAbwesenheitenPflegen && (
                    <div className="grid grid-cols-2 gap-2 mt-2.5">
                      <button className="btn btn-outline btn-sm" onClick={() => setAbwesenheitForm({ open: true, eintrag: a })}>Bearbeiten</button>
                      <button className="btn btn-danger btn-sm" onClick={() => abwesenheitLoeschen(a)}>Löschen</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {darfAbwesenheitenPflegen && (
        <button
          className="btn btn-amber fixed right-4 z-40"
          style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 78px)' }}
          onClick={() => setAbwesenheitForm({ open: true })}
        >
          <Icon name="hinzufuegen" size={20} /> Abwesenheit
        </button>
      )}

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

/** „Techniker und Datum wählen“ — ersetzt das Ziehen vom Desktop. */
function VerschiebenSheet({ order, quelle, technicians, sperre, abwesenheitFuer, onOeffnen, onClose, onSpeichern }: {
  order: OrderWithRelations
  quelle: DragData
  technicians: Employee[]
  sperre: Sperre
  abwesenheitFuer: (techId: string, d: Date) => Abwesenheit | undefined
  onOeffnen: () => void
  onClose: () => void
  onSpeichern: (techId: string, datumDMY: string) => void
}) {
  const toast = useToast()
  const startIso = order.einsatzbeginn || formatISO(new Date())
  const [techId, setTechId] = useState(quelle.fromTech)
  const [datum, setDatum] = useState(startIso)
  const ausPool = !quelle.fromTech
  const gesperrt = sperre === 'gesperrt'

  function speichern() {
    if (!techId) {
      // Zurück in den Pool — nur sinnvoll, wenn der Auftrag schon einen Techniker hat.
      if (ausPool) { toast('Bitte einen Techniker wählen.'); return }
      onSpeichern('', '')
      return
    }
    const d = parseISO(datum)
    if (!d) { toast('Bitte ein Datum wählen.'); return }
    if (abwesenheitFuer(techId, d)) { toast('Techniker ist an diesem Tag abwesend.'); return }
    onSpeichern(techId, formatDMY(d))
  }

  return (
    <Modal onClose={onClose}>
      <p className="font-mono text-[12px] uppercase tracking-[0.14em] text-amber m-0 mb-2">Auftrag #{order.id}</p>
      <ModalTitle>Techniker und Datum wählen</ModalTitle>
      <div className="font-semibold mb-3">{order.einsatzkunde?.name || '–'}</div>
      {sperre !== 'frei' && (
        <div className="border border-ink bg-white p-3 text-[13.5px] mb-3.5">{SPERR_TEXT[sperre]}</div>
      )}
      <div className="grid gap-3.5">
        <div>
          <label>Techniker</label>
          <select value={techId} disabled={gesperrt || sperre === 'nurTag'} onChange={(e) => setTechId(e.target.value)}>
            <option value="">{ausPool ? '– wählen –' : '– zurück in den Pool –'}</option>
            {technicians.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
        <div>
          <label>Datum</label>
          <input type="date" value={datum} disabled={gesperrt || !techId} onChange={(e) => setDatum(e.target.value)} />
        </div>
      </div>
      <ModalActions>
        <button className="btn btn-amber" disabled={gesperrt} onClick={speichern}>Speichern</button>
        <button className="btn btn-outline" onClick={onOeffnen}>Auftrag öffnen</button>
        <button className="btn btn-outline" onClick={onClose}>Abbrechen</button>
      </ModalActions>
    </Modal>
  )
}
