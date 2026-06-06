export default function InventarioLoading() {
  return (
    <div>
      <div className="page-header">
        <div>
          <div className="skeleton skeleton-title" style={{ width: 110 }} />
          <div className="skeleton skeleton-text-sm" style={{ width: 220, marginTop: 8 }} />
        </div>
        <div className="skeleton" style={{ height: 38, width: 150, borderRadius: 8 }} />
      </div>

      <div className="tabs" style={{ marginBottom: 24 }}>
        <div className="skeleton" style={{ height: 38, width: 120, borderRadius: 8 }} />
        <div className="skeleton" style={{ height: 38, width: 140, borderRadius: 8 }} />
      </div>

      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              {Array.from({ length: 6 }).map((_, i) => (
                <th key={i}><div className="skeleton skeleton-text-sm" style={{ width: 70 }} /></th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 8 }).map((_, i) => (
              <tr key={i}>
                {Array.from({ length: 6 }).map((_, j) => (
                  <td key={j}><div className="skeleton skeleton-text" style={{ width: j === 0 ? 140 : 80 }} /></td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
