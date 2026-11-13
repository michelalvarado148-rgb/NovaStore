import Link from 'next/link';
import { adminUsesDefaultPassword, requireAdmin } from '@/lib/auth';
import { logoutAction } from '@/app/actions/session';

const NAV = [
  { href: '/admin', label: 'Resumen' },
  { href: '/admin/pedidos', label: 'Pedidos' },
  { href: '/admin/comprobantes', label: 'Comprobantes' },
  { href: '/admin/recargas', label: 'Recargas' },
  { href: '/admin/productos', label: 'Productos' },
  { href: '/admin/categorias', label: 'Categorías' },
  { href: '/admin/ofertas', label: 'Ofertas' },
  { href: '/admin/clientes', label: 'Clientes' },
  { href: '/admin/soporte', label: 'Soporte' },
  { href: '/admin/saldos', label: 'Saldos' },
  { href: '/admin/pagos', label: 'Métodos de pago' },
  { href: '/admin/qr-pago', label: 'QR de pago' },
  { href: '/admin/notificaciones', label: 'Notificaciones' },
  { href: '/admin/backups', label: 'Copias de seguridad' },
  { href: '/admin/configuracion', label: 'Configuración' },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin('/admin');
  const usingDefaultPassword = adminUsesDefaultPassword(admin.id);

  return (
    <div className="shell py-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-purple-500/25 bg-[#0e0a1a]/80 p-4">
        <div>
          <p className="text-[0.65rem] font-bold uppercase tracking-[0.2em] text-fuchsia-300">
            Panel administrativo
          </p>
          <p className="text-lg font-black text-white">{admin.name}</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/" className="btn btn-ghost btn-sm">Ver tienda</Link>
          <form action={logoutAction}>
            <button type="submit" className="btn btn-outline btn-sm">Cerrar sesión</button>
          </form>
        </div>
      </div>

      {usingDefaultPassword ? (
        <div className="mb-5 rounded-2xl border border-amber-400/40 bg-amber-500/10 p-4">
          <p className="text-sm font-black text-amber-200">
            Estás usando la contraseña de administrador por defecto
          </p>
          <p className="mt-1 text-sm text-amber-100/80">
            Cualquier persona con acceso al código de la tienda puede entrar a este panel. Cambia la
            contraseña ahora y define ADMIN_EMAIL y ADMIN_PASSWORD en las variables de entorno del
            proyecto.
          </p>
          <Link href="/cuenta/perfil" className="btn btn-outline btn-sm mt-3">
            Cambiar contraseña
          </Link>
        </div>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[220px_1fr]">
        <nav className="flex gap-2 overflow-x-auto pb-1 lg:sticky lg:top-4 lg:h-fit lg:flex-col lg:overflow-visible">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="whitespace-nowrap rounded-xl border border-white/5 bg-white/[0.02] px-3 py-2 text-sm font-semibold text-slate-300 transition hover:border-purple-400/50 hover:text-white"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
