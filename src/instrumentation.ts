/**
 * Arranque del servidor de NOVASTORE.
 *
 * Antes de atender la primera petición se restaura el contenido guardado en
 * Supabase, de modo que productos, usuarios, saldos, carritos y pedidos
 * sobrevivan a los despliegues del contenedor.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  if (process.env.NEXT_PHASE === 'phase-production-build') return;

  try {
    const { warmPersistence } = await import('./lib/db');
    await warmPersistence();
  } catch (error) {
    console.warn(
      '[novastore] no se pudo preparar la persistencia:',
      error instanceof Error ? error.message : String(error),
    );
  }
}
