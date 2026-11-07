import { listAdminPaymentMethods } from '@/lib/admin';
import { savePaymentMethodAction } from '@/app/actions/admin';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Métodos de pago' };

export default async function AdminPaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const params = await searchParams;
  const methods = listAdminPaymentMethods();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-black text-white">Métodos de pago</h1>
        <p className="text-sm text-slate-400">
          Configura los datos de cuenta que verá el cliente al pagar con Yape, Plin o tarjeta. Los pagos
          siempre quedan pendientes hasta la verificación manual del administrador.
        </p>
      </div>

      {params.ok ? <p className="alert alert-ok">{params.ok}</p> : null}
      {params.error ? <p className="alert alert-error">{params.error}</p> : null}

      <div className="grid gap-4 lg:grid-cols-2">
        {methods.map((method) => (
          <form key={method.id} action={savePaymentMethodAction} className="panel space-y-3 p-5">
            <input type="hidden" name="id" value={method.id} />
            <div className="flex items-center justify-between">
              <p className="font-mono text-xs uppercase tracking-[0.14em] text-purple-300">
                {method.code}
              </p>
              <span className={`badge ${method.is_enabled ? 'badge-success' : 'badge-muted'}`}>
                {method.is_enabled ? 'Habilitado' : 'Deshabilitado'}
              </span>
            </div>

            <label className="field">
              <span>Nombre visible</span>
              <input name="name" defaultValue={method.name} required />
            </label>

            <label className="field">
              <span>Descripción corta</span>
              <input name="description" defaultValue={method.description} />
            </label>

            <label className="field">
              <span>Datos de la cuenta / número</span>
              <textarea name="account_info" rows={2} defaultValue={method.account_info} />
            </label>

            <label className="field">
              <span>Instrucciones para el cliente</span>
              <textarea name="instructions" rows={3} defaultValue={method.instructions} />
            </label>

            <div className="flex items-end gap-3">
              <label className="field w-24">
                <span>Orden</span>
                <input name="position" inputMode="numeric" defaultValue={method.position} />
              </label>
              <label className="flex items-center gap-2 pb-2 text-sm text-slate-300">
                <input type="checkbox" name="is_enabled" defaultChecked={method.is_enabled === 1} />
                Habilitado
              </label>
            </div>

            <button type="submit" className="btn btn-primary btn-sm w-full">Guardar método</button>
          </form>
        ))}
      </div>
    </div>
  );
}
