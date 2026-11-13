'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** Refresca la conversación para ver los mensajes nuevos sin recargar la página. */
export default function AutoRefresh({ intervalMs = 10000 }: { intervalMs?: number }) {
  const router = useRouter();

  useEffect(() => {
    const id = setInterval(() => router.refresh(), intervalMs);
    return () => clearInterval(id);
  }, [router, intervalMs]);

  return null;
}
