export default function PisosLoading() {
  return (
    <div>
      <div className="page-header">
        <div>
          <div className="skeleton skeleton-title" style={{ width: 80 }} />
          <div className="skeleton skeleton-text-sm" style={{ width: 160, marginTop: 8 }} />
        </div>
      </div>

      <div className="filters-bar" style={{ marginBottom: 24 }}>
        <div className="skeleton" style={{ height: 38, width: 200, borderRadius: 8 }} />
        <div className="skeleton" style={{ height: 38, width: 130, borderRadius: 8 }} />
        <div className="skeleton" style={{ height: 38, width: 130, borderRadius: 8 }} />
        <div className="skeleton" style={{ height: 38, width: 110, borderRadius: 8 }} />
      </div>

      <div className="product-grid">
        {Array.from({ length: 8 }).map((_, i) => (
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
              <div className="skeleton skeleton-text" style={{ width: 80 }} />
              <div className="skeleton skeleton-text-sm" style={{ width: 90 }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
