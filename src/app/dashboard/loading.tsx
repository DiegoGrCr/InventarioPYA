export default function DashboardLoading() {
  return (
    <div>
      <div className="page-header">
        <div>
          <div className="skeleton skeleton-title" style={{ width: 110 }} />
          <div className="skeleton skeleton-text-sm" style={{ width: 220, marginTop: 8 }} />
        </div>
        <div className="skeleton" style={{ height: 38, width: 140, borderRadius: 8 }} />
      </div>

      <div className="stats-grid">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="skeleton-stat">
            <div className="skeleton skeleton-icon" />
            <div style={{ flex: 1 }}>
              <div className="skeleton skeleton-title" style={{ width: 50, marginBottom: 6 }} />
              <div className="skeleton skeleton-text-sm" style={{ width: 90 }} />
            </div>
          </div>
        ))}
      </div>

      <div className="skeleton skeleton-title" style={{ width: 170, height: 20, margin: '24px 0 16px' }} />

      <div className="product-grid">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="skeleton-card">
            <div className="skeleton skeleton-image" />
            <div className="card-body">
              <div className="skeleton skeleton-title" />
              <div className="skeleton skeleton-badge" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
