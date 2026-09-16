import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/AuthContext'
import { useConfirm } from '../../components/ui/ConfirmProvider'
import { useToast } from '../../components/ui/Toast'
import type { Customer, Employee, Machine, Messprotokoll, Order } from '../../lib/types'
import { MESSPROTOKOLL_TYPEN } from '../../lib/messprotokoll'
import { buildMessprotokollPdf, messprotokollPdfFilename } from '../../lib/pdf'

export function MessprotokollDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { employee } = useAuth()
  const confirm = useConfirm()
  const toast = useToast()

  const [protokoll, setProtokoll] = useState<Messprotokoll | null>(null)
  const [order, setOrder] = useState<Order | null>(null)
  const [machine, setMachine] = useState<Machine | null>(null)
  const [kunde, setKunde] = useState<Customer | null>(null)
  const [techniker, setTechniker] = useState<Employee | null>(null)
  const [abnehmer, setAbnehmer] = useState('')
  const [ppNummer, setPpNummer] = useState('')
  const [werte, setWerte] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [downloadingPdf, setDownloadingPdf] = useState(false)

  async function load() {
    if (!id) return
    const { data: p } = await supabase.from('messprotokolle').select('*').eq('id', id).maybeSingle()
    if (!p) { setProtokoll(null); return }
    setProtokoll(p)
    setAbnehmer(p.abnehmer || '')
    setPpNummer(p.pp_nummer || '')
    setWerte((p.werte as Record<string, string>) || {})
    const [{ data: o }, { data: m }, { data: tech }] = await Promise.all([
      supabase.from('orders').select('*').eq('id', p.auftrag_id).maybeSingle(),
      supabase.from('machines').select('*').eq('id', p.maschine_id).maybeSingle(),
      supabase.from('employees').select('*').eq('id', p.techniker_id).maybeSingle(),
    ])
    setOrder(o)
    setMachine(m)
    setTechniker(tech)
    if (m) {
      const { data: c } = await supabase.from('customers').select('*').eq('id', m.kunde_id).maybeSingle()
      setKunde(c)
    }
  }

  useEffect(() => { load() }, [id])

  if (!protokoll) return <div className="text-sm text-ink-soft">Lädt…</div>

  const typDef = MESSPROTOKOLL_TYPEN[protokoll.typ as keyof typeof MESSPROTOKOLL_TYPEN]
  const editable = protokoll.status === 'offen' && employee?.id === protokoll.techniker_id
  const canDelete = employee?.role === 'Administrator' || employee?.role === 'Disposition' || employee?.role === 'CEO'

  async function speichern() {
    setSaving(true)
    const { error } = await supabase.from('messprotokolle').update({
      abnehmer: abnehmer || null,
      pp_nummer: ppNummer || null,
      werte,
    }).eq('id', protokoll!.id)
    setSaving(false)
    if (error) { toast('Fehler: ' + error.message); return }
    toast('Gespeichert.')
    load()
  }

  async function abschliessen() {
    const ok = await confirm({ message: 'Messprotokoll abschließen? Danach lässt es sich nicht mehr ändern.' })
    if (!ok) return
    setSaving(true)
    const { error } = await supabase.from('messprotokolle').update({
      abnehmer: abnehmer || null,
      pp_nummer: ppNummer || null,
      werte,
      status: 'abgeschlossen',
      abgeschlossen_am: new Date().toISOString(),
    }).eq('id', protokoll!.id)
    setSaving(false)
    if (error) { toast('Fehler: ' + error.message); return }
    toast('Messprotokoll abgeschlossen.')
    load()
  }

  async function handleDelete() {
    const ok = await confirm({ message: 'Dieses Messprotokoll wirklich unwiderruflich löschen?', danger: true, confirmLabel: 'Löschen' })
    if (!ok) return
    const { error } = await supabase.from('messprotokolle').delete().eq('id', protokoll!.id)
    if (error) { toast('Fehler: ' + error.message); return }
    toast('Messprotokoll gelöscht.')
    navigate(`/maschinen/${protokoll!.maschine_id}`)
  }

  async function handleDownloadPdf() {
    setDownloadingPdf(true)
    try {
      const pdf = await buildMessprotokollPdf({ protokoll: protokoll!, order, machine, kunde, techniker, abnehmer, ppNummer, werte })
      pdf.save(messprotokollPdfFilename(protokoll!))
    } catch (e) {
      toast(e instanceof Error ? e.message : 'PDF konnte nicht erzeugt werden.')
    } finally {
      setDownloadingPdf(false)
    }
  }

  return (
    <div>
      <button className="text-sm text-steel bg-transparent border-none cursor-pointer p-0 mb-4" onClick={() => navigate(`/maschinen/${protokoll.maschine_id}`)}>← Zurück zur Maschine</button>

      <div className="flex items-start justify-between gap-4 flex-wrap mb-4 card p-4">
        <div>
          <div className="text-lg font-semibold text-amber">Messprotokoll — {typDef.label}</div>
          <div className="font-semibold">Auftrag #{order?.id || protokoll.auftrag_id} · {machine?.bezeichnung || '–'}</div>
          <div className="text-sm text-ink-soft">{kunde?.name || '–'} · Techniker: {techniker?.name || '–'}</div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`tag ${protokoll.status === 'abgeschlossen' ? 'tag-abgeschlossen' : 'tag-offen'}`}>{protokoll.status === 'abgeschlossen' ? 'Abgeschlossen' : 'Offen'}</span>
          {canDelete && <button className="btn btn-danger btn-sm" onClick={handleDelete}>Löschen</button>}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3.5 mb-4 max-sm:grid-cols-1">
        <div>
          <label>PP-Nr. / Projektnummer (optional)</label>
          <input type="text" disabled={!editable} value={ppNummer} onChange={(e) => setPpNummer(e.target.value)} />
        </div>
        <div>
          <label>Abnehmer</label>
          <input type="text" disabled={!editable} value={abnehmer} onChange={(e) => setAbnehmer(e.target.value)} placeholder="Name des Kunden-Ansprechpartners" />
        </div>
      </div>

      {typDef.gruppen.map((gruppe) => (
        <div key={gruppe.titel} className="mb-5">
          <div className="font-semibold text-sm uppercase tracking-wide text-ink-soft mb-1.5">{gruppe.titel}</div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="text-left text-xs text-ink-soft uppercase tracking-wide">
                  <th className="border-b border-line py-1.5 pr-2 w-12">Nr.</th>
                  <th className="border-b border-line py-1.5 pr-2">Prüfpunkt</th>
                  <th className="border-b border-line py-1.5 pr-2 w-40">Prüfmittel</th>
                  <th className="border-b border-line py-1.5 pr-2 w-48">Zulässige Abweichung</th>
                  <th className="border-b border-line py-1.5 w-32">Gemessen</th>
                </tr>
              </thead>
              <tbody>
                {gruppe.punkte.map((p) => (
                  <tr key={p.key}>
                    <td className="border-b border-line py-1.5 pr-2 font-mono text-xs align-top">{p.nr}</td>
                    <td className="border-b border-line py-1.5 pr-2 align-top">{p.bezeichnung}</td>
                    <td className="border-b border-line py-1.5 pr-2 align-top text-ink-soft text-[13px]">{p.pruefmittel}</td>
                    <td className="border-b border-line py-1.5 pr-2 align-top text-ink-soft text-[13px]">{p.toleranz}</td>
                    <td className="border-b border-line py-1.5 align-top">
                      <input
                        type="text"
                        disabled={!editable}
                        value={werte[p.key] || ''}
                        onChange={(e) => setWerte((w) => ({ ...w, [p.key]: e.target.value }))}
                        className="!py-1"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      {editable && (
        <div className="flex gap-2.5 flex-wrap mt-5">
          <button className="btn btn-outline" disabled={saving} onClick={speichern}>Zwischenspeichern</button>
          <button className="btn btn-amber" disabled={saving} onClick={abschliessen}>Messprotokoll abschließen</button>
        </div>
      )}
      {protokoll.status === 'abgeschlossen' && (
        <div className="border border-green p-3 text-sm mt-4 flex items-center justify-between gap-3 flex-wrap">
          <span>✓ Abgeschlossen am {protokoll.abgeschlossen_am ? new Date(protokoll.abgeschlossen_am).toLocaleString('de-DE') : '–'}</span>
          <button className="btn btn-outline btn-sm" disabled={downloadingPdf} onClick={handleDownloadPdf}>{downloadingPdf ? 'Erzeuge PDF…' : 'PDF herunterladen'}</button>
        </div>
      )}
    </div>
  )
}
