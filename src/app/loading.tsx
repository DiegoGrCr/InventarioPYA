export default function DashboardLoading() {
  return (
    <div>
      <div className="page-header">
        <div>
          <div className="skeleton skeleton-title" style={{ width: 120 }} />
          <div className="skeleton skeleton-text-sm" style={{ width: 200, marginTop: 8 }} />
        </div>
      </div>

      <div className="stats-grid" style={{ marginBottom: 32 }}>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="skeleton-stat">
            <div className="skeleton skeleton-icon" />
            <div style={{ flex: 1 }}>
              <div className="skeleton skeleton-title" style={{ width: 48, marginBottom: 8 }} />
              <div className="skeleton skeleton-text-sm" style={{ width: 100 }} />
            </div>
          </div>
        ))}
      </div>

      <div className="skeleton skeleton-title" style={{ width: 180, marginBottom: 16 }} />
      <div className="product-grid">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="skeleton-card">
            <div className="skeleton skeleton-image" />
            <div className="card-body">
              <div className="skeleton skeleton-title" />
              <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                <div className="skeleton skeleton-badge" />
                <div className="skeleton skeleton-badge" />
              </div>
              <div className="skeleton skeleton-text-sm" />
            </div>
            <div className="card-footer">
              <div className="skeleton skeleton-text" style={{ width: 70 }} />
              <div className="skeleton skeleton-text-sm" style={{ width: 80 }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
