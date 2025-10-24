import StatusBadge from '../StatusBadge'

export default function StatusBadgeExample() {
  return (
    <div className="p-6 flex flex-wrap gap-3">
      <StatusBadge status="draft" />
      <StatusBadge status="open" />
      <StatusBadge status="closed" />
      <StatusBadge status="processing" />
    </div>
  )
}
