import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getRechargeProof } from '@/lib/recharge';

export const dynamic = 'force-dynamic';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const { id } = await params;
  const proofId = Number(id);
  if (!Number.isInteger(proofId) || proofId <= 0) {
    return NextResponse.json({ error: 'Comprobante inválido' }, { status: 400 });
  }

  // Aislamiento de datos: solo el dueño de la solicitud o un administrador.
  const proof = getRechargeProof(proofId, { id: user.id, role: user.role });
  if (!proof) {
    return NextResponse.json({ error: 'Comprobante no encontrado' }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(proof.data), {
    status: 200,
    headers: {
      'Content-Type': proof.mime_type,
      'Content-Disposition': 'inline; filename="comprobante-recarga"',
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
