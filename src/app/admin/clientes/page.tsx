import Link from 'next/link';
import { getCustomers } from '@/lib/orders';
import { toggleCustomerAction } from '@/app/actions/admin';
import { formatDateTime, formatPEN } from '@/lib/format';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Gestión de clientes' };

export default async function AdminCustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; ok?: string; error?: string }>;
}) {
  const params = await searchParams;
  const customers = getCustomers(params.q);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-black text-white">Clientes ({customers.length})</h1>

      {params.ok ? <p className="alert alert-ok">{params.ok}</p> : null}
      {params.error ? <p className="alert alert-error">{params.error}</p> : null}

      <form className="panel flex flex-wrap items-end gap-2 p-4">
        <label className="field">
          <span>Buscar cliente</span>
          <input name="q" defaultValue={params.q ?? ''} placeholder="Nombre o correo" />
        </label>
        <button type="submit" className="btn btn-primary btn-sm">Buscar</button>
      </form>

      <div className="panel overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              <th>Cliente</th>
              <th>Rol</th>
              <th>Saldo</th>
              <th>Pedidos</th>
              <th>Compras verificadas</th>
              <th>Registro</th>
              <th className="text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {customers.map((customer) => (
              <tr key={customer.id}>
                <td>
                  <p className="text-sm font-semibold text-white">{customer.name}</p>
                  <p className="text-[0.7rem] text-slate-500">{customer.email}</p>
                  {customer.phone ? (
                    <p className="text-[0.7rem] text-slate-500">{customer.phone}</p>
                  ) : null}
                </td>
                <td>
                  <span className={`badge ${customer.role === 'admin' ? 'badge-info' : 'badge-muted'}`}>
                    {customer.role === 'admin' ? 'Administrador' : 'Cliente'}
                  </span>
                </td>
                <td className="whitespace-nowrap text-slate-200">{formatPEN(customer.balance_cents)}</td>
                <td className="text-slate-300">{customer.orders_count}</td>
                <td className="whitespace-nowrap text-slate-300">{formatPEN(customer.spent_cents)}</td>
                <td className="whitespace-nowrap text-[0.7rem] text-slate-500">
                  {formatDateTime(customer.created_at)}
                </td>
                <td>
                  <div className="flex justify-end gap-2">
                    <Link href={`/admin/saldos?cliente=${customer.id}`} className="btn btn-ghost btn-xs">
                      Saldo
                    </Link>
                    {customer.role === 'admin' ? (
                      <span className="badge badge-info self-center">Protegido</span>
                    ) : (
                      <form action={toggleCustomerAction}>
                        <input type="hidden" name="user_id" value={customer.id} />
                        <button
                          type="submit"
                          className={`btn btn-xs ${customer.is_active ? 'btn-danger' : 'btn-outline'}`}
                        >
                          {customer.is_active ? 'Desactivar' : 'Activar'}
                        </button>
                      </form>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {customers.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-6 text-center text-sm text-slate-400">
                  No se encontraron clientes.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
