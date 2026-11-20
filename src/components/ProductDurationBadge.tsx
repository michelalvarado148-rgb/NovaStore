type Props = {
  /** Etiqueta ya normalizada: «1 MES», «3 MESES», «7 DÍAS». */
  label: string;
  size?: 'sm' | 'md';
  className?: string;
};

/**
 * Indicador de duración del producto (solo productos de Streaming que tengan
 * duración configurada). Si no hay etiqueta no se muestra nada.
 */
export default function ProductDurationBadge({ label, size = 'sm', className = '' }: Props) {
  if (!label) return null;

  return (
    <span
      className={`ns-duration ${size === 'md' ? 'ns-duration-md' : ''} ${className}`.trim()}
      title={`Duración del servicio: ${label}`}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7.4V12l3 2.1" />
      </svg>
      <span className="ns-duration-text">{label}</span>
    </span>
  );
}
