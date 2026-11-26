import { listExtraPages } from '@/lib/extra';
import { deleteExtraPageAction, saveExtraPageAction } from '@/app/actions/extra';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Sección EXTRA · Panel' };

export default async function AdminExtraPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const sp = await searchParams;
  const pages = listExtraPages(true);

  return (
    <div className="space-y-5">
      <header className="rounded-2xl border border-purple-500/25 bg-[#0e0a1a]/80 p-5">
        <p className="text-[0.65rem] font-bold uppercase tracking-[0.2em] text-fuchsia-300">
          Sección EXTRA
        </p>
        <h1 className="mt-1 text-2xl font-black text-white">Páginas adicionales</h1>
        <p className="mt-1 text-sm text-slate-300">
          Agrega tarjetas a la sección EXTRA de la tienda. NovaWallet viene incluida y no se puede
          eliminar.
        </p>
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

      <section className="rounded-2xl border border-white/10 bg-[#0e0a1a]/70 p-5">
        <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-purple-200">
          Páginas en EXTRA ({pages.length})
        </h2>
        <div className="mt-3 space-y-2">
          {pages.map((page) => (
            <article
              key={page.slug}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-slate-900/50 p-4"
            >
              <div className="flex min-w-0 items-start gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-purple-400/30 bg-purple-500/10 text-xl">
                  {page.icon}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-white">
                    {page.title}
                    {page.builtin ? (
                      <span className="badge badge-success ml-2">Fija</span>
                    ) : null}
                    {!page.is_active ? (
                      <span className="badge badge-warning ml-2">Oculta</span>
                    ) : null}
                  </p>
                  <p className="muted text-xs">{page.description || 'Sin descripción'}</p>
                  <p className="mt-1 text-xs text-slate-400">Destino: {page.href}</p>
                </div>
              </div>
              {page.builtin ? (
                <a href={page.href} className="btn btn-ghost btn-sm">
                  Abrir
                </a>
              ) : (
                <form action={deleteExtraPageAction}>
                  <input type="hidden" name="slug" value={page.slug} />
                  <button type="submit" className="btn btn-outline btn-sm">
                    Eliminar
                  </button>
                </form>
              )}
            </article>
          ))}
        </div>
      </section>

      <section id="nueva" className="rounded-2xl border border-white/10 bg-[#0e0a1a]/70 p-5">
        <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-purple-200">
          Agregar página a EXTRA
        </h2>
        <p className="muted mt-1 text-xs">
          El destino puede ser una ruta de la tienda (por ejemplo <code>/contacto</code>) o un enlace
          <code> https://</code>.
        </p>
        <form action={saveExtraPageAction} className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="block text-sm text-slate-300">
            Nombre
            <input
              type="text"
              name="title"
              required
              maxLength={60}
              placeholder="Ej. Mis cupones"
              className="input mt-1.5 w-full"
            />
          </label>
          <label className="block text-sm text-slate-300">
            Icono (emoji)
            <input
              type="text"
              name="icon"
              maxLength={4}
              placeholder="🎟️"
              className="input mt-1.5 w-full"
            />
          </label>
          <label className="block text-sm text-slate-300 sm:col-span-2">
            Descripción
            <input
              type="text"
              name="description"
              maxLength={220}
              placeholder="Describe brevemente qué encontrará el cliente"
              className="input mt-1.5 w-full"
            />
          </label>
          <label className="block text-sm text-slate-300">
            Destino
            <input
              type="text"
              name="href"
              required
              placeholder="/contacto"
              className="input mt-1.5 w-full"
            />
          </label>
          <label className="block text-sm text-slate-300">
            Orden (menor aparece primero)
            <input
              type="number"
              name="position"
              defaultValue={100}
              min={0}
              step={1}
              className="input mt-1.5 w-full"
            />
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-200 sm:col-span-2">
            <input type="checkbox" name="is_active" defaultChecked />
            Mostrar esta página en la sección EXTRA
          </label>
          <div className="sm:col-span-2">
            <button type="submit" className="btn btn-primary">
              Guardar página
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
