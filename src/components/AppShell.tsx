import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { LOGO_URL } from '../lib/branding'
import { NotificationBell } from './NotificationBell'

const NAV_ITEMS = [
  { to: '/auftraege', abbr: 'AU', label: 'Serviceaufträge', roles: ['Administrator', 'Disposition', 'Techniker', 'CEO'] },
  { to: '/kunden', abbr: 'KU', label: 'Kunden', roles: ['Administrator', 'Disposition', 'Techniker', 'CEO'] },
  { to: '/maschinen', abbr: 'MA', label: 'Maschinen', roles: ['Administrator', 'Disposition', 'Techniker', 'CEO'] },
  { to: '/plantafel', abbr: 'PL', label: 'Plantafel', roles: ['Administrator', 'Disposition', 'CEO'] },
  { to: '/verwaltung', abbr: 'VW', label: 'Meine Verwaltung', roles: ['Techniker', 'CEO'] },
  { to: '/mitarbeiter', abbr: 'MI', label: 'Mitarbeiter', roles: ['Administrator', 'CEO'] },
]

// Techniker bekommt die schlankere Anleitung; alle anderen Rollen liegen in
// ihren Möglichkeiten näher an CEO als an Techniker, deshalb die CEO-Fassung.
const anleitungUrl = (role?: string) => (role === 'Techniker' ? '/docs/anleitung-techniker.pdf' : '/docs/anleitung-ceo.pdf')

export function AppShell() {
  const { employee, signOut } = useAuth()
  const role = employee?.role
  // Vom Home-Bildschirm gestartet hat die App keine Browser-Oberfläche mehr —
  // ein Link mit target="_blank" öffnete das PDF dann ohne jede Möglichkeit,
  // wieder zurückzukommen. Das PDF läuft deshalb in einem eigenen Fenster
  // innerhalb der App mit einem echten Schließen-Knopf.
  const [zeigeAnleitung, setZeigeAnleitung] = useState(false)

  // Bewusst kein "position: fixed"-Overlay über der App: iOS leitet
  // Wischgesten in einem eingebetteten PDF innerhalb einer fixierten Ebene
  // teils nicht weiter — man sieht dann nur die erste Seite und kommt nicht
  // weiter. Stattdessen ersetzt diese Ansicht die App komplett, mit demselben
  // Aufbau (flex-col über die volle Höhe), der beim restlichen Inhalt bereits
  // zuverlässig scrollt.
  if (zeigeAnleitung && role) {
    return (
      <div className="flex flex-col h-full min-h-[640px]">
        <div className="bg-graphite shrink-0" style={{ height: 'env(safe-area-inset-top, 0px)' }} />
        <div className="bg-graphite shrink-0 flex items-center justify-between gap-3 px-4 py-3">
          <span className="text-white text-sm font-semibold">Anleitung</span>
          <button onClick={() => setZeigeAnleitung(false)} className="btn btn-sm !bg-white !text-graphite !border-white">Schließen</button>
        </div>
        <iframe src={anleitungUrl(role)} title="Anleitung" className="flex-1 min-h-0 w-full border-0 bg-white" />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full min-h-[640px]">
      {/* Streifen hinter der Statusleiste (Uhrzeit) dunkel halten, damit die
          weiße Systemschrift dort lesbar bleibt. Am Desktop 0 Pixel hoch. */}
      <div className="bg-graphite shrink-0" style={{ height: 'env(safe-area-inset-top, 0px)' }} />
      <div className="app-kopf bg-white border-b-2 border-blau flex items-center gap-3 shrink-0">
        <img src={LOGO_URL} alt="LSD Maschinenservice" className="h-9 w-auto mr-auto max-sm:h-7" />
        <div className="text-xs text-ink-soft text-right leading-tight max-sm:hidden">
          <div className="font-semibold text-ink">{employee?.name}</div>
          <div>{employee?.role}</div>
        </div>
        <NotificationBell />
        <button onClick={signOut} className="btn btn-outline btn-sm">Abmelden</button>
      </div>
      <div className="flex flex-1 min-h-0">
        <div className="app-seitenleiste w-[190px] shrink-0 bg-graphite-2 flex flex-col overflow-y-auto max-md:w-[64px]">
          <div className="flex-1 py-2 flex flex-col">
            {NAV_ITEMS.filter((item) => role && item.roles.includes(role)).map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `px-4.5 py-2.5 text-[13.5px] border-l-[3px] cursor-pointer max-md:px-2 max-md:py-3 max-md:text-center ${
                    isActive ? 'text-white border-amber bg-amber/10' : 'text-[#B7BEC5] border-transparent hover:text-white'
                  }`
                }
              >
                <span className="max-md:hidden">{item.label}</span>
                <span className="hidden max-md:inline font-mono text-[11px]">{item.abbr}</span>
              </NavLink>
            ))}
          </div>
          {role && (
            <button
              onClick={() => setZeigeAnleitung(true)}
              className="px-4.5 py-3 text-[12.5px] text-[#8B929B] border-0 border-t border-white/10 border-l-[3px] border-l-transparent cursor-pointer hover:text-white max-md:px-2 max-md:py-3 max-md:text-center bg-transparent w-full text-left font-sans"
            >
              <span className="max-md:hidden">Anleitung (PDF)</span>
              <span className="hidden max-md:inline font-mono text-[11px]">PDF</span>
            </button>
          )}
        </div>
        <div className="app-inhalt flex-1 min-w-0 overflow-y-auto p-6 relative">
          <img src={LOGO_URL} alt="" aria-hidden className="fixed w-[700px] max-w-none opacity-[0.04] pointer-events-none select-none -z-10" style={{ top: '55%', left: '60%', transform: 'translate(-50%, -50%) rotate(-8deg)' }} />
          <div className="relative"><Outlet /></div>
        </div>
      </div>
    </div>
  )
}
