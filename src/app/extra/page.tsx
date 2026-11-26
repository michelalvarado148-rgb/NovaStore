import Link from 'next/link';
import { listExtraPages } from '@/lib/extra';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'EXTRA' };

export default function ExtraIndexPage() {
  const pages = listExtraPages(false);

  return (
    <div className="space-y-5">
      <header className="panel p-5">
        <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-purple-300">
          Sección EXTRA
        </p>
        <h1 className="mt-1 text-2xl font-black text-white">Páginas adicionales de NOVASTORE</h1>
        <p className="muted mt-1 text-sm">
          Aquí se reúnen las herramientas extra de la tienda. NovaWallet es una alcancía digital
          independiente: su dinero no se usa para comprar productos en NOVASTORE.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        {pages.map((page) => (
          <Link
            key={page.slug}
            href={page.href}
            className="panel group flex items-start gap-4 p-5 transition hover:border-purple-400/60"
          >
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-purple-400/30 bg-purple-500/10 text-2xl">
              {page.icon}
            </span>
            <span className="min-w-0">
              <span className="block text-base font-bold text-white">{page.title}</span>
              <span className="muted mt-1 block text-xs leading-relaxed">{page.description}</span>
              <span className="mt-2 inline-block text-xs font-semibold text-fuchsia-300">
                Abrir →
              </span>
            </span>
          </Link>
        ))}
      </div>

      {pages.length === 0 ? (
        <p className="panel p-6 text-sm text-slate-400">
          Todavía no hay páginas disponibles en EXTRA.
        </p>
      ) : null}
    </div>
  );
}
