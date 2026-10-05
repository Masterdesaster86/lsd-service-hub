import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import { AuthProvider } from './lib/AuthContext'
import { ToastProvider } from './components/ui/Toast'
import { ConfirmProvider } from './components/ui/ConfirmProvider'
import { zurGewaehltenFassung } from './lib/designwahl'

// Übergangsphase: Hat das Gerät die andere Fassung gewählt (bisher / neues
// Design), wird dorthin umgeleitet, bevor überhaupt etwas angezeigt wird.
declare const __BUILD_ID__: string

// Offline-Modus: Der Service Worker legt die App aufs Gerät, damit sie ohne Netz startet.
// Die Versionsnummer in der Adresse sorgt dafür, dass jedes Update ankommt.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register(`${import.meta.env.BASE_URL}sw.js?v=${__BUILD_ID__}`, { scope: import.meta.env.BASE_URL })
      .catch((e) => console.error('Service Worker nicht registriert', e))
  })
}

if (!zurGewaehltenFassung()) {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      {/* "/" für die bisherige Fassung, "/neu" für das neue Design */}
      <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '')}>
        <AuthProvider>
          <ToastProvider>
            <ConfirmProvider>
              <App />
            </ConfirmProvider>
          </ToastProvider>
        </AuthProvider>
      </BrowserRouter>
    </StrictMode>,
  )
}
