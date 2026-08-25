export default function DetailSkeleton() {
  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div className="skeleton" style={{ width: 38, height: 38, borderRadius: 8 }} />
          <div>
            <div className="skeleton skeleton-title" style={{ width: 180, height: 20 }} />
            <div className="skeleton skeleton-text-sm" style={{ width: 100, marginTop: 8 }} />
          </div>
        </div>
      </div>

      <div className="detail-grid">
        <div className="skeleton detail-image" />

        <div>
          <div className="card" style={{ marginBottom: '16px' }}>
            <div className="card-body">
              <div className="skeleton skeleton-title" style={{ width: 120 }} />
              <div style={{ display: 'grid', gap: '14px', marginTop: '8px' }}>
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <div className="skeleton skeleton-text-sm" style={{ width: 70 }} />
                    <div className="skeleton skeleton-text-sm" style={{ width: 90 }} />
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-body">
              <div className="skeleton skeleton-title" style={{ width: 150 }} />
              <div className="skeleton" style={{ height: 30, width: 140, marginBottom: 16 }} />
              <div className="skeleton" style={{ height: 38, width: '100%', borderRadius: 8 }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
