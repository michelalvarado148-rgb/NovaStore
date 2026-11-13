import Link from 'next/link';
import ImagePicker from '@/components/admin/ImagePicker';
import { saveMaintenanceAction } from '@/app/actions/admin';
import {
  DEFAULT_MAINTENANCE_MESSAGE,
  MAX_MAINTENANCE_MESSAGE,
  formatReturnAt,
  getMaintenanceConfig,
  maintenanceMessage,
} from '@/lib/maintenance';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Modo mantenimiento' };

export default async function AdminMaintenancePage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const params = await searchParams;
  const config = getMaintenanceConfig();
  const returnAt = formatReturnAt(config.return_at);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-black text-white">Modo mantenimiento</h1>
          <p className="mt-1 text-sm text-slate-400">
            Cierra la tienda a los clientes mientras haces cambios. Tu acceso al panel sigue
            funcionando normalmente.
          </p>
        </div>
        <span
          className={`badge ${
            config.enabled ? 'badge-amber' : 'badge-green'
          } whitespace-nowrap`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              config.enabled ? 'animate-pulse bg-amber-400' : 'bg-emerald-400'
            }`}
          />
          {config.enabled ? 'Mantenimiento activo' : 'Tienda abierta'}
        </span>
      </div>

      {params.ok ? (
        <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm font-semibold text-emerald-300">
          {params.ok}
        </p>
      ) : null}
      {params.error ? (
        <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm font-semibold text-rose-300">
          {params.error}
        </p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[1.55fr_1fr]">
        <form action={saveMaintenanceAction} className="panel space-y-5 p-5">
          <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4 transition hover:border-purple-400/40">
            <input
              type="checkbox"
              name="enabled"
              value="1"
              defaultChecked={config.enabled}
              className="mt-0.5 h-5 w-5 shrink-0 accent-purple-500"
            />
            <span>
              <span className="block text-sm font-bold text-white">
                Activar modo mantenimiento
              </span>
              <span className="mt-0.5 block text-xs leading-relaxed text-slate-400">
                Los clientes verán la pantalla de mantenimiento y no podrán entrar a la tienda,
                productos, carrito, recargas, compras ni soporte. Tú conservas el acceso completo.
              </span>
            </span>
          </label>

          <div>
            <label htmlFor="maintenance_message" className="label">
              Mensaje para los clientes
            </label>
            <textarea
              id="maintenance_message"
              name="message"
              rows={4}
              maxLength={MAX_MAINTENANCE_MESSAGE}
              defaultValue={config.message}
              placeholder={DEFAULT_MAINTENANCE_MESSAGE}
              className="field"
            />
            <p className="mt-1.5 text-xs text-slate-500">
              Si lo dejas vacío se muestra el mensaje estándar: «{DEFAULT_MAINTENANCE_MESSAGE}»
            </p>
          </div>

          <ImagePicker
            name="image_url"
            label="Imagen o logo de mantenimiento"
            folder="mantenimiento"
            defaultValue={config.image_url}
            help="Opcional. Se muestra junto al mensaje en la pantalla de mantenimiento."
          />

          <div>
            <label htmlFor="maintenance_return" className="label">
              Fecha y hora estimada de regreso (opcional)
            </label>
            <input
              id="maintenance_return"
              type="datetime-local"
              name="return_at"
              defaultValue={config.return_at}
              className="field"
            />
            <p className="mt-1.5 text-xs text-slate-500">
              Se muestra a los clientes en hora de Perú. Déjalo vacío si aún no tienes una fecha.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 border-t border-white/10 pt-4">
            <button type="submit" className="btn btn-primary">
              Guardar y aplicar
            </button>
            <Link href="/mantenimiento" className="btn btn-outline btn-sm">
              Ver pantalla
            </Link>
          </div>
        </form>

        <div className="space-y-4">
          <div className="panel p-5">
            <p className="text-[0.65rem] font-bold uppercase tracking-[0.18em] text-purple-300">
              Estado actual
            </p>
            <p className="mt-2 text-lg font-black text-white">
              {config.enabled ? 'Tienda en mantenimiento' : 'Tienda disponible'}
            </p>
            <p className="mt-2 text-sm leading-relaxed text-slate-400">
              {config.enabled
                ? 'Los clientes no pueden comprar ni navegar por el catálogo. Tus pedidos, productos, saldos y comprobantes quedan intactos.'
                : 'Los clientes pueden navegar y comprar con normalidad.'}
            </p>
            {returnAt ? (
              <p className="mt-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-slate-300">
                Regreso estimado: <span className="font-bold text-white">{returnAt}</span>
              </p>
            ) : null}
          </div>

          <div className="panel p-5">
            <p className="text-[0.65rem] font-bold uppercase tracking-[0.18em] text-purple-300">
              Vista del mensaje
            </p>
            <p className="mt-2 text-sm leading-relaxed text-slate-300">
              {maintenanceMessage(config)}
            </p>
            {config.image_url ? (
              <div className="mt-3 overflow-hidden rounded-xl border border-white/10 bg-black/40 p-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={config.image_url}
                  alt="Imagen de mantenimiento configurada"
                  className="mx-auto max-h-28 w-auto object-contain"
                />
              </div>
            ) : (
              <p className="mt-3 text-xs text-slate-500">
                Todavía no has subido una imagen de mantenimiento.
              </p>
            )}
          </div>

          <div className="panel-flat p-4">
            <p className="text-xs leading-relaxed text-slate-400">
              El estado se guarda en la base de datos (Supabase), así que sigue activo aunque
              recargues la página, cierres el navegador o entres desde otro dispositivo.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
