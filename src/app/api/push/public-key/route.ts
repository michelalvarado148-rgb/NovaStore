import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getVapidKeys, isPushEnabled, listSubscriptions } from '@/lib/push';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Clave pública VAPID: solo el administrador puede pedirla. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  return NextResponse.json({
    key: getVapidKeys().publicKey,
    enabled: isPushEnabled(),
    deviceCount: listSubscriptions().length,
  });
}
