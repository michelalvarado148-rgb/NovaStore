import Link from 'next/link';
import { redirect } from 'next/navigation';
import Logo from '@/components/Logo';
import { registerAction } from '@/app/actions/auth';
import { getCurrentUser, safeNextPath } from '@/lib/auth';
import MaintenanceScreen from '@/components/MaintenanceScreen';
import { isStoreClosed } from '@/lib/maintenance';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Crear cuenta' };

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{
    error?: string;
    next?: string;
    name?: string;
    email?: string;
    phone?: string;
  }>;
}) {
  if (await isStoreClosed()) return <MaintenanceScreen />;

  const { error, next, name, email, phone } = await searchParams;
  const user = await getCurrentUser();
  const target = safeNextPath(next);
  if (user) redirect(target);

  return (
    <div className="shell grid min-h-[70vh] place-items-center py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <div className="mb-4 flex justify-center">
            <Logo />
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white">Crea tu cuenta</h1>
          <p className="muted mt-1 text-sm">
            Registro gratuito. Guarda tu historial de compras y tu saldo.
          </p>
        </div>

        <form action={registerAction} className="panel space-y-4 p-6">
          <input type="hidden" name="next" value={target} />
          {error ? (
            <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
              {error}
            </p>
          ) : null}

          <label className="block">
            <span className="label">Nombre completo</span>
            <input
              name="name"
              required
              minLength={3}
              defaultValue={name ?? ''}
              className="input"
              placeholder="Nombres y apellidos"
              autoComplete="name"
            />
          </label>

          <label className="block">
            <span className="label">Correo electrónico</span>
            <input
              name="email"
              type="email"
              required
              defaultValue={email ?? ''}
              className="input"
              placeholder="tucorreo@ejemplo.com"
              autoComplete="email"
            />
          </label>

          <label className="block">
            <span className="label">Teléfono / WhatsApp (opcional)</span>
            <input
              name="phone"
              defaultValue={phone ?? ''}
              className="input"
              placeholder="+51 999 999 999"
              autoComplete="tel"
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="label">Contraseña</span>
              <input
                name="password"
                type="password"
                required
                minLength={8}
                className="input"
                placeholder="Mínimo 8 caracteres"
                autoComplete="new-password"
              />
            </label>
            <label className="block">
              <span className="label">Confirmar contraseña</span>
              <input
                name="confirm"
                type="password"
                required
                minLength={8}
                className="input"
                placeholder="Repite tu contraseña"
                autoComplete="new-password"
              />
            </label>
          </div>

          <button type="submit" className="btn btn-primary w-full">
            Crear mi cuenta
          </button>

          <p className="text-center text-sm text-slate-400">
            ¿Ya tienes cuenta?{' '}
            <Link href="/login" className="font-semibold text-purple-300 hover:text-purple-200">
              Inicia sesión
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
