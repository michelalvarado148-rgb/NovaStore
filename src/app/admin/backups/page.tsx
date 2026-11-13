import Link from 'next/link';
import ConfirmSubmit from '@/components/ConfirmSubmit';
import {
  createBackupAction,
  deleteBackupAction,
  importBackupAction,
  restoreBackupAction,
  saveAutoBackupAction,
} from '@/app/actions/backups';
import { requireAdmin } from '@/lib/auth';
import {
  KIND_LABELS,
  STATUS_LABELS,
  getBackupSettings,
  listBackups,
  maybeRunAutomaticBackup,
} from '@/lib/backups';
import { formatBytes, formatDateTime, timeAgo } from '@/lib/format';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Copias de seguridad' };

function statusTone(status: string): string {
  if (status === 'completa') return 'badge badge-success';
  if (status === 'incompleta') return 'badge badge-warning';
  return 'badge badge-danger';
}

export default async function AdminBackupsPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  await requireAdmin('/admin/backups');
  const params = await searchParams;

  // Si toca una copia automática, se crea al entrar al panel.
  try {
    await maybeRunAutomaticBackup();
  } catch {
    // Si falla, se reintenta en la próxima visita o con el temporizador.
  }

  const backups = listBackups();
  const settings = getBackupSettings();
  const totalBytes = backups.reduce((sum, backup) => sum + backup.size_bytes, 0);
  const lastBackup = backups[0] ?? null;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-black text-white">Copias de seguridad</h1>
        <p className="text-sm text-slate-400">
          Guarda, descarga y restaura toda la tienda: productos, categorías, imágenes y URL, precios,
          stock, usuarios, saldos, pedidos, comprobantes y configuraciones.
        </p>
      </div>

      {params.ok ? <p className="alert alert-ok">{params.ok}</p> : null}
      {params.error ? <p className="alert alert-error">{params.error}</p> : null}

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Copia manual */}
        <section className="panel space-y-3 p-4">
          <h2 className="text-sm font-bold text-white">Copia manual</h2>
          <p className="text-xs text-slate-400">
            Crea ahora una copia completa. Se guarda en Supabase y se verifica su integridad antes de
            darla por buena.
          </p>
          <p className="text-xs text-slate-500">
            Última copia: <span className="text-slate-300">{formatDateTime(lastBackup?.created_at)}</span>
            {lastBackup ? <span className="text-slate-500"> ({timeAgo(lastBackup.created_at)})</span> : null}
          </p>
          <form action={createBackupAction}>
            <button type="submit" className="btn btn-primary btn-sm w-full">
              Crear copia de seguridad
            </button>
          </form>
        </section>

        {/* Copias automáticas */}
        <section className="panel space-y-3 p-4">
          <h2 className="text-sm font-bold text-white">Copias automáticas</h2>
          <form action={saveAutoBackupAction} className="space-y-3">
            <label className="flex items-center gap-2 text-xs text-slate-300">
              <input type="checkbox" name="auto_enabled" defaultChecked={settings.enabled} />
              Activar copias automáticas
            </label>
            <label className="field">
              <span>Frecuencia</span>
              <select name="frequency" defaultValue={settings.frequency}>
                <option value="diaria">Diaria (cada 24 horas)</option>
                <option value="semanal">Semanal (cada 7 días)</option>
              </select>
            </label>
            <button type="submit" className="btn btn-outline btn-sm w-full">
              Guardar programación
            </button>
          </form>
          <p className="text-xs text-slate-500">
            Última automática: <span className="text-slate-300">{formatDateTime(settings.lastRunAt)}</span>
          </p>
        </section>

        {/* Importar */}
        <section className="panel space-y-3 p-4">
          <h2 className="text-sm font-bold text-white">Importar una copia</h2>
          <p className="text-xs text-slate-400">
            Sube un archivo JSON descargado antes. Se añade al historial como copia importada y luego
            puedes restaurarla.
          </p>
          <form action={importBackupAction} className="space-y-3">
            <input
              type="file"
              name="file"
              accept="application/json,.json"
              className="w-full text-xs text-slate-300"
              required
            />
            <button type="submit" className="btn btn-outline btn-sm w-full">
              Importar archivo JSON
            </button>
          </form>
        </section>
      </div>

      <p className="text-xs text-slate-500">
        {backups.length} copias · {formatBytes(totalBytes)} en total · Las copias se guardan en Supabase
        junto con los comprobantes. Las sesiones y los intentos de acceso no se copian por seguridad.
      </p>

      <div className="panel overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              <th>Copia</th>
              <th>Fecha y hora</th>
              <th>Tamaño</th>
              <th>Tipo</th>
              <th>Estado</th>
              <th>Registros</th>
              <th className="text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {backups.map((backup) => (
              <tr key={backup.id}>
                <td>
                  <p className="text-sm font-semibold text-white">{backup.name}</p>
                  {backup.note ? (
                    <p className="text-[0.7rem] text-slate-500">{backup.note}</p>
                  ) : null}
                </td>
                <td className="whitespace-nowrap text-[0.7rem] text-slate-400">
                  {formatDateTime(backup.created_at)}
                </td>
                <td className="whitespace-nowrap text-slate-300">{formatBytes(backup.size_bytes)}</td>
                <td>
                  <span className="badge badge-info">{KIND_LABELS[backup.kind] ?? backup.kind}</span>
                </td>
                <td>
                  <span className={statusTone(backup.status)}>
                    {STATUS_LABELS[backup.status] ?? backup.status}
                  </span>
                </td>
                <td className="whitespace-nowrap text-[0.7rem] text-slate-400">
                  {backup.rows_count} en {backup.tables_count} tablas
                </td>
                <td>
                  <div className="flex flex-wrap justify-end gap-2">
                    <form action={restoreBackupAction}>
                      <input type="hidden" name="backup_id" value={backup.id} />
                      <input type="hidden" name="confirm" value="si" />
                      <ConfirmSubmit
                        className="btn btn-primary btn-xs"
                        message={`¿Restaurar «${backup.name}»?\n\nSe reemplazarán los datos actuales de la tienda por los de esta copia. Antes se guardará automáticamente una copia del estado actual, así que podrás volver atrás.`}
                      >
                        Restaurar
                      </ConfirmSubmit>
                    </form>
                    <Link
                      href={`/admin/backups/${backup.id}/descargar`}
                      className="btn btn-ghost btn-xs"
                      prefetch={false}
                    >
                      Descargar
                    </Link>
                    <form action={deleteBackupAction}>
                      <input type="hidden" name="backup_id" value={backup.id} />
                      <input type="hidden" name="confirm" value="si" />
                      <ConfirmSubmit
                        className="btn btn-danger btn-xs"
                        message={`¿Eliminar la copia «${backup.name}»?\n\nEsta acción no se puede deshacer. Las demás copias se conservan.`}
                      >
                        Eliminar
                      </ConfirmSubmit>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
            {backups.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-6 text-center text-sm text-slate-400">
                  Todavía no hay copias. Usa «Crear copia de seguridad» para guardar la primera.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-slate-500">
        Restaurar recupera los datos tal como estaban al crear la copia, sin duplicar registros: cada
        tabla se reemplaza por su contenido guardado. La copia previa queda en el historial para
        deshacer cualquier restauración.
      </p>
    </div>
  );
}
