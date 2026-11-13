/**
 * Comprobación de la persistencia de NOVASTORE en Supabase.
 *
 * Uso: DATABASE_PATH=/tmp/nova-check.db npx tsx scripts/persistence-check.ts
 *
 * Arranca la base igual que el servidor (restaura desde Supabase y replica las
 * escrituras) e informa del contenido local resultante.
 */
import { getDb, warmPersistence } from '../src/lib/db';

async function main(): Promise<void> {
  await warmPersistence();
  const db = getDb();

  const count = (table: string): number => {
    const row = db.prepare(`select count(*) as n from ${table}`).get() as { n: number };
    return row.n;
  };

  const marker = db
    .prepare("select name from categories where slug = 'prueba-restauracion'")
    .get() as { name: string } | undefined;

  console.log(
    JSON.stringify({
      db_path: process.env.DATABASE_PATH ?? '(por defecto)',
      categories: count('categories'),
      products: count('products'),
      variants: count('product_variants'),
      settings: count('settings'),
      payment_methods: count('payment_methods'),
      marker: marker?.name ?? null,
    }),
  );

  // Espera al vaciado de la cola de sincronización antes de salir.
  await new Promise((resolve) => setTimeout(resolve, 2500));
  db.close();
}

main().catch((error) => {
  console.error('FALLO:', error instanceof Error ? error.message : error);
  process.exit(1);
});
