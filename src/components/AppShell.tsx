import { useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { LOGO_SCHRIFTZUG } from '../lib/branding'
import { NotificationBell } from './NotificationBell'
import { PdfViewer } from './PdfViewer'
import { Icon, type IconName } from './ui/Icon'
import { DesignSchalter } from './ui/DesignSchalter'

interface NavItem {
  to: string
  label: string
  kurz: string
  icon: IconName
  roles: string[]
  /** Auf dem Handy direkt in der unteren Leiste (sonst unter „Mehr“). */
  hauptpunkt: boolean
}

const NAV_ITEMS: NavItem[] = [
  { to: '/auftraege', label: 'Serviceaufträge', kurz: 'Aufträge', icon: 'auftraege', roles: ['Administrator', 'Disposition', 'Techniker', 'CEO'], hauptpunkt: true },
  { to: '/kunden', label: 'Kunden', kurz: 'Kunden', icon: 'kunden', roles: ['Administrator', 'Disposition', 'Techniker', 'CEO'], hauptpunkt: true },
  { to: '/maschinen', label: 'Maschinen', kurz: 'Maschinen', icon: 'maschinen', roles: ['Administrator', 'Disposition', 'Techniker', 'CEO'], hauptpunkt: true },
  { to: '/plantafel', label: 'Plantafel', kurz: 'Plantafel', icon: 'plantafel', roles: ['Administrator', 'Disposition', 'CEO'], hauptpunkt: true },
  { to: '/verwaltung', label: 'Meine Verwaltung', kurz: 'Verwaltung', icon: 'verwaltung', roles: ['Techniker', 'CEO'], hauptpunkt: false },
  { to: '/mitarbeiter', label: 'Mitarbeiter', kurz: 'Mitarbeiter', icon: 'mitarbeiter', roles: ['Administrator', 'CEO'], hauptpunkt: false },
  { to: '/wissen', label: 'Wissens-Suche', kurz: 'Wissen', icon: 'wissen', roles: ['CEO'], hauptpunkt: false },
]

const ANLEITUNGEN = {
  techniker: { url: '/docs/anleitung-techniker.pdf', titel: 'Anleitung — Techniker' },
  ceo: { url: '/docs/anleitung-ceo.pdf', titel: 'Anleitung — CEO' },
} as const
type AnleitungKey = keyof typeof ANLEITUNGEN

export function AppShell() {
  const { employee, signOut } = useAuth()
  const location = useLocation()
  const role = employee?.role
  // Techniker braucht nur die eigene, schlankere Anleitung. Alle anderen
  // Rollen sehen beide: Die CEO-Fassung beschreibt nur die zusätzlichen
  // Funktionen und verweist für die eigentlichen Technikerabläufe (Bericht
  // ausfüllen, abschließen, teilen) auf die Techniker-Anleitung — die muss
  // also greifbar bleiben.
  const verfuegbareAnleitungen: AnleitungKey[] = role === 'Techniker' ? ['techniker'] : ['techniker', 'ceo']

  // Vom Home-Bildschirm gestartet hat die App keine Browser-Oberfläche mehr —
  // ein Link mit target="_blank" öffnete das PDF dann ohne jede Möglichkeit,
  // wieder zurückzukommen. Das PDF läuft deshalb in einem eigenen Fenster
  // innerhalb der App mit einem echten Schließen-Knopf.
  const [zeigeAnleitung, setZeigeAnleitung] = useState<AnleitungKey | null>(null)
  const [mehrOffen, setMehrOffen] = useState(false)

  // Diese Ansicht ersetzt die App komplett, mit demselben Aufbau (flex-col
  // über die volle Höhe), der beim restlichen Inhalt bereits zuverlässig
  // scrollt — kein "position: fixed"-Overlay.
  if (zeigeAnleitung) {
    const anleitung = ANLEITUNGEN[zeigeAnleitung]
    return (
      <div className="flex flex-col h-full min-h-[640px]">
        <div className="bg-graphite shrink-0" style={{ height: 'env(safe-area-inset-top, 0px)' }} />
        <div className="bg-graphite shrink-0 flex items-center justify-between gap-3 px-4 py-3">
          <span className="text-white text-sm font-semibold">{anleitung.titel}</span>
          <button onClick={() => setZeigeAnleitung(null)} className="btn btn-sm !bg-white !text-graphite !border-white">Schließen</button>
        </div>
        <PdfViewer url={anleitung.url} />
      </div>
    )
  }

  const sichtbar = NAV_ITEMS.filter((item) => role && item.roles.includes(role))
  const hauptpunkte = sichtbar.filter((i) => i.hauptpunkt)
  const mehrPunkte = sichtbar.filter((i) => !i.hauptpunkt)
  // „Mehr“ ist aktiv, wenn gerade eine der dort liegenden Seiten offen ist.
  const mehrAktiv = mehrPunkte.some((i) => location.pathname.startsWith(i.to))

  return (
    <div className="flex flex-col h-full min-h-[640px]">
      {/* Streifen hinter der Statusleiste (Uhrzeit) dunkel halten, damit die
          weiße Systemschrift dort lesbar bleibt. Am Desktop 0 Pixel hoch. */}
      <div className="bg-graphite shrink-0" style={{ height: 'env(safe-area-inset-top, 0px)' }} />
      <div className="app-kopf bg-graphite flex items-center gap-3 shrink-0 min-h-[60px]">
        {/* Logo auf heller Platte mit schräger Unterkante links, wie auf der Webseite */}
        <div
          className="bg-paper self-stretch flex items-center pl-[22px] pr-[14px]"
          style={{ clipPath: 'polygon(0 0, 100% 0, 100% 100%, 12px 100%)' }}
        >
          <img src={LOGO_SCHRIFTZUG} alt="LSD Maschinenservice" className="h-[24px] w-auto block" />
        </div>
        <div className="ml-auto text-right leading-tight">
          <div className="font-mono text-[11.5px] uppercase tracking-[0.08em] text-[#9aa7ac]">{employee?.role}</div>
          <div className="text-[13px] text-[#eef0ee] max-md:hidden">{employee?.name}</div>
        </div>
        <NotificationBell />
        <button onClick={signOut} className="btn btn-sm !bg-transparent !text-[#eef0ee] !border-[#9aa7ac] max-md:hidden">Abmelden</button>
      </div>
      <div className="flex flex-1 min-h-0">
        <div className="app-seitenleiste w-[210px] shrink-0 bg-graphite-2 flex flex-col overflow-y-auto max-md:hidden">
          <div className="flex-1 py-2 flex flex-col">
            {sichtbar.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-4 py-3 font-mono text-[12.5px] font-semibold uppercase tracking-[0.05em] border-l-[4px] cursor-pointer ${
                    isActive ? 'text-white border-amber bg-white/5' : 'text-[#b7bec5] border-transparent hover:text-white'
                  }`
                }
              >
                <Icon name={item.icon} size={22} />
                <span>{item.label}</span>
              </NavLink>
            ))}
          </div>
          {role && (
            <div className="border-t border-white/10 flex flex-col">
              {verfuegbareAnleitungen.map((key, i) => (
                <button
                  key={key}
                  onClick={() => setZeigeAnleitung(key)}
                  className={`px-4 py-3 font-mono text-[11.5px] uppercase tracking-[0.05em] text-[#8b979c] border-0 border-l-[4px] border-l-transparent cursor-pointer hover:text-white bg-transparent w-full text-left ${i > 0 ? 'border-t border-white/10' : ''}`}
                >
                  {verfuegbareAnleitungen.length > 1 ? `Anleitung ${key === 'techniker' ? 'Techniker' : 'CEO'} (PDF)` : 'Anleitung (PDF)'}
                </button>
              ))}
            </div>
          )}
          <div className="border-t border-white/10 p-3">
            <DesignSchalter dunkel />
          </div>
        </div>
        <div className="app-inhalt flex-1 min-w-0 overflow-y-auto p-6 max-md:p-4 max-md:pb-6 relative">
          <Outlet />
        </div>
      </div>

      {/* Untere Navigation auf dem Handy. Die Hauptpunkte liegen direkt im
          Daumenbereich, alles Weitere unter „Mehr“. */}
      <nav
        className="md:hidden shrink-0 grid bg-white border-t-2 border-ink"
        style={{ gridTemplateColumns: `repeat(${hauptpunkte.length + 1}, minmax(0, 1fr))`, paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        {hauptpunkte.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={() => setMehrOffen(false)}
            className={({ isActive }) =>
              `relative flex flex-col items-center justify-center gap-1.5 min-h-[62px] px-0.5 pt-2 pb-1.5 ${isActive && !mehrOffen ? 'text-ink' : 'text-ink-soft'}`
            }
          >
            {({ isActive }) => (
              <>
                {isActive && !mehrOffen && <span className="absolute -top-0.5 left-[12%] right-[12%] h-1 bg-amber" />}
                <Icon name={item.icon} size={26} />
                <span className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.03em] leading-[1.15] text-center">{item.kurz}</span>
              </>
            )}
          </NavLink>
        ))}
        <button
          onClick={() => setMehrOffen((o) => !o)}
          className={`relative flex flex-col items-center justify-center gap-1.5 min-h-[62px] px-0.5 pt-2 pb-1.5 border-0 bg-transparent cursor-pointer ${mehrOffen || mehrAktiv ? 'text-ink' : 'text-ink-soft'}`}
          aria-expanded={mehrOffen}
        >
          {(mehrOffen || mehrAktiv) && <span className="absolute -top-0.5 left-[12%] right-[12%] h-1 bg-amber" />}
          <Icon name="mehr" size={26} />
          <span className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.03em] leading-[1.15]">Mehr</span>
        </button>
      </nav>

      {mehrOffen && (
        <div className="md:hidden fixed inset-0 z-50 flex flex-col justify-end" onClick={() => setMehrOffen(false)}>
          <div className="absolute inset-0 bg-[rgba(9,11,13,0.72)]" />
          <div
            className="relative bg-paper border-t-2 border-ink"
            style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 62px)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3.5 border-b border-line">
              <h2 className="!text-[24px]">Mehr</h2>
              <button
                onClick={() => setMehrOffen(false)}
                aria-label="Schließen"
                className="w-12 h-12 grid place-items-center border-[1.5px] border-ink bg-transparent cursor-pointer text-ink"
              >
                <Icon name="schliessen" size={22} />
              </button>
            </div>
            <div className="flex flex-col">
              {mehrPunkte.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={() => setMehrOffen(false)}
                  className="flex items-center gap-3.5 px-4 min-h-[58px] border-b border-line font-semibold text-[16px]"
                >
                  <Icon name={item.icon} size={24} />
                  {item.label}
                </NavLink>
              ))}
              {verfuegbareAnleitungen.map((key) => (
                <button
                  key={key}
                  onClick={() => { setMehrOffen(false); setZeigeAnleitung(key) }}
                  className="flex items-center gap-3.5 px-4 min-h-[58px] border-0 border-b border-line bg-transparent text-left font-sans font-semibold text-[16px] text-ink cursor-pointer"
                >
                  <Icon name="pdf" size={24} />
                  {verfuegbareAnleitungen.length > 1 ? `Anleitung ${key === 'techniker' ? 'Techniker' : 'CEO'} (PDF)` : 'Anleitung (PDF)'}
                </button>
              ))}
              <div className="p-4 flex flex-col gap-4">
                <DesignSchalter />
                <button onClick={signOut} className="btn btn-outline w-full">Abmelden</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
