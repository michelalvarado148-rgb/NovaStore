import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { describeDevice, listSubscriptions, removeSubscription, saveSubscription } from '@/lib/push';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Body = {
  subscription?: {
    endpoint?: string;
    keys?: { p256dh?: string; auth?: string };
  };
  endpoint?: string;
  remove?: boolean;
};

/** Alta y baja del dispositivo autorizado. Exclusivo del administrador. */
/** Sin sesión de administrador no se revela nada; con sesión se indica el método correcto. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }
  return NextResponse.json(
    { error: 'Usa POST para autorizar o eliminar el dispositivo' },
    { status: 405 },
  );
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: 'Solicitud inválida.' }, { status: 400 });
  }

  if (body.remove) {
    if (!body.endpoint) {
      return NextResponse.json({ error: 'Falta el dispositivo a eliminar.' }, { status: 400 });
    }
    const deviceCount = removeSubscription(body.endpoint);
    return NextResponse.json({ ok: true, deviceCount });
  }

  const subscription = body.subscription;
  if (!subscription?.endpoint || !subscription.keys?.p256dh || !subscription.keys?.auth) {
    return NextResponse.json({ error: 'Suscripción inválida.' }, { status: 400 });
  }

  const result = saveSubscription({
    endpoint: subscription.endpoint,
    keys: { p256dh: subscription.keys.p256dh, auth: subscription.keys.auth },
    device: describeDevice(request.headers.get('user-agent')),
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    deviceCount: result.deviceCount,
    devices: listSubscriptions().length,
  });
}
