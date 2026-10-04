// Strich-Icons aus dem LSD-Design-System (48er Raster, runde Enden, keine Fuellung).
// Angezeigt in 24px mit Strichstaerke 4 (entspricht 2px im 48er Raster bei 48px).
import type { SVGProps } from 'react'

const PFADE = {
  auftraege: "M10 8h28v32H10z M18 5h12v6H18z M16 19h16M16 25h16M16 31h10",
  kunden: "M10 42V12h18v30 M28 42V22h10v20 M6 42h36 M16 19h6M16 26h6M16 33h6",
  maschinen: "M14 6h20v14H14z M20 20v7h8v-7M24 27v6 M8 36h32v6H8z",
  plantafel: "M8 11h32v29H8z M8 19h32M16 6v8M32 6v8M15 27h4M25 27h4M15 33h4",
  mehr: "M10 14h28M10 24h28M10 34h28",
  verwaltung: "M6 11h36v26H6z M19 22a4 4 0 1 1-8 0 4 4 0 0 1 8 0z M10 31c0-3 3-5 5-5s5 2 5 5 M26 20h10M26 27h10",
  mitarbeiter: "M22 16a6 6 0 1 1-12 0 6 6 0 0 1 12 0z M6 40c0-7 5-11 10-11s10 4 10 11z M38 18a5 5 0 1 1-10 0 5 5 0 0 1 10 0z M32 29c6 0 10 4 10 11h-10",
  wissen: "M24 14c-3-3-8-4-16-4v26c8 0 13 1 16 4 3-3 8-4 16-4V10c-8 0-13 1-16 4z M24 14v26",
  bericht: "M12 6h17l9 9v27H12z M29 6v9h9 M18 24h14M18 30h14M18 36h8",
  messprotokoll: "M12 8h24v34H12z M19 5h10v6H19z M17 22l3 3 5-6 M17 34l3 3 5-6 M30 23h3M30 35h3",
  ersatzteil: "M24 6l15.6 9v18L24 42 8.4 33V15z M30 24a6 6 0 1 1-12 0 6 6 0 0 1 12 0z",
  zeit: "M40 24a16 16 0 1 1-32 0 16 16 0 0 1 32 0z M24 14v10l7 5",
  standort: "M24 42S12 29.5 12 20a12 12 0 0 1 24 0c0 9.5-12 22-12 22z M28 20a4 4 0 1 1-8 0 4 4 0 0 1 8 0z",
  anrufen: "M14 8h6l3 8-4 3a22 22 0 0 0 10 10l3-4 8 3v6a4 4 0 0 1-4 4C21 38 10 27 10 12a4 4 0 0 1 4-4z",
  foto: "M8 16h7l3-5h12l3 5h7v22H8z M31 26a7 7 0 1 1-14 0 7 7 0 0 1 14 0z",
  unterschrift: "M8 32c4-10 8-15 10-13s-4 13 0 13 6-9 9-9-1 7 2 7 5-3 5-3M8 40h32",
  abwesenheit: "M8 11h32v29H8z M8 19h32M16 6v8M32 6v8M18 25l12 10M30 25L18 35",
  erledigt: "M40 24a16 16 0 1 1-32 0 16 16 0 0 1 32 0z M16 24l6 6 11-12",
  hinzufuegen: "M24 10v28M10 24h28",
  bearbeiten: "M32 8l8 8-22 22-10 2 2-10z M28 12l8 8",
  loeschen: "M10 14h28M18 14V9h12v5 M13 14l2 28h18l2-28 M20 22v12M28 22v12",
  teilen: "M24 32V8 M16 16l8-8 8 8 M10 28v12h28V28",
  pdf: "M24 8v24 M16 24l8 8 8-8 M10 40h28",
  zurueck: "M30 10L16 24l14 14",
  schliessen: "M12 12l24 24M36 12L12 36",
} as const

export type IconName = keyof typeof PFADE

export function Icon({ name, size = 24, strokeWidth = 4, ...rest }: { name: IconName; size?: number; strokeWidth?: number } & Omit<SVGProps<SVGSVGElement>, 'name'>) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ flex: 'none' }}
      {...rest}
    >
      <path d={PFADE[name]} />
    </svg>
  )
}
