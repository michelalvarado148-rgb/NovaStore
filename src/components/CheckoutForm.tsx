'use client';

import { useRef, useState } from 'react';
import { placeOrderAction } from '@/app/actions/checkout';
import {
  MAX_FIELD_VALUE,
  fieldKey,
  noticeMeta,
  type PublicProductNotice,
} from '@/lib/notice-meta';

/**
 * Formulario del checkout con la ventana de avisos y requisitos.
 *
 * El aviso se muestra al pulsar «Confirmar pedido», antes de enviar la compra,
 * tanto si el pago es con saldo como con un método externo. Si un dato es
 * obligatorio, el botón de confirmación queda bloqueado hasta completarlo y el
 * servidor vuelve a validarlo antes de crear el pedido.
 */
export default function CheckoutForm({
  notices,
  className,
  children,
}: {
  notices: PublicProductNotice[];
  className?: string;
  children: React.ReactNode;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const answersRef = useRef<HTMLInputElement>(null);
  const confirmed = useRef(false);
  const [open, setOpen] = useState(false);
  const [ack, setAck] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});

  const missing = notices.flatMap((notice) =>
    notice.fields.filter(
      (field) => field.required && !(values[fieldKey(notice.productId, field.label)] ?? '').trim(),
    ),
  );
  const canContinue = ack && missing.length === 0;

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    if (notices.length === 0 || confirmed.current) return;
    event.preventDefault();
    setAck(false);
    setOpen(true);
  }

  function confirm() {
    if (!canContinue) return;
    const payload = notices.map((notice) => ({
      productId: notice.productId,
      values: notice.fields.map((field) => ({
        label: field.label,
        value: (values[fieldKey(notice.productId, field.label)] ?? '')
          .trim()
          .slice(0, MAX_FIELD_VALUE),
      })),
    }));
    if (answersRef.current) answersRef.current.value = JSON.stringify(payload);
    confirmed.current = true;
    setOpen(false);
    formRef.current?.requestSubmit();
  }

  return (
    <form ref={formRef} action={placeOrderAction} onSubmit={handleSubmit} className={className}>
      {children}
      <input ref={answersRef} type="hidden" name="notice_answers" defaultValue="" />

      {open ? (
        <div
          className="fixed inset-0 z-[90] flex items-end justify-center bg-black/80 p-3 backdrop-blur-sm sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="aviso-pedido-titulo"
        >
          <div className="max-h-[88vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-purple-500/40 bg-[#0b0710] p-5 shadow-[0_0_60px_-15px_rgba(168,85,247,0.65)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[0.68rem] font-bold uppercase tracking-[0.16em] text-fuchsia-300">
                  Antes de confirmar
                </p>
                <h2 id="aviso-pedido-titulo" className="text-lg font-black text-white">
                  Avisos y requisitos del pedido
                </h2>
              </div>
              <button
                type="button"
                className="btn btn-ghost btn-xs"
                onClick={() => setOpen(false)}
                aria-label="Cerrar avisos"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 space-y-3">
              {notices.map((notice) => {
                const meta = noticeMeta(notice.type);
                return (
                  <div
                    key={notice.productId}
                    className="rounded-xl border border-purple-500/25 bg-gradient-to-br from-purple-500/10 to-fuchsia-500/5 p-4"
                  >
                    <div className="flex items-start gap-3">
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-fuchsia-500/20 text-xl">
                        {meta.icon}
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-white">{notice.productName}</p>
                        <p className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-purple-300">
                          {meta.label}
                        </p>
                      </div>
                    </div>
                    <p className="mt-3 whitespace-pre-line text-[0.82rem] leading-relaxed text-slate-200">
                      {notice.message}
                    </p>
                    {notice.deliveryTime ? (
                      <p className="mt-2 inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-2.5 py-1 text-[0.7rem] font-semibold text-amber-200">
                        ⏱ Tiempo estimado: {notice.deliveryTime}
                      </p>
                    ) : null}

                    {notice.fields.length > 0 ? (
                      <div className="mt-3 space-y-2">
                        {notice.fields.map((field) => {
                          const key = fieldKey(notice.productId, field.label);
                          return (
                            <label key={key} className="block">
                              <span className="mb-1 block text-[0.72rem] font-semibold text-slate-300">
                                {field.label}
                                {field.required ? (
                                  <span className="ml-1 text-fuchsia-300">*</span>
                                ) : (
                                  <span className="ml-1 text-slate-500">(opcional)</span>
                                )}
                              </span>
                              <input
                                value={values[key] ?? ''}
                                maxLength={MAX_FIELD_VALUE}
                                onChange={(event) =>
                                  setValues((current) => ({
                                    ...current,
                                    [key]: event.target.value,
                                  }))
                                }
                                className="input"
                                placeholder={`Escribe tu ${field.label.toLowerCase()}`}
                                aria-required={field.required}
                              />
                            </label>
                          );
                        })}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>

            <label className="mt-4 flex items-start gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-[0.78rem] text-slate-300">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={ack}
                onChange={(event) => setAck(event.target.checked)}
              />
              He leído el aviso y confirmo que los datos ingresados son correctos.
            </label>

            {missing.length > 0 ? (
              <p className="mt-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[0.72rem] font-semibold text-amber-200">
                Completa los datos obligatorios para continuar.
              </p>
            ) : null}

            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                className="btn btn-primary flex-1"
                onClick={confirm}
                disabled={!canContinue}
              >
                Confirmar pedido
              </button>
              <button
                type="button"
                className="btn btn-ghost sm:w-auto"
                onClick={() => setOpen(false)}
              >
                Volver al carrito
              </button>
            </div>
            <p className="mt-2 text-center text-[0.68rem] text-slate-500">
              Tus datos se guardan con el pedido y solo los verá el administrador de la tienda.
            </p>
          </div>
        </div>
      ) : null}
    </form>
  );
}
