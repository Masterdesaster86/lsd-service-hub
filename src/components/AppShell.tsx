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

export function AppShell() {
  const { employee, signOut } = useAuth()
  const role = employee?.role

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
        <div className="app-seitenleiste w-[190px] shrink-0 bg-graphite-2 flex flex-col py-2 overflow-y-auto max-md:w-[64px]">
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
        <div className="app-inhalt flex-1 min-w-0 overflow-y-auto p-6 relative">
          <img src={LOGO_URL} alt="" aria-hidden className="fixed w-[700px] max-w-none opacity-[0.04] pointer-events-none select-none -z-10" style={{ top: '55%', left: '60%', transform: 'translate(-50%, -50%) rotate(-8deg)' }} />
          <div className="relative"><Outlet /></div>
        </div>
      </div>
    </div>
  )
}
