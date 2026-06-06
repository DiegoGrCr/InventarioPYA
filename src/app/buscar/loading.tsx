export default function BuscarLoading() {
  return (
    <div>
      <div className="page-header">
        <div>
          <div className="skeleton skeleton-title" style={{ width: 240 }} />
          <div className="skeleton skeleton-text-sm" style={{ width: 120, marginTop: 8 }} />
        </div>
      </div>
      <div className="skeleton skeleton-title" style={{ width: 100, marginBottom: 16 }} />
      <div className="product-grid">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="skeleton-card">
            <div className="skeleton skeleton-image" />
            <div className="card-body">
              <div className="skeleton skeleton-title" />
              <div className="skeleton skeleton-text-sm" />
            </div>
            <div className="card-footer">
              <div className="skeleton skeleton-text" style={{ width: 80 }} />
              <div className="skeleton skeleton-text-sm" style={{ width: 70 }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
