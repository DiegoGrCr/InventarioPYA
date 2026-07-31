export default function RootLoading() {
  return (
    <>
      <div className="splash-progress" />
      <div className="splash">
        <div className="splash-logo-wrap">
          <span className="splash-ring" />
          <span className="splash-ring splash-ring-delay" />
          <img src="/logo1.png" alt="Pisos y Azulejos de Jalpan" className="splash-logo" />
        </div>
        <h1 className="splash-title">Pisos y Azulejos de Jalpan</h1>
        <p className="splash-subtitle">
          Cargando tu catálogo
          <span className="splash-dots"><span>.</span><span>.</span><span>.</span></span>
        </p>
      </div>
    </>
  )
}
