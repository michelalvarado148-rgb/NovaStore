import Link from 'next/link';
import { redirect } from 'next/navigation';
import Logo from '@/components/Logo';
import { loginAction } from '@/app/actions/auth';
import { getCurrentUser, safeNextPath } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Iniciar sesión' };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const { error, next } = await searchParams;
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
          <h1 className="text-2xl font-black tracking-tight text-white">Bienvenido de vuelta</h1>
          <p className="muted mt-1 text-sm">Ingresa para ver tus pedidos, saldo y compras.</p>
        </div>

        <form action={loginAction} className="panel space-y-4 p-6">
          <input type="hidden" name="next" value={target} />
          {error ? (
            <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
              {error}
            </p>
          ) : null}

          <label className="block">
            <span className="label">Correo electrónico</span>
            <input
              name="email"
              type="email"
              required
              autoComplete="email"
              className="input"
              placeholder="tucorreo@ejemplo.com"
            />
          </label>

          <label className="block">
            <span className="label">Contraseña</span>
            <input
              name="password"
              type="password"
              required
              autoComplete="current-password"
              className="input"
              placeholder="••••••••"
            />
          </label>

          <button type="submit" className="btn btn-primary w-full">
            Iniciar sesión
          </button>

          <p className="text-center text-sm text-slate-400">
            ¿No tienes cuenta?{' '}
            <Link href="/registro" className="font-semibold text-purple-300 hover:text-purple-200">
              Regístrate gratis
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
