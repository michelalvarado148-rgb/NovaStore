import { requireUser } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { formatDateTime, formatPEN } from '@/lib/format';
import { changePasswordAction, updateProfileAction } from '@/app/actions/session';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Mis datos' };

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const user = await requireUser('/cuenta/perfil');
  const { ok, error } = await searchParams;
  const row = getDb()
    .prepare('SELECT address, created_at FROM users WHERE id = ?')
    .get(user.id) as { address: string | null; created_at: string } | undefined;

  return (
    <div className="space-y-5">
      {ok ? (
        <p className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm text-emerald-100">
          {ok}
        </p>
      ) : null}
      {error ? (
        <p className="rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200">
          {error}
        </p>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-2">
        <form action={updateProfileAction} className="panel space-y-4 p-5">
          <h1 className="text-sm font-bold uppercase tracking-[0.14em] text-purple-200">
            Datos personales
          </h1>

          <label className="block">
            <span className="label">Nombre completo</span>
            <input name="name" required minLength={3} defaultValue={user.name} className="input" />
          </label>

          <label className="block">
            <span className="label">Correo electrónico (no editable)</span>
            <input value={user.email} readOnly disabled className="input opacity-60" />
          </label>

          <label className="block">
            <span className="label">Teléfono / WhatsApp</span>
            <input name="phone" defaultValue={user.phone ?? ''} className="input" />
          </label>

          <label className="block">
            <span className="label">Dirección o referencia (opcional)</span>
            <textarea name="address" defaultValue={row?.address ?? ''} rows={2} className="input" />
          </label>

          <button type="submit" className="btn btn-primary">Guardar cambios</button>
        </form>

        <div className="space-y-5">
          <form action={changePasswordAction} className="panel space-y-4 p-5">
            <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-purple-200">
              Seguridad
            </h2>
            <label className="block">
              <span className="label">Contraseña actual</span>
              <input
                name="current"
                type="password"
                required
                autoComplete="current-password"
                className="input"
              />
            </label>
            <label className="block">
              <span className="label">Nueva contraseña</span>
              <input
                name="next_password"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                className="input"
              />
            </label>
            <label className="block">
              <span className="label">Confirmar nueva contraseña</span>
              <input
                name="confirm"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                className="input"
              />
            </label>
            <button type="submit" className="btn btn-outline">Actualizar contraseña</button>
          </form>

          <section className="panel p-5">
            <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-purple-200">
              Información de la cuenta
            </h2>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-slate-400">Tipo de cuenta</dt>
                <dd className="font-semibold text-white">
                  {user.role === 'admin' ? 'Administrador' : 'Cliente'}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-400">Saldo disponible</dt>
                <dd className="font-semibold text-white">{formatPEN(user.balance_cents)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-400">Miembro desde</dt>
                <dd className="font-semibold text-white">
                  {row?.created_at ? formatDateTime(row.created_at) : '—'}
                </dd>
              </div>
            </dl>
          </section>
        </div>
      </div>
    </div>
  );
}
