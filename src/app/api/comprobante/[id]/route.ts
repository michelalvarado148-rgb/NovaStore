import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getProofForAccess } from '@/lib/orders';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const { id } = await params;
  const proofId = Number(id);
  if (!Number.isInteger(proofId) || proofId <= 0) {
    return NextResponse.json({ error: 'Comprobante inválido' }, { status: 400 });
  }

  const proof = getProofForAccess(proofId);
  if (!proof) {
    return NextResponse.json({ error: 'Comprobante no encontrado' }, { status: 404 });
  }

  // Aislamiento de datos: solo el dueño del pedido o un administrador.
  if (user.role !== 'admin' && proof.user_id !== user.id) {
    return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 });
  }

  return new NextResponse(new Uint8Array(proof.data), {
    status: 200,
    headers: {
      'Content-Type': proof.mime_type,
      'Content-Disposition': 'inline; filename="comprobante"',
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
