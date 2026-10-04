import { useState, type FormEvent } from 'react'
import { useAuth } from '../lib/AuthContext'
import { APP_HINTERGRUND_URL, LOGO_SCHRIFTZUG } from '../lib/branding'
import { DesignSchalter } from '../components/ui/DesignSchalter'

export function Login() {
  const { signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const { error } = await signIn(email, password)
    setBusy(false)
    if (error) setError('Anmeldung fehlgeschlagen. Bitte E-Mail und Passwort prüfen.')
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center bg-graphite p-6 relative overflow-hidden bg-cover bg-center"
      style={{ backgroundImage: `url(${APP_HINTERGRUND_URL})` }}
    >
      {/* Abdunkelung, damit die Anmeldekarte klar im Vordergrund steht */}
      <div className="absolute inset-0 bg-graphite/70 pointer-events-none" />
      <form onSubmit={handleSubmit} className="relative bg-paper w-full max-w-sm p-8 border-t-4 border-amber">
        <div className="flex items-center gap-2.5 mb-6">
          <img src={LOGO_SCHRIFTZUG} alt="LSD Maschinenservice" className="h-11 w-auto" />
        </div>
        <div className="mb-4">
          <label>E-Mail</label>
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" />
        </div>
        <div className="mb-4">
          <label>Passwort</label>
          <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
        </div>
        {error && <p className="text-red text-sm mb-4">{error}</p>}
        <button type="submit" disabled={busy} className="btn btn-amber w-full justify-center">
          {busy ? 'Anmelden…' : 'Anmelden'}
        </button>
        <div className="mt-6 pt-4 border-t border-line">
          <DesignSchalter />
        </div>
      </form>
    </div>
  )
}
