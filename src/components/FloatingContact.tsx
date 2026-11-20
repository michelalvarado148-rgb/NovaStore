'use client';

import { usePathname } from 'next/navigation';

export default function FloatingContact({ whatsappUrl }: { whatsappUrl?: string }) {
  const pathname = usePathname() || '/';

  // El panel administrativo es privado: sin botones flotantes públicos.
  if (pathname.startsWith('/admin')) return null;
  if (!whatsappUrl) return null;

  return (
    <div
      className="fixed right-3 z-40 flex flex-col gap-2.5 bottom-[calc(6.4rem+env(safe-area-inset-bottom))] sm:bottom-24 sm:right-5"
      aria-label="Contacto rápido"
    >
      {whatsappUrl ? (
        <a
          href={whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Escribir por WhatsApp"
          className="fab bg-gradient-to-br from-emerald-500 to-green-600 hover:shadow-[0_18px_36px_-14px_rgba(16,185,129,0.9)]"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
            <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.9 9.9 0 0 0 4.79 1.22h.01c5.46 0 9.91-4.45 9.91-9.91S17.5 2 12.04 2Zm5.8 14.06c-.25.7-1.45 1.34-2 1.39-.55.05-1.06.24-3.57-.79-3.02-1.24-4.92-4.36-5.07-4.56-.15-.2-1.21-1.62-1.21-3.09 0-1.47.77-2.19 1.04-2.49.27-.3.59-.37.79-.37.2 0 .4.01.57.02.18.01.43-.07.67.51.25.6.85 2.07.92 2.22.07.15.12.32.02.52-.1.2-.2.32-.35.5-.15.17-.31.31-.45.5-.15.2-.31.42-.13.72.18.3.8 1.32 1.72 2.14 1.18 1.05 2.17 1.38 2.47 1.53.3.15.48.13.65-.08.18-.2.75-.87.95-1.17.2-.3.4-.25.67-.15.27.1 1.72.81 2.02.96.3.15.5.22.57.35.07.12.07.72-.18 1.42Z" />
          </svg>
        </a>
      ) : null}
    </div>
  );
}
