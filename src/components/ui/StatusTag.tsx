const ORDER_STATUS_MAP: Record<string, [string, string]> = {
  neu: ['tag-neu', 'Neu'],
  'in Arbeit': ['tag-arbeit', 'In Arbeit'],
  erledigt: ['tag-geplant', 'Erledigt'],
  abgerechnet: ['tag-unterwegs', 'Abgerechnet'],
}

const BERICHT_STATUS_MAP: Record<string, [string, string]> = {
  offen: ['tag-neu', 'Offen'],
  abgeschlossen: ['tag-geplant', 'Abgeschlossen'],
}

export function OrderStatusTag({ status }: { status: string }) {
  const [cls, label] = ORDER_STATUS_MAP[status] || ['tag-neu', status]
  return <span className={`tag ${cls}`}>{label}</span>
}

export function BerichtStatusTag({ status, abgerechnet }: { status: string; abgerechnet?: boolean }) {
  if (abgerechnet) return <span className="tag tag-unterwegs">Abgerechnet</span>
  const [cls, label] = BERICHT_STATUS_MAP[status] || ['tag-neu', status]
  return <span className={`tag ${cls}`}>{label}</span>
}

export function ArbeitStatusTag({ status }: { status: string }) {
  return status === 'abgeschlossen'
    ? <span className="tag tag-geplant">Abgeschlossen</span>
    : <span className="tag tag-neu">Offen</span>
}

export function AntragStatusTag({ status }: { status: string }) {
  if (status === 'genehmigt') return <span className="tag tag-geplant">Genehmigt</span>
  if (status === 'abgelehnt') return <span className="tag" style={{ background: '#F5DBD8', color: '#8A2E25' }}>Abgelehnt</span>
  if (status === 'storniert') return <span className="tag" style={{ background: '#E3E7EA', color: '#6B747D' }}>Storniert</span>
  return <span className="tag tag-arbeit">Beantragt</span>
}
