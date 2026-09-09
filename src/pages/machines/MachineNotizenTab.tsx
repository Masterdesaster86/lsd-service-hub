import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/AuthContext'
import { useToast } from '../../components/ui/Toast'
import type { MachineNotiz } from '../../lib/types'

interface NoteRow extends MachineNotiz {
  autor: { name: string } | null
}

export function MachineNotizenTab({ maschineId }: { maschineId: string }) {
  const { employee } = useAuth()
  const toast = useToast()
  const [notes, setNotes] = useState<NoteRow[] | null>(null)
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)

  async function load() {
    const { data } = await supabase
      .from('machine_notizen')
      .select('*, autor:employees(name)')
      .eq('maschine_id', maschineId)
      .order('created_at', { ascending: false })
    setNotes((data as unknown as NoteRow[]) || [])
  }

  useEffect(() => { load() }, [maschineId])

  async function handleAdd() {
    const text = draft.trim()
    if (!text || !employee) return
    setSaving(true)
    const { error } = await supabase.from('machine_notizen').insert({ maschine_id: maschineId, autor_id: employee.id, text })
    setSaving(false)
    if (error) { toast('Fehler: ' + error.message); return }
    setDraft('')
    toast('Notiz gespeichert.')
    load()
  }

  return (
    <div>
      <label>Neue interne Notiz</label>
      <textarea rows={3} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="z.B. Auffälligkeiten, Hinweise für Kollegen ..." />
      <button className="btn btn-outline btn-sm mt-2" disabled={saving} onClick={handleAdd}>Notiz hinzufügen</button>

      <div className="mt-4">
        {notes === null ? (
          <div className="text-sm text-ink-soft">Lädt…</div>
        ) : notes.length === 0 ? (
          <div className="text-sm text-ink-soft border border-dashed border-line p-4 text-center">Noch keine internen Notizen.</div>
        ) : (
          <div className="flex flex-col gap-2">
            {notes.map((n) => (
              <div key={n.id} className="card p-3">
                <div className="text-xs text-ink-soft mb-1">{new Date(n.created_at).toLocaleString('de-DE')} · {n.autor?.name || '–'}</div>
                <div className="text-sm">{n.text}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
