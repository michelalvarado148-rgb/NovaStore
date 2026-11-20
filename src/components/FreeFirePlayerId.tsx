import { getOrderNoticeAnswers } from '@/lib/product-notice';
import { FREE_FIRE_FIELD_LABEL } from '@/lib/freefire';

/**
 * Bloque destacado con el ID de Free Fire que el cliente ingresó al comprar.
 * Solo se muestra en pedidos que incluyen productos de Free Fire.
 */
export default function FreeFirePlayerId({ orderNumber }: { orderNumber: string }) {
  const entries = getOrderNoticeAnswers(orderNumber).flatMap((answer) =>
    answer.values
      .filter((value) => value.label === FREE_FIRE_FIELD_LABEL && value.value.trim())
      .map((value) => ({ productName: answer.productName, playerId: value.value.trim() })),
  );

  if (entries.length === 0) return null;

  return (
    <section className="panel border-fuchsia-500/40 p-5">
      <div className="flex items-center gap-3">
        <span
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-fuchsia-500/20 text-lg"
          aria-hidden
        >
          🔥
        </span>
        <div>
          <p className="text-sm font-bold text-white">ID de Free Fire del cliente</p>
          <p className="text-xs text-slate-400">
            Usa este ID para entregar el producto en la cuenta correcta.
          </p>
        </div>
      </div>
      <ul className="mt-3 space-y-2">
        {entries.map((entry, index) => (
          <li
            key={`${entry.productName}-${index}`}
            className="rounded-xl border border-fuchsia-500/25 bg-fuchsia-500/[0.07] p-3"
          >
            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-fuchsia-300">
              {entry.productName}
            </p>
            <p className="mt-1 font-mono text-xl font-black tracking-wide text-white">
              {entry.playerId}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
