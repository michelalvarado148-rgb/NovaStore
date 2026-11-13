import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { readBackupJson } from '@/lib/backups';

export const dynamic = 'force-dynamic';

/**
 * Descarga una copia de seguridad en JSON.
 * Solo administradores: un cliente recibe 401 y nunca ve el contenido.
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const user = await getCurrentUser();
  if (!user || user.role !== 'admin' || !user.is_active) {
    return new NextResponse('No autorizado', { status: 401 });
  }

  const { id } = await context.params;
  const backupId = Number(id);
  if (!Number.isInteger(backupId) || backupId <= 0) {
    return new NextResponse('Copia no válida', { status: 400 });
  }

  const result = readBackupJson(backupId);
  if (!result.ok) {
    return new NextResponse(result.error, { status: 404 });
  }

  return new NextResponse(result.json, {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'content-disposition': `attachment; filename="${result.fileName}"`,
      'cache-control': 'no-store',
    },
  });
}
