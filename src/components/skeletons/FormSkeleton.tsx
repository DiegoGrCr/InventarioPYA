export default function FormSkeleton() {
  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div className="skeleton" style={{ width: 38, height: 38, borderRadius: 8 }} />
          <div>
            <div className="skeleton skeleton-title" style={{ width: 160, height: 20 }} />
            <div className="skeleton skeleton-text-sm" style={{ width: 200, marginTop: 8 }} />
          </div>
        </div>
      </div>

      <div className="form-card">
        <div className="skeleton" style={{ height: 140, width: '100%', borderRadius: 8, marginBottom: 24 }} />

        <div className="form-row">
          <div className="skeleton" style={{ height: 42, borderRadius: 8 }} />
          <div className="skeleton" style={{ height: 42, borderRadius: 8 }} />
        </div>
        <div className="form-row" style={{ marginTop: 16 }}>
          <div className="skeleton" style={{ height: 42, borderRadius: 8 }} />
          <div className="skeleton" style={{ height: 42, borderRadius: 8 }} />
        </div>
        <div className="form-row-3" style={{ marginTop: 16 }}>
          <div className="skeleton" style={{ height: 42, borderRadius: 8 }} />
          <div className="skeleton" style={{ height: 42, borderRadius: 8 }} />
          <div className="skeleton" style={{ height: 42, borderRadius: 8 }} />
        </div>
        <div className="skeleton" style={{ height: 80, width: '100%', borderRadius: 8, marginTop: 16 }} />
        <div className="skeleton" style={{ height: 42, width: 160, borderRadius: 8, marginTop: 24 }} />
      </div>
    </div>
  )
}
