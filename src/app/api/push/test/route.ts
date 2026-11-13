import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { sendAdminPush } from '@/lib/push';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Aviso de prueba solicitado por el administrador para comprobar su teléfono. */
export async function POST() {
  const user = await getCurrentUser();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const result = await sendAdminPush({
    key: `prueba:${Date.now()}`,
    kind: 'prueba',
    title: '🔔 NOTIFICACIONES ACTIVAS',
    body: 'Aviso de prueba de NOVASTORE. Recibirás aquí los pedidos, recargas y comprobantes.',
    url: '/admin/notificaciones',
    tag: 'prueba',
  });

  return NextResponse.json(result, { status: result.ok ? 200 : 409 });
}
