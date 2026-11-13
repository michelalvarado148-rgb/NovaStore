import { getOrderNoticeAnswers } from '@/lib/product-notice';
import { noticeMeta } from '@/lib/notice-meta';

/**
 * Muestra al administrador (y al cliente) los avisos que aceptó y los datos que
 * ingresó al confirmar el pedido. No renderiza nada si el pedido no tiene avisos.
 */
export default function OrderNoticeAnswers({ orderNumber }: { orderNumber: string }) {
  const answers = getOrderNoticeAnswers(orderNumber);
  if (answers.length === 0) return null;

  return (
    <section className="panel p-5">
      <p className="text-sm font-bold text-white">Avisos y datos del pedido</p>
      <p className="mt-1 text-xs text-slate-400">
        Avisos aceptados y datos ingresados por el cliente al confirmar la compra.
      </p>
      <div className="mt-3 space-y-3">
        {answers.map((answer, index) => {
          const meta = noticeMeta(answer.type);
          return (
            <div
              key={`${answer.productId}-${index}`}
              className="rounded-xl border border-purple-500/25 bg-purple-500/[0.06] p-3"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span aria-hidden>{meta.icon}</span>
                <p className="text-sm font-semibold text-white">{answer.productName}</p>
                <span className="rounded-full border border-white/15 px-2 py-0.5 text-[0.65rem] font-semibold text-slate-300">
                  {meta.label}
                </span>
              </div>
              <p className="mt-2 whitespace-pre-line text-[0.78rem] leading-relaxed text-slate-300">
                {answer.message}
              </p>
              {answer.deliveryTime ? (
                <p className="mt-1 text-[0.72rem] font-semibold text-amber-200">
                  ⏱ Tiempo estimado: {answer.deliveryTime}
                </p>
              ) : null}
              {answer.values.length > 0 ? (
                <dl className="mt-2 space-y-1 rounded-lg border border-white/10 bg-black/30 p-2">
                  {answer.values.map((value) => (
                    <div key={value.label} className="flex flex-wrap gap-x-2 text-[0.78rem]">
                      <dt className="text-slate-400">{value.label}:</dt>
                      <dd className="font-semibold text-white">{value.value || '—'}</dd>
                    </div>
                  ))}
                </dl>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}
