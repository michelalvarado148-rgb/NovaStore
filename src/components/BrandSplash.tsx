'use client';

import { useEffect, useState } from 'react';

const SEEN_KEY = 'nova:splash:v1';
const HOLD_MS = 1250;
const FADE_MS = 500;

/**
 * Pantalla de inicio de NOVASTORE.
 *
 * Muestra el logo oficial al abrir la aplicación y desaparece con una
 * transición suave. Solo aparece una vez por sesión de navegación, para no
 * interrumpir la navegación interna de la tienda.
 */
export default function BrandSplash() {
  const [phase, setPhase] = useState<'idle' | 'visible' | 'out'>('idle');

  useEffect(() => {
    let alreadySeen = false;
    try {
      alreadySeen = window.sessionStorage.getItem(SEEN_KEY) === '1';
    } catch {
      alreadySeen = false;
    }
    if (alreadySeen) return;

    setPhase('visible');
    const hideTimer = window.setTimeout(() => setPhase('out'), HOLD_MS);
    const doneTimer = window.setTimeout(() => {
      setPhase('idle');
      try {
        window.sessionStorage.setItem(SEEN_KEY, '1');
      } catch {
        /* almacenamiento no disponible: se volverá a mostrar la próxima vez */
      }
    }, HOLD_MS + FADE_MS);

    return () => {
      window.clearTimeout(hideTimer);
      window.clearTimeout(doneTimer);
    };
  }, []);

  if (phase === 'idle') return null;

  return (
    <div
      className={`ns-splash${phase === 'out' ? ' is-out' : ''}`}
      role="status"
      aria-live="polite"
      aria-label="Cargando NOVASTORE"
    >
      <div className="ns-splash-glow" aria-hidden="true" />
      <div className="ns-splash-card">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/brand/logo-ns-256.png"
          alt="NOVASTORE"
          width={134}
          height={134}
          className="ns-splash-logo"
        />
        <p className="ns-splash-name">
          NOVA<span>STORE</span>
        </p>
        <p className="ns-splash-tag">Productos digitales al instante</p>
        <div className="ns-splash-bar" aria-hidden="true">
          <span />
        </div>
      </div>
    </div>
  );
}
