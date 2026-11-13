import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { formatPEN } from '@/lib/format';
import { logoutAction } from '@/app/actions/session';
import MaintenanceScreen from '@/components/MaintenanceScreen';
import { isStoreClosed } from '@/lib/maintenance';

const NAV = [
  { href: '/cuenta', label: 'Resumen' },
  { href: '/cuenta/pedidos', label: 'Mis pedidos' },
  { href: '/cuenta/saldo', label: 'Saldo y recargas' },
  { href: '/cuenta/soporte', label: 'Soporte' },
  { href: '/cuenta/perfil', label: 'Mis datos' },
];

export default async function AccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (await isStoreClosed()) return <MaintenanceScreen />;

  const user = await requireUser('/cuenta');

  return (
    <div className="shell py-8">
      <div className="panel mb-5 flex flex-wrap items-center justify-between gap-4 p-5">
        <div className="flex items-center gap-3">
          <span className="grid h-12 w-12 place-items-center rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 text-lg font-black text-white">
            {user.name.slice(0, 1).toUpperCase()}
          </span>
          <div>
            <p className="text-lg font-bold text-white">{user.name}</p>
            <p className="text-xs text-slate-400">{user.email}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="rounded-xl border border-purple-500/30 bg-purple-500/10 px-4 py-2 text-right">
            <p className="text-[0.65rem] uppercase tracking-[0.14em] text-purple-300">Saldo disponible</p>
            <p className="text-lg font-black text-white">{formatPEN(user.balance_cents)}</p>
          </div>
          {user.role === 'admin' ? (
            <Link href="/admin" className="btn btn-outline btn-sm">Panel admin</Link>
          ) : null}
          <form action={logoutAction}>
            <button type="submit" className="btn btn-ghost btn-sm">Salir</button>
          </form>
        </div>
      </div>

      <nav className="mb-5 flex gap-2 overflow-x-auto pb-1">
        {NAV.map((item) => (
          <Link key={item.href} href={item.href} className="chip whitespace-nowrap">
            {item.label}
          </Link>
        ))}
      </nav>

      {children}
    </div>
  );
}
