export default function CalculadoraLoading() {
  return (
    <div>
      <div className="page-header">
        <div>
          <div className="skeleton skeleton-title" style={{ width: 180 }} />
          <div className="skeleton skeleton-text-sm" style={{ width: 280, marginTop: 8 }} />
        </div>
      </div>

      <div className="calc-card">
        <div className="skeleton skeleton-title" style={{ width: 160, marginBottom: 20 }} />
        <div className="skeleton" style={{ height: 44, borderRadius: 8, marginBottom: 16 }} />

        <div className="skeleton skeleton-title" style={{ width: 130, marginBottom: 12 }} />
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <div className="skeleton" style={{ height: 38, flex: 1, borderRadius: 8 }} />
          <div className="skeleton" style={{ height: 38, flex: 1, borderRadius: 8 }} />
        </div>

        <div className="skeleton skeleton-title" style={{ width: 150, marginBottom: 12 }} />
        <div className="skeleton" style={{ height: 44, borderRadius: 8, marginBottom: 16 }} />

        <div style={{ display: 'flex', gap: 8 }}>
          <div className="skeleton" style={{ height: 38, flex: 1, borderRadius: 8 }} />
          <div className="skeleton" style={{ height: 38, flex: 1, borderRadius: 8 }} />
        </div>
      </div>
    </div>
  )
}
