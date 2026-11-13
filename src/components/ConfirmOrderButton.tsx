'use client';

import { useEffect, useState } from 'react';

/**
 * Botón «Confirmar pedido» del checkout.
 *
 * Permanece deshabilitado hasta que el formulario está montado en el cliente:
 * así un clic inmediato tras cargar la página no se pierde (antes el envío
 * quedaba anulado por el navegador sin abrir la ventana de avisos).
 */
export default function ConfirmOrderButton({ disabled = false }: { disabled?: boolean }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <button type="submit" className="btn btn-primary mt-5 w-full" disabled={!mounted || disabled}>
      Confirmar pedido
    </button>
  );
}
