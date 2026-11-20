export default function Loading() {
  return (
    <div className="ns-loader" role="status" aria-live="polite" aria-label="Cargando NOVASTORE">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/brand/logo-ns-192.png"
        alt="NOVASTORE"
        width={84}
        height={84}
        className="ns-loader-logo"
      />
      <p className="ns-loader-text">Cargando NOVASTORE</p>
      <div className="ns-loader-bar" aria-hidden="true">
        <span />
      </div>
    </div>
  );
}
