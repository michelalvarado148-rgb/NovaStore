import { getCustomers } from '@/lib/orders';
import { adjustBalanceAction } from '@/app/actions/admin';
import { formatDateTime, formatPEN } from '@/lib/format';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Gestión de saldos' };

export default async function AdminBalancePage({
  searchParams,
}: {
  searchParams: Promise<{ cliente?: string; ok?: string; error?: string }>;
}) {
  const params = await searchParams;
  const customers = getCustomers();
  const selectedId = Number(params.cliente ?? 0);
  const selected = customers.find((customer) => customer.id === selectedId) ?? customers[0];

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-black text-white">Gestión de saldo de clientes</h1>

      {params.ok ? <p className="alert alert-ok">{params.ok}</p> : null}
      {params.error ? <p className="alert alert-error">{params.error}</p> : null}

      <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <form action={adjustBalanceAction} className="panel space-y-3 p-5">
          <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-purple-300">
            Acreditar o descontar saldo
          </h2>

          <label className="field">
            <span>Cliente</span>
            <select name="user_id" defaultValue={selected?.id ?? ''}>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.name} · {formatPEN(customer.balance_cents)}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Monto en soles (usa negativo para descontar)</span>
            <input name="amount" inputMode="decimal" required placeholder="25.00" />
          </label>

          <label className="field">
            <span>Tipo de movimiento</span>
            <select name="type" defaultValue="recarga">
              <option value="recarga">Recarga de saldo</option>
              <option value="reembolso">Reembolso</option>
              <option value="ajuste">Ajuste manual</option>
              <option value="compra">Consumo</option>
            </select>
          </label>

          <label className="field">
            <span>Descripción</span>
            <input name="description" placeholder="Ej. Recarga por Yape verificada" maxLength={160} />
          </label>

          <button type="submit" className="btn btn-primary w-full">Registrar movimiento</button>
        </form>

        <div className="panel p-5">
          <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-purple-300">
            Saldos de clientes
          </h2>
          <ul className="mt-3 divide-y divide-white/5">
            {customers.map((customer) => (
              <li key={customer.id} className="flex items-center justify-between gap-2 py-2">
                <div>
                  <p className="text-sm text-white">{customer.name}</p>
                  <p className="text-[0.7rem] text-slate-500">{customer.email}</p>
                </div>
                <span className="whitespace-nowrap text-sm font-bold text-purple-200">
                  {formatPEN(customer.balance_cents)}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[0.7rem] text-slate-500">
            Cada movimiento queda registrado con fecha {formatDateTime(new Date().toISOString())} y el
            administrador que lo autorizó.
          </p>
        </div>
      </div>
    </div>
  );
}
