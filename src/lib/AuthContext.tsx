import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'
import { geraetespeicherLeeren, offlineZustand } from './offline'
import type { Employee } from './types'

interface AuthState {
  session: Session | null
  employee: Employee | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
  refreshEmployee: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

/** Die von Supabase im Gerät abgelegte Anmeldung (auch wenn das Token abgelaufen ist). */
function gespeicherteSitzung(): Session | null {
  try {
    const key = Object.keys(localStorage).find((k) => /^sb-.+-auth-token$/.test(k))
    const s = key ? JSON.parse(localStorage.getItem(key) || 'null') : null
    return s?.access_token && s?.user ? (s as Session) : null
  } catch {
    return null
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [employee, setEmployee] = useState<Employee | null>(null)
  const [loading, setLoading] = useState(true)

  async function loadEmployee() {
    const { data, error } = await supabase.rpc('current_employee').single()
    if (error) {
      console.error('current_employee fehlgeschlagen', error)
      setEmployee(null)
      return
    }
    setEmployee(data as Employee)
  }

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      // Ohne Netz kann ein abgelaufenes Token nicht erneuert werden — dann mit der
      // auf dem Gerät gespeicherten Anmeldung weiterarbeiten (Daten kommen offline
      // ohnehin vom Gerät). Mit Netz erneuert Supabase das Token automatisch.
      const s = data.session ?? (offlineZustand().offline ? gespeicherteSitzung() : null)
      setSession(s)
      if (s) await loadEmployee()
      setLoading(false)
    })

    const { data: sub } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      if (!newSession && event !== 'SIGNED_OUT' && gespeicherteSitzung()) return
      setSession(newSession)
      if (newSession) {
        await loadEmployee()
      } else {
        setEmployee(null)
      }
    })

    return () => sub.subscription.unsubscribe()
  }, [])

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) return { error: error.message }
    return { error: null }
  }

  async function signOut() {
    await supabase.auth.signOut()
    // Auf dem Gerät gespeicherte Daten gehören zu dieser Anmeldung.
    await geraetespeicherLeeren().catch(() => {})
    setEmployee(null)
  }

  return (
    <AuthContext.Provider value={{ session, employee, loading, signIn, signOut, refreshEmployee: loadEmployee }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth muss innerhalb von AuthProvider verwendet werden')
  return ctx
}
