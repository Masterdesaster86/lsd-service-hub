import { useEffect, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useToast } from '../../components/ui/Toast'
import type { MachineBild } from '../../lib/types'

export function MachineBilderTab({ maschineId }: { maschineId: string }) {
  const toast = useToast()
  const [bilder, setBilder] = useState<MachineBild[] | null>(null)
  const [uploading, setUploading] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)

  async function load() {
    const { data } = await supabase.from('machine_bilder').select('*').eq('maschine_id', maschineId).order('created_at', { ascending: false })
    setBilder(data || [])
  }

  useEffect(() => { load() }, [maschineId])

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    setUploading(true)
    for (const file of Array.from(files)) {
      const path = `${maschineId}/${Date.now()}-${file.name}`
      const { error: upErr } = await supabase.storage.from('machine-photos').upload(path, file)
      if (upErr) { toast('Fehler beim Hochladen: ' + upErr.message); continue }
      const url = supabase.storage.from('machine-photos').getPublicUrl(path).data.publicUrl
      await supabase.from('machine_bilder').insert({ maschine_id: maschineId, url })
    }
    setUploading(false)
    toast('Bild(er) hinzugefügt.')
    load()
  }

  return (
    <div>
      <div
        onClick={() => fileInput.current?.click()}
        className="border-2 border-dashed border-line text-center py-8 text-sm text-ink-soft cursor-pointer hover:border-amber hover:text-ink"
      >
        {uploading ? 'Lädt hoch…' : '📷 Foto hinzufügen (Klick zum Auswählen)'}
      </div>
      <input ref={fileInput} type="file" accept="image/*" multiple className="hidden" onChange={(e) => handleFiles(e.target.files)} />

      <div className="grid grid-cols-4 gap-2 mt-4 max-sm:grid-cols-2">
        {bilder === null ? (
          <div className="text-sm text-ink-soft">Lädt…</div>
        ) : bilder.length === 0 ? (
          <div className="col-span-4 text-sm text-ink-soft border border-dashed border-line p-4 text-center">Noch keine Bilder hinterlegt.</div>
        ) : bilder.map((b) => (
          <a key={b.id} href={b.url} target="_blank" rel="noreferrer">
            <img src={b.url} className="w-full aspect-square object-cover border border-line" />
          </a>
        ))}
      </div>
    </div>
  )
}
