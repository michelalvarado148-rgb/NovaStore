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

  // Copias automáticas: se revisa cada hora si ya venció el intervalo
  // configurado (diario o semanal) y, de ser así, se crea la copia.
  const tick = async () => {
    try {
      const { maybeRunAutomaticBackup, prepareBackups } = await import('./lib/backups');
      await prepareBackups();
      await maybeRunAutomaticBackup();
    } catch (error) {
      console.warn(
        '[novastore] no se pudo ejecutar la copia automática:',
        error instanceof Error ? error.message : String(error),
      );
    }
  };

  setTimeout(tick, 60_000);
  setInterval(tick, 60 * 60 * 1000).unref?.();
}
