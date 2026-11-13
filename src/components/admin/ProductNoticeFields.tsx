'use client';

import { useState } from 'react';
import {
  MAX_FIELD_LABEL,
  MAX_NOTICE_FIELDS,
  MAX_NOTICE_MESSAGE,
  NOTICE_TYPES,
  defaultNoticeMessage,
  noticeMeta,
  type NoticeField,
  type NoticeType,
} from '@/lib/notice-meta';

type Props = {
  initial?: {
    enabled: boolean;
    type: NoticeType;
    message: string;
    deliveryTime: string;
    fields: NoticeField[];
  } | null;
};

/**
 * Sección «Avisos y requisitos del producto» del formulario de producto.
 *
 * Envía todos los valores dentro del mismo formulario del producto, así que el
 * administrador puede crear o editar el aviso sin salir de la pantalla y sin
 * eliminar el producto.
 */
export default function ProductNoticeFields({ initial }: Props) {
  const [enabled, setEnabled] = useState(initial?.enabled ?? false);
  const [type, setType] = useState<NoticeType>(initial?.type ?? 'inmediata');
  const [message, setMessage] = useState(initial?.message ?? '');
  const [deliveryTime, setDeliveryTime] = useState(initial?.deliveryTime ?? '');
  const [fields, setFields] = useState<NoticeField[]>(
    initial?.fields?.length ? initial.fields : [],
  );

  const meta = noticeMeta(type);
  const previewMessage = message.trim() || defaultNoticeMessage(type, deliveryTime);
  const requiresFields = type === 'datos' || fields.length > 0;

  function updateField(index: number, patch: Partial<NoticeField>) {
    setFields((current) =>
      current.map((field, position) => (position === index ? { ...field, ...patch } : field)),
    );
  }

  return (
    <section className="rounded-xl border border-purple-500/25 bg-purple-500/[0.04] p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-purple-300">
            Avisos y requisitos del producto
          </p>
          <p className="mt-1 text-[0.72rem] text-slate-400">
            Se mostrará una ventana emergente al cliente antes de confirmar la compra.
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm font-semibold text-slate-200">
          <input
            type="checkbox"
            name="notice_enabled"
            checked={enabled}
            onChange={(event) => setEnabled(event.target.checked)}
          />
          Activar aviso
        </label>
      </div>

      <div className={enabled ? 'mt-4 space-y-3' : 'mt-4 space-y-3 opacity-60'}>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="field">
            <span>Tipo de aviso</span>
            <select
              name="notice_type"
              value={type}
              onChange={(event) => {
                const next = event.target.value as NoticeType;
                setType(next);
                if (!message.trim()) setDeliveryTime((current) => current);
              }}
            >
              {NOTICE_TYPES.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.icon} {item.label}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Tiempo aproximado de entrega</span>
            <input
              name="notice_delivery"
              value={deliveryTime}
              maxLength={80}
              onChange={(event) => setDeliveryTime(event.target.value)}
              placeholder="Ej. 5 a 30 minutos"
            />
          </label>
        </div>

        <p className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-[0.72rem] text-slate-400">
          {meta.icon} {meta.hint}
        </p>

        <label className="field">
          <span>Mensaje para el cliente</span>
          <textarea
            name="notice_message"
            rows={3}
            maxLength={MAX_NOTICE_MESSAGE}
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder={defaultNoticeMessage(type, deliveryTime)}
          />
        </label>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="btn btn-ghost btn-xs"
            onClick={() => setMessage(defaultNoticeMessage(type, deliveryTime))}
          >
            Usar mensaje sugerido
          </button>
          <span className="text-[0.7rem] text-slate-500">
            {message.trim().length}/{MAX_NOTICE_MESSAGE} caracteres
          </span>
        </div>

        <div className="rounded-xl border border-white/10 bg-black/25 p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[0.72rem] font-bold uppercase tracking-[0.12em] text-purple-200">
              Datos que debe ingresar el cliente
            </p>
            <button
              type="button"
              className="btn btn-outline btn-xs"
              disabled={fields.length >= MAX_NOTICE_FIELDS}
              onClick={() => setFields((current) => [...current, { label: '', required: true }])}
            >
              + Añadir dato
            </button>
          </div>

          {fields.length === 0 ? (
            <p className="mt-2 text-[0.72rem] text-slate-500">
              Sin datos adicionales. Añade por ejemplo «ID de Free Fire» o «Nombre de usuario».
            </p>
          ) : (
            <div className="mt-2 space-y-2">
              {fields.map((field, index) => (
                <div key={index} className="grid gap-2 sm:grid-cols-[1.6fr_1fr_auto]">
                  <input
                    name="notice_field_label"
                    value={field.label}
                    maxLength={MAX_FIELD_LABEL}
                    onChange={(event) => updateField(index, { label: event.target.value })}
                    placeholder="ID de Free Fire"
                  />
                  <select
                    name="notice_field_required"
                    value={field.required ? '1' : '0'}
                    onChange={(event) =>
                      updateField(index, { required: event.target.value === '1' })
                    }
                  >
                    <option value="1">Obligatorio</option>
                    <option value="0">Opcional</option>
                  </select>
                  <button
                    type="button"
                    className="btn btn-ghost btn-xs"
                    onClick={() =>
                      setFields((current) => current.filter((_, position) => position !== index))
                    }
                    aria-label={`Quitar dato ${index + 1}`}
                  >
                    Quitar
                  </button>
                </div>
              ))}
            </div>
          )}
          <p className="mt-2 text-[0.68rem] text-slate-500">
            Máximo {MAX_NOTICE_FIELDS} datos por producto. Si un dato es obligatorio, el cliente no
            podrá confirmar la compra sin escribirlo.
          </p>
        </div>

        <div className="rounded-xl border border-fuchsia-500/30 bg-gradient-to-br from-fuchsia-500/10 to-purple-500/5 p-3">
          <p className="text-[0.68rem] font-bold uppercase tracking-[0.12em] text-fuchsia-200">
            Vista previa del aviso
          </p>
          <div className="mt-2 flex items-start gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-fuchsia-500/20 text-lg">
              {meta.icon}
            </span>
            <div className="min-w-0">
              <p className="text-sm font-bold text-white">
                {meta.label} · {enabled ? 'Activo' : 'Desactivado'}
              </p>
              <p className="mt-1 text-[0.78rem] leading-relaxed text-slate-300">{previewMessage}</p>
              {deliveryTime.trim() ? (
                <p className="mt-1 text-[0.72rem] text-purple-200">
                  Tiempo estimado: {deliveryTime.trim()}
                </p>
              ) : null}
              {requiresFields && fields.length > 0 ? (
                <p className="mt-1 text-[0.72rem] text-slate-400">
                  Datos solicitados:{' '}
                  {fields
                    .filter((field) => field.label.trim())
                    .map((field) => `${field.label}${field.required ? ' (obligatorio)' : ''}`)
                    .join(', ') || '—'}
                </p>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
