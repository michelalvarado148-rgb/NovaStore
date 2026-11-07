import { requireUser } from '@/lib/auth';
import { getBalanceMovements } from '@/lib/orders';
import { formatDateTime, formatPEN } from '@/lib/format';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Mi saldo' };

export default async function BalancePage() {
  const user = await requireUser('/cuenta/saldo');
  const movements = getBalanceMovements(user.id, 200);
  const credited = movements
    .filter((m) => m.amount_cents > 0)
    .reduce((sum, m) => sum + m.amount_cents, 0);
  const debited = movements
    .filter((m) => m.amount_cents < 0)
    .reduce((sum, m) => sum + m.amount_cents, 0);

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="panel border-purple-400/40 p-5">
          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-purple-300">
            Saldo disponible
          </p>
          <p className="mt-1 text-3xl font-black text-white">{formatPEN(user.balance_cents)}</p>
        </div>
        <div className="panel p-5">
          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-emerald-300">
            Total acreditado
          </p>
          <p className="mt-1 text-2xl font-black text-emerald-300">{formatPEN(credited)}</p>
        </div>
        <div className="panel p-5">
          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-red-300">
            Total usado
          </p>
          <p className="mt-1 text-2xl font-black text-red-300">{formatPEN(Math.abs(debited))}</p>
        </div>
      </div>

      <section className="panel overflow-hidden">
        <div className="border-b border-white/5 p-5">
          <h1 className="text-sm font-bold uppercase tracking-[0.14em] text-purple-200">
            Historial de movimientos
          </h1>
          <p className="muted mt-1 text-xs">
            El saldo lo acredita el administrador luego de verificar tu pago.
          </p>
        </div>
        {movements.length === 0 ? (
          <p className="p-6 text-sm text-slate-400">Aún no tienes movimientos de saldo.</p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Motivo</th>
                  <th>Monto</th>
                  <th>Tipo</th>
                </tr>
              </thead>
              <tbody>
                {movements.map((movement) => (
                  <tr key={movement.id}>
                    <td className="text-xs text-slate-400">{formatDateTime(movement.created_at)}</td>
                    <td className="text-sm text-slate-200">{movement.description}</td>
                    <td
                      className={`font-bold ${
                        movement.amount_cents >= 0 ? 'text-emerald-300' : 'text-red-300'
                      }`}
                    >
                      {movement.amount_cents >= 0 ? '+' : ''}
                      {formatPEN(movement.amount_cents)}
                    </td>
                    <td className="text-sm text-white">{movement.type}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
