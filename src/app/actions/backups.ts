'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/auth';
import {
  createBackup,
  deleteBackup,
  flushBackups,
  importBackup,
  maybeRunAutomaticBackup,
  restoreBackup,
  saveBackupSettings,
} from '@/lib/backups';
import { formatBytes } from '@/lib/format';

const PAGE = '/admin/backups';
const MAX_IMPORT_BYTES = 30 * 1024 * 1024;

function finish(message: string, tone: 'ok' | 'error' = 'error'): never {
  revalidatePath(PAGE);
  redirect(`${PAGE}?${tone}=${encodeURIComponent(message)}`);
}

/** Botón «Crear copia de seguridad». */
export async function createBackupAction(): Promise<void> {
  const admin = await requireAdmin(PAGE);
  const result = await createBackup({ kind: 'manual', origin: 'panel', createdBy: admin.id });
  if (!result.ok) finish(`No se pudo crear la copia: ${result.error}`);
  finish(
    `Copia «${result.backup.name}» creada y verificada (${formatBytes(result.backup.size_bytes)}, ${
      result.backup.rows_count
    } registros).`,
    'ok',
  );
}

/** Botón «Restaurar copia»: exige confirmación explícita desde el formulario. */
export async function restoreBackupAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin(PAGE);
  const id = Number(formData.get('backup_id'));
  const confirm = String(formData.get('confirm') ?? '');

  if (!Number.isInteger(id) || id <= 0) finish('Selecciona una copia válida para restaurar.');
  if (confirm !== 'si') finish('La restauración necesita tu confirmación.');

  const result = await restoreBackup(id, admin.id);
  if (!result.ok) finish(result.error);

  finish(
    `Tienda restaurada: ${result.rows} registros en ${result.tables} tablas. Antes se guardó la copia previa «${result.safety}».`,
    'ok',
  );
}

/** Botón «Eliminar». */
export async function deleteBackupAction(formData: FormData): Promise<void> {
  await requireAdmin(PAGE);
  const id = Number(formData.get('backup_id'));
  const confirm = String(formData.get('confirm') ?? '');
  if (!Number.isInteger(id) || id <= 0) finish('La copia indicada no es válida.');
  if (confirm !== 'si') finish('El borrado necesita tu confirmación.');

  const result = await deleteBackup(id);
  if (!result.ok) finish(result.error ?? 'No se pudo eliminar la copia.');
  finish('Copia eliminada del historial y de Supabase.', 'ok');
}

/** Importa un archivo JSON descargado previamente. */
export async function importBackupAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin(PAGE);
  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) {
    finish('Selecciona un archivo JSON de copia de seguridad.');
  }
  if (file.size > MAX_IMPORT_BYTES) {
    finish('El archivo es demasiado grande (máximo 30 MB).');
  }

  const text = await file.text();
  const result = await importBackup(text, admin.id);
  if (!result.ok) finish(`No se pudo importar: ${result.error}`);

  finish(
    `Copia importada como «${result.backup.name}» (${result.backup.rows_count} registros). Ya puedes restaurarla cuando quieras.`,
    'ok',
  );
}

/** Guarda la programación de copias automáticas. */
export async function saveAutoBackupAction(formData: FormData): Promise<void> {
  await requireAdmin(PAGE);
  const enabled = formData.get('auto_enabled') === 'on';
  const frequency = formData.get('frequency') === 'semanal' ? 'semanal' : 'diaria';

  saveBackupSettings({ enabled, frequency });
  await flushBackups();

  const run = enabled ? await maybeRunAutomaticBackup() : { ran: false, reason: '' };
  if (run.ran) {
    finish(
      `Copias automáticas ${frequency}s activadas. Se creó ahora la primera copia porque no había una reciente.`,
      'ok',
    );
  }

  finish(
    enabled
      ? `Copias automáticas activadas con frecuencia ${frequency}.`
      : 'Copias automáticas desactivadas. Las copias existentes se conservan.',
    'ok',
  );
}
