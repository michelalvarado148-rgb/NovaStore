'use client';

import { useState } from 'react';

/** Botón «Copiar» para un dato de entrega. Funciona en móvil y escritorio. */
export default function CopyValue({ value, label }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
      } else {
        const area = document.createElement('textarea');
        area.value = value;
        area.setAttribute('readonly', '');
        area.style.position = 'fixed';
        area.style.opacity = '0';
        document.body.appendChild(area);
        area.select();
        document.execCommand('copy');
        area.remove();
      }
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      className="btn btn-outline btn-xs shrink-0"
      aria-label={`Copiar ${label ?? 'dato'}`}
    >
      {copied ? '✓ Copiado' : 'Copiar'}
    </button>
  );
}
