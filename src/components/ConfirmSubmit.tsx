'use client';

import type { ReactNode } from 'react';

/**
 * Botón de envío que pide confirmación al usuario antes de ejecutar la acción.
 * Se usa en restaurar y eliminar copias de seguridad, donde un clic accidental
 * podría reemplazar o borrar datos.
 */
export default function ConfirmSubmit({
  message,
  className = 'btn btn-danger btn-xs',
  children,
}: {
  message: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <button
      type="submit"
      className={className}
      onClick={(event) => {
        if (!window.confirm(message)) {
          event.preventDefault();
        }
      }}
    >
      {children}
    </button>
  );
}
