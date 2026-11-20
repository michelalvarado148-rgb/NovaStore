'use client';

import { useState } from 'react';
import { saveOrderDeliveryAction } from '@/app/actions/admin';
import { DELIVERY_KINDS, type DeliveryKind } from '@/lib/delivery-kinds';

type Row = { label: string; value: string; kind: DeliveryKind };

const EMPTY: Row = { label: '', value: '', kind: 'texto' };

/**
 * Datos de entrega del pedido: el administrador escribe lo que recibe el cliente
 * (correo, contraseña, perfil, PIN, vencimiento) e instrucciones de uso.
 */
export default function OrderDeliveryForm({
  orderId,
  initialFields,
  initialInstructions,
  delivered,
}: {
  orderId: number;
  initialFields: Row[];
  initialInstructions: string;
  delivered: boolean;
}) {
  const [rows, setRows] = useState<Row[]>(
    initialFields.length > 0 ? initialFields : [{ ...EMPTY }],
  );

  function update(index: number, patch: Partial<Row>) {
    setRows((current) => current.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function addRow() {
    setRows((current) => (current.length >= 20 ? current : [...current, { ...EMPTY }]));
  }

  function removeRow(index: number) {
    setRows((current) => (current.length <= 1 ? [{ ...EMPTY }] : current.filter((_, i) => i !== index)));
  }

  return (
    <form action={saveOrderDeliveryAction} className="space-y-3">
      <input type="hidden" name="order_id" value={orderId} />

      <div className="space-y-2">
        {rows.map((row, index) => (
          <div
            key={index}
            className="grid gap-2 rounded-xl border border-purple-500/20 bg-black/30 p-2.5 sm:grid-cols-[1fr_1fr_auto]"
          >
            <input
              name="delivery_label"
              value={row.label}
              onChange={(event) => update(index, { label: event.target.value })}
              placeholder="Nombre del dato (ej. Correo)"
              className="input input-sm"
              maxLength={60}
            />
            <input
              name="delivery_value"
              value={row.value}
              onChange={(event) => update(index, { value: event.target.value })}
              placeholder="Valor que recibe el cliente"
              className="input input-sm font-mono text-xs"
              maxLength={800}
            />
            <div className="flex gap-2">
              <select
                name="delivery_kind"
                value={row.kind}
                onChange={(event) => update(index, { kind: event.target.value as DeliveryKind })}
                className="input input-sm"
                aria-label="Tipo de dato"
              >
                {DELIVERY_KINDS.map((kind) => (
                  <option key={kind.value} value={kind.value}>
                    {kind.icon} {kind.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => removeRow(index)}
                className="btn btn-ghost btn-xs"
                aria-label="Quitar dato"
              >
                ✕
              </button>
            </div>
          </div>
        ))}
      </div>

      <button type="button" onClick={addRow} className="btn btn-outline btn-sm">
        + Agregar otro dato
      </button>

      <label className="block text-xs font-semibold text-slate-300">
        Instrucciones de uso (opcional)
        <textarea
          name="instructions"
          defaultValue={initialInstructions}
          rows={3}
          maxLength={4000}
          placeholder="Ej. Ingresa al correo y cambia la contraseña al primer inicio de sesión."
          className="input mt-1 text-xs"
        />
      </label>

      <label className="flex items-center gap-2 text-xs text-slate-300">
        <input
          type="checkbox"
          name="mark_delivered"
          defaultChecked={!delivered}
          className="h-4 w-4 accent-purple-500"
        />
        Marcar el pedido como entregado (el cliente podrá ver estos datos)
      </label>

      <button type="submit" className="btn btn-primary btn-sm">
        Guardar datos de entrega
      </button>
    </form>
  );
}
