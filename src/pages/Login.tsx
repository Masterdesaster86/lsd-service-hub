import { useState, type FormEvent } from 'react'
import { useAuth } from '../lib/AuthContext'
import { LOGO_URL } from '../lib/branding'

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
    <div className="min-h-screen flex items-center justify-center bg-graphite p-6 relative overflow-hidden">
      <img src={LOGO_URL} alt="" aria-hidden className="absolute w-[900px] max-w-none opacity-[0.06] pointer-events-none select-none" style={{ top: '50%', left: '50%', transform: 'translate(-50%, -50%) rotate(-8deg)' }} />
      <form onSubmit={handleSubmit} className="relative bg-paper w-full max-w-sm p-8 shadow-xl">
        <div className="flex items-center gap-2.5 mb-6">
          <img src={LOGO_URL} alt="LSD Maschinenservice" className="h-10 w-auto" />
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
      </form>
    </div>
  )
}
