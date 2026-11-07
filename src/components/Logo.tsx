export default function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <span className="relative grid h-10 w-10 place-items-center overflow-hidden rounded-xl bg-gradient-to-br from-violet-500 via-purple-500 to-fuchsia-500 shadow-[0_10px_30px_-12px_rgba(168,85,247,0.9)]">
        <svg viewBox="0 0 32 32" className="h-6 w-6" aria-hidden="true">
          <path
            d="M7 25V7l9 11V7h9v18h-9V14l-9 11Z"
            fill="rgba(6,5,11,0.92)"
            stroke="rgba(255,255,255,0.65)"
            strokeWidth="0.8"
          />
        </svg>
        <span className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.45),transparent_60%)]" />
      </span>
      {!compact && (
        <span className="flex flex-col leading-none">
          <span className="text-lg font-black tracking-[0.18em] text-white">NOVASTORE</span>
          <span className="text-[0.62rem] font-semibold uppercase tracking-[0.28em] text-purple-300/80">
            Digital Shop
          </span>
        </span>
      )}
    </span>
  );
}
