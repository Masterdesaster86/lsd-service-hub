import { useEffect, useState } from 'react'
import { PlantafelDesktop } from './PlantafelDesktop'
import { PlantafelMobil } from './PlantafelMobil'

/** Ab dieser Breite passt das Raster (Techniker × Tage) auf den Bildschirm.
 * Darunter — Handy und Tablet im Hochformat — gibt es die mobile Disposition. */
const RASTER_AB_PX = 1024

function useBreiterAls(px: number) {
  const abfrage = `(min-width: ${px}px)`
  const [breit, setBreit] = useState(() => window.matchMedia(abfrage).matches)
  useEffect(() => {
    const mq = window.matchMedia(abfrage)
    const aktualisieren = () => setBreit(mq.matches)
    mq.addEventListener('change', aktualisieren)
    return () => mq.removeEventListener('change', aktualisieren)
  }, [abfrage])
  return breit
}

export function Plantafel() {
  const breit = useBreiterAls(RASTER_AB_PX)
  return breit ? <PlantafelDesktop /> : <PlantafelMobil />
}
