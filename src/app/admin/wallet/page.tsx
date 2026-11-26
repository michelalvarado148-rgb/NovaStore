import Link from 'next/link';
import { formatDateTime, formatPEN } from '@/lib/format';
import {
  getWalletConfig,
  getWalletTotals,
  listAllWalletMovements,
  listWalletRequests,
} from '@/lib/wallet';
import {
  approveWalletRequestAction,
  clearWalletQrAction,
  rejectWalletRequestAction,
  reviewWalletRequestAction,
  saveWalletConfigAction,
  saveWalletQrAction,
} from '@/app/actions/wallet';
import ImagePicker from '@/components/admin/ImagePicker';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'NovaWallet · Panel' };

const STATUS: Record<string, { label: string; className: string }> = {
  pendiente: { label: 'Pendiente', className: 'badge badge-warning' },
  aprobado: { label: 'Aprobado', className: 'badge badge-success' },
  rechazado: { label: 'Rechazado', className: 'badge badge-danger' },
};

export default async function AdminWalletPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const sp = await searchParams;
  const config = getWalletConfig();
  const totals = getWalletTotals();
  const pendingRecharges = listWalletRequests({ kind: 'recarga', status: 'pendiente' });
  const pendingWithdrawals = listWalletRequests({ kind: 'retiro', status: 'pendiente' });
  const history = listWalletRequests({ status: 'todas' }).slice(0, 40);
  const movements = listAllWalletMovements(60);

  return (
    <div className="space-y-5">
      <header className="rounded-2xl border border-purple-500/25 bg-[#0e0a1a]/80 p-5">
        <p className="text-[0.65rem] font-bold uppercase tracking-[0.2em] text-fuchsia-300">
          Sección EXTRA
        </p>
        <h1 className="mt-1 flex items-center gap-2 text-2xl font-black text-white">
          <span aria-hidden>👛</span> NovaWallet
        </h1>
        <p className="mt-1 text-sm text-slate-300">
          Alcancía digital independiente del saldo de compras. Aprueba las recargas y los retiros
          para que el saldo del cliente se actualice.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link href="/extra/novawallet" className="btn btn-ghost btn-sm">
            Ver alcancía
          </Link>
          <Link href="/admin/extra" className="btn btn-ghost btn-sm">
            Páginas EXTRA
          </Link>
        </div>
      </header>

      {sp.ok ? (
        <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
          {sp.ok}
        </p>
      ) : null}
      {sp.error ? (
        <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {sp.error}
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-4">
          <p className="text-[0.66rem] font-semibold uppercase tracking-[0.14em] text-purple-300">
            Saldo en alcancías
          </p>
          <p className="mt-1 text-2xl font-black text-white">{formatPEN(totals.balance_cents)}</p>
          <p className="muted mt-1 text-xs">{totals.accounts} cuenta(s)</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-4">
          <p className="text-[0.66rem] font-semibold uppercase tracking-[0.14em] text-amber-300">
            Solicitudes pendientes
          </p>
          <p className="mt-1 text-2xl font-black text-amber-300">{totals.pending}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-4">
          <p className="text-[0.66rem] font-semibold uppercase tracking-[0.14em] text-sky-300">
            Comisión de retiro
          </p>
          <p className="mt-1 text-sm font-bold text-white">
            {config.fee_enabled
              ? [
                  config.fee_percent > 0 ? `${config.fee_percent}%` : '',
                  config.fee_fixed_cents > 0 ? formatPEN(config.fee_fixed_cents) : '',
                ]
                  .filter(Boolean)
                  .join(' + ') || 'Activada'
              : 'Sin comisión'}
          </p>
        </div>
      </div>

      <section id="config" className="rounded-2xl border border-white/10 bg-[#0e0a1a]/70 p-5">
        <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-purple-200">
          Configuración de NovaWallet
        </h2>
        <p className="muted mt-1 text-xs">
          Número de Yape de respaldo, avisos para el cliente, comisiones y montos mínimos. El QR
          de pago se administra en su propia sección.
        </p>

        <form action={saveWalletConfigAction} className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="block text-sm text-slate-300">
            Número de Yape (respaldo, opcional)
            <input
              type="text"
              name="yape_number"
              defaultValue={config.yape_number}
              maxLength={40}
              placeholder="987 654 321"
              className="input mt-1.5 w-full"
            />
          </label>
          <label className="block text-sm text-slate-300">
            Titular de la cuenta
            <input
              type="text"
              name="yape_holder"
              defaultValue={config.yape_holder}
              maxLength={80}
              placeholder="Nombre del titular"
              className="input mt-1.5 w-full"
            />
          </label>
          <label className="block text-sm text-slate-300 sm:col-span-2">
            Aviso para los clientes
            <textarea
              name="notice"
              rows={3}
              maxLength={600}
              defaultValue={config.notice}
              placeholder="Ej. Se cobra una comisión del 3% en cada retiro. Las recargas se aprueban en horario de 8:00 a 22:00."
              className="input mt-1.5 w-full resize-y"
            />
          </label>

          <label className="flex items-start gap-2 rounded-xl border border-white/10 bg-slate-900/50 p-3 text-sm text-slate-200 sm:col-span-2">
            <input
              type="checkbox"
              name="fee_enabled"
              defaultChecked={config.fee_enabled}
              className="mt-0.5"
            />
            <span>
              Cobrar comisión por retiro
              <span className="muted block text-xs">
                Se descuenta del monto solicitado. El cliente ve la comisión antes de solicitar.
              </span>
            </span>
          </label>

          <label className="block text-sm text-slate-300">
            Comisión (% del monto)
            <input
              type="number"
              name="fee_percent"
              defaultValue={config.fee_percent}
              min={0}
              max={50}
              step="0.5"
              className="input mt-1.5 w-full"
            />
          </label>
          <label className="block text-sm text-slate-300">
            Comisión fija (S/)
            <input
              type="number"
              name="fee_fixed"
              defaultValue={(config.fee_fixed_cents / 100).toFixed(2)}
              min={0}
              step="0.01"
              className="input mt-1.5 w-full"
            />
          </label>
          <label className="block text-sm text-slate-300">
            Recarga mínima (S/)
            <input
              type="number"
              name="min_recharge"
              defaultValue={(config.min_recharge_cents / 100).toFixed(2)}
              min={1}
              step="0.5"
              className="input mt-1.5 w-full"
            />
          </label>
          <label className="block text-sm text-slate-300">
            Retiro mínimo (S/)
            <input
              type="number"
              name="min_withdraw"
              defaultValue={(config.min_withdraw_cents / 100).toFixed(2)}
              min={1}
              step="0.5"
              className="input mt-1.5 w-full"
            />
          </label>

          <div className="sm:col-span-2">
            <button type="submit" className="btn btn-primary">
              Guardar configuración
            </button>
          </div>
        </form>
      </section>

      <section id="qr" className="rounded-2xl border border-white/10 bg-[#0e0a1a]/70 p-5">
        <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-purple-200">
          QR de pago de NovaWallet
        </h2>
        <p className="muted mt-1 text-xs">
          Los clientes ven este QR cuando pulsan «Agregar dinero». Se guarda en Supabase y se
          actualiza al instante en todos los dispositivos.
        </p>

        <div className="mt-4 flex flex-wrap items-start gap-5">
          <div className="rounded-2xl bg-white p-3">
            {config.qr_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={config.qr_url}
                alt="QR de NovaWallet configurado"
                className="h-44 w-44 object-contain"
              />
            ) : (
              <div className="grid h-44 w-44 place-items-center px-3 text-center text-[0.7rem] leading-snug text-slate-500">
                Todavía no hay un QR configurado
              </div>
            )}
          </div>
          <div className="min-w-[12rem] flex-1 space-y-2">
            <span className={config.qr_url ? 'badge badge-success' : 'badge badge-warning'}>
              {config.qr_url ? 'QR activo' : 'QR sin configurar'}
            </span>
            <p className="muted text-xs">
              {config.qr_url
                ? 'Este es el QR que ven los clientes. Para cambiarlo, sube otra imagen y guarda: el anterior se reemplaza.'
                : 'Mientras no subas una imagen, los clientes ven el aviso de que el QR todavía no está disponible. No se usa ningún QR de ejemplo.'}
            </p>
          </div>
        </div>

        <form action={saveWalletQrAction} className="mt-4 space-y-3 border-t border-white/5 pt-4">
          <ImagePicker
            name="wallet_qr_url"
            label="Imagen del QR de NovaWallet"
            folder="pagos"
            defaultValue={config.qr_url}
          />
          <button type="submit" className="btn btn-primary">
            Guardar QR de NovaWallet
          </button>
        </form>

        {config.qr_url ? (
          <form action={clearWalletQrAction} className="mt-3 border-t border-white/5 pt-4">
            <button type="submit" className="btn btn-danger btn-sm">
              Eliminar QR de NovaWallet
            </button>
          </form>
        ) : null}
      </section>

      <section id="solicitudes" className="space-y-4">
        <div className="rounded-2xl border border-white/10 bg-[#0e0a1a]/70 p-5">
          <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-purple-200">
            Recargas por verificar ({pendingRecharges.length})
          </h2>
          {pendingRecharges.length === 0 ? (
            <p className="muted mt-2 text-sm">No hay recargas pendientes.</p>
          ) : (
            <div className="mt-3 space-y-3">
              {pendingRecharges.map((request) => (
                <article
                  key={request.id}
                  className="rounded-xl border border-white/10 bg-slate-900/50 p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-white">
                        {formatPEN(request.amount_cents)} · {request.user_name}
                      </p>
                      <p className="muted text-xs">
                        {request.user_email} · {formatDateTime(request.created_at)}
                      </p>
                      {request.reference ? (
                        <p className="mt-1 text-xs text-slate-300">
                          Operación: {request.reference}
                        </p>
                      ) : null}
                      {request.note ? (
                        <p className="mt-1 text-xs text-slate-400">{request.note}</p>
                      ) : null}
                    </div>
                    {request.proof_url ? (
                      <a
                        href={request.proof_url}
                        target="_blank"
                        rel="noreferrer"
                        className="btn btn-ghost btn-sm"
                      >
                        Ver comprobante
                      </a>
                    ) : (
                      <span className="text-xs text-amber-300">Sin comprobante</span>
                    )}
                  </div>
                  <form
                    action={reviewWalletRequestAction}
                    className="mt-3 flex flex-wrap items-center gap-2"
                  >
                    <input type="hidden" name="id" value={request.id} />
                    <input
                      type="text"
                      name="admin_note"
                      placeholder="Nota o motivo (opcional)"
                      maxLength={300}
                      className="input w-full sm:w-64"
                    />
                    <button
                      type="submit"
                      formAction={approveWalletRequestAction}
                      className="btn btn-primary btn-sm"
                    >
                      Aprobar recarga
                    </button>
                    <button
                      type="submit"
                      formAction={rejectWalletRequestAction}
                      className="btn btn-outline btn-sm"
                    >
                      Rechazar
                    </button>
                  </form>
                </article>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-white/10 bg-[#0e0a1a]/70 p-5">
          <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-purple-200">
            Retiros por verificar ({pendingWithdrawals.length})
          </h2>
          {pendingWithdrawals.length === 0 ? (
            <p className="muted mt-2 text-sm">No hay retiros pendientes.</p>
          ) : (
            <div className="mt-3 space-y-3">
              {pendingWithdrawals.map((request) => (
                <article
                  key={request.id}
                  className="rounded-xl border border-white/10 bg-slate-900/50 p-4"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-white">
                      {formatPEN(request.amount_cents)} · {request.user_name}
                    </p>
                    <p className="muted text-xs">
                      {request.user_email} · {formatDateTime(request.created_at)} ·{' '}
                      {request.method}
                    </p>
                    {request.fee_cents > 0 ? (
                      <p className="mt-1 text-xs text-amber-200">
                        Comisión {formatPEN(request.fee_cents)} · el cliente recibe{' '}
                        {formatPEN(request.net_cents)}
                      </p>
                    ) : null}
                    {request.note ? (
                      <p className="mt-1 text-xs text-slate-300">Destino: {request.note}</p>
                    ) : null}
                  </div>
                  <form
                    action={reviewWalletRequestAction}
                    className="mt-3 flex flex-wrap items-center gap-2"
                  >
                    <input type="hidden" name="id" value={request.id} />
                    <input
                      type="text"
                      name="admin_note"
                      placeholder="N° de operación del envío (opcional)"
                      maxLength={300}
                      className="input w-full sm:w-64"
                    />
                    <button
                      type="submit"
                      formAction={approveWalletRequestAction}
                      className="btn btn-primary btn-sm"
                    >
                      Aprobar retiro
                    </button>
                    <button
                      type="submit"
                      formAction={rejectWalletRequestAction}
                      className="btn btn-outline btn-sm"
                    >
                      Rechazar
                    </button>
                  </form>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-[#0e0a1a]/70 p-5">
        <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-purple-200">
          Historial de solicitudes
        </h2>
        {history.length === 0 ? (
          <p className="muted mt-2 text-sm">Todavía no hay solicitudes de NovaWallet.</p>
        ) : (
          <div className="table-wrap mt-3">
            <table className="table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Cliente</th>
                  <th>Tipo</th>
                  <th>Monto</th>
                  <th>Estado</th>
                  <th>Revisado</th>
                </tr>
              </thead>
              <tbody>
                {history.map((request) => (
                  <tr key={request.id}>
                    <td className="text-xs text-slate-400">{formatDateTime(request.created_at)}</td>
                    <td className="text-sm text-white">{request.user_name}</td>
                    <td className="text-sm text-slate-200">
                      {request.kind === 'recarga' ? 'Recarga' : 'Retiro'}
                    </td>
                    <td className="font-bold text-white">{formatPEN(request.amount_cents)}</td>
                    <td>
                      <span className={STATUS[request.status].className}>
                        {STATUS[request.status].label}
                      </span>
                    </td>
                    <td className="max-w-[14rem] text-xs text-slate-400">
                      {request.reviewed_at ? formatDateTime(request.reviewed_at) : '—'}
                      {request.admin_note ? ` · ${request.admin_note}` : ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-white/10 bg-[#0e0a1a]/70 p-5">
        <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-purple-200">
          Movimientos de alcancías
        </h2>
        {movements.length === 0 ? (
          <p className="muted mt-2 text-sm">Sin movimientos registrados.</p>
        ) : (
          <div className="table-wrap mt-3">
            <table className="table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Cliente</th>
                  <th>Detalle</th>
                  <th>Monto</th>
                </tr>
              </thead>
              <tbody>
                {movements.map((movement) => (
                  <tr key={movement.id}>
                    <td className="text-xs text-slate-400">
                      {formatDateTime(movement.created_at)}
                    </td>
                    <td className="text-sm text-white">{movement.user_name}</td>
                    <td className="text-sm text-slate-200">{movement.description}</td>
                    <td
                      className={`font-bold ${
                        movement.amount_cents >= 0 ? 'text-emerald-300' : 'text-red-300'
                      }`}
                    >
                      {movement.amount_cents >= 0 ? '+' : ''}
                      {formatPEN(movement.amount_cents)}
                    </td>
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
