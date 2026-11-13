import Link from 'next/link';
import Logo from '@/components/Logo';
import {
  formatReturnAt,
  getMaintenanceConfig,
  maintenanceMessage,
} from '@/lib/maintenance';

/**
 * Pantalla que ven los clientes mientras la tienda está en mantenimiento.
 * Se renderiza desde el servidor, así que no depende de JavaScript en el
 * dispositivo y mantiene el estilo negro/morado de NOVASTORE.
 */
export default function MaintenanceScreen({ preview = false }: { preview?: boolean }) {
  const config = getMaintenanceConfig();
  const message = maintenanceMessage(config);
  const returnAt = formatReturnAt(config.return_at);

  return (
    <section className="relative overflow-hidden">
      <div className="grid-lines pointer-events-none absolute inset-0 opacity-60" />
      <div className="hero-glow left-[-6rem] top-[-4rem] h-72 w-72 bg-purple-600/40 animate-glow" />
      <div className="hero-glow right-[-5rem] top-16 h-64 w-64 bg-fuchsia-500/25 animate-floaty" />

      <div className="shell relative flex min-h-[78vh] flex-col items-center justify-center py-14 text-center">
        <div className="animate-fade-up">
          <Logo />
        </div>

        <div className="relative mt-9 animate-fade-up delay-1">
          <span className="absolute inset-0 rounded-full bg-purple-500/25 blur-2xl" />
          <span className="relative grid h-24 w-24 place-items-center rounded-full border border-purple-400/30 bg-[#120b22]/90 shadow-[0_18px_60px_-20px_rgba(168,85,247,0.9)]">
            <svg
              viewBox="0 0 24 24"
              className="h-11 w-11 animate-[spin_9s_linear_infinite] text-purple-300"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              aria-hidden="true"
            >
              <path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" />
              <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1.03 1.56V21a2 2 0 1 1-4 0v-.11a1.7 1.7 0 0 0-1.11-1.56 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.56-1.03H3a2 2 0 1 1 0-4h.11A1.7 1.7 0 0 0 4.6 8.94a1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1.03-1.56V3a2 2 0 1 1 4 0v.11A1.7 1.7 0 0 0 15 4.6a1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.4 9v.11A1.7 1.7 0 0 0 20.96 10H21a2 2 0 1 1 0 4h-.11a1.7 1.7 0 0 0-1.49 1Z" />
            </svg>
          </span>
        </div>

        <span className="badge badge-purple mt-7 animate-fade-up delay-2">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-fuchsia-400" /> Mantenimiento
          programado
        </span>

        <h1 className="mt-4 max-w-3xl text-3xl font-black leading-tight tracking-tight text-white sm:text-4xl lg:text-5xl animate-fade-up delay-2">
          <span className="gradient-text">Estamos mejorando NOVASTORE</span>
        </h1>

        <p className="mt-4 max-w-2xl text-[0.98rem] leading-relaxed text-slate-300 animate-fade-up delay-3">
          {message}
        </p>

        {config.image_url ? (
          <div className="mt-8 w-full max-w-xs animate-fade-up delay-3">
            <div className="panel overflow-hidden p-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={config.image_url}
                alt="Imagen de mantenimiento de NOVASTORE"
                className="mx-auto max-h-40 w-auto rounded-xl object-contain"
              />
            </div>
          </div>
        ) : null}

        {returnAt ? (
          <div className="mt-7 w-full max-w-md animate-fade-up delay-4">
            <div className="panel-flat px-5 py-4">
              <p className="text-[0.65rem] font-bold uppercase tracking-[0.18em] text-purple-300">
                Regreso estimado
              </p>
              <p className="mt-1 text-base font-black text-white">{returnAt}</p>
            </div>
          </div>
        ) : null}

        <p className="mt-8 text-xs text-slate-500">
          {preview
            ? 'Vista previa de la pantalla de mantenimiento. Los clientes la ven solo cuando el modo está activo.'
            : 'Gracias por tu paciencia. Estamos trabajando para volver con una mejor tienda.'}
        </p>

        <Link href="/login" className="btn btn-outline btn-sm mt-6">
          Acceso administrador
        </Link>
      </div>
    </section>
  );
}
