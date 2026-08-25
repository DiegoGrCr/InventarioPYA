export default function SimpleListSkeleton() {
  return (
    <div>
      <div className="page-header">
        <div>
          <div className="skeleton skeleton-title" style={{ width: 100 }} />
          <div className="skeleton skeleton-text-sm" style={{ width: 220, marginTop: 8 }} />
        </div>
      </div>

      <div className="skeleton-card">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="skeleton skeleton-row" />
        ))}
      </div>
    </div>
  )
}
