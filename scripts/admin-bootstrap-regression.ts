/**
 * Regresión del arranque del administrador (ensureAdmin).
 *
 * El acceso al panel no puede depender de lo que quedó guardado en una base
 * anterior: la base SQLite vive en el contenedor y se recrea al desplegar. Estas
 * comprobaciones fijan las tres reglas del arranque:
 *
 *  1. Sin variables de entorno y sin administrador: se crea con la contraseña
 *     por defecto del código.
 *  2. Con ADMIN_PASSWORD definido: un administrador ya existente se sincroniza
 *     (correo y contraseña), que es lo que garantiza el acceso tras cada
 *     redespliegue.
 *  3. Sin ADMIN_PASSWORD: la contraseña que cambió el dueño no se sobrescribe.
 *
 * Además, un correo ya ocupado por otra cuenta no debe romper el arranque ni
 * convertir a ese cliente en administrador.
 *
 * Ejecuta: npm run test:bootstrap
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

let total = 0;
let failures = 0;

function check(label: string, condition: boolean, detail = ''): void {
  total += 1;
  if (condition) {
    console.log(`PASS  ${label}`);
  } else {
    failures += 1;
    console.log(`FAIL  ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

async function main(): Promise<void> {
  // Base de datos temporal: no toca los datos reales de la tienda.
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'novastore-admin-'));
  process.env.DATABASE_PATH = path.join(tmpDir, 'admin.db');
  delete process.env.ADMIN_EMAIL;
  delete process.env.ADMIN_PASSWORD;
  delete process.env.ADMIN_PHONE;

  const { getDb, ensureAdmin, hashPassword, verifyPassword, DEFAULT_ADMIN_PASSWORD } =
    await import('../src/lib/db');

  const db = getDb();

  type AdminRow = { id: number; email: string; password_hash: string };
  const admin = () =>
    db
      .prepare("SELECT id, email, password_hash FROM users WHERE role = 'admin' ORDER BY id LIMIT 1")
      .get() as AdminRow | undefined;

  // 1. Sembrado inicial sin variables de entorno.
  const seeded = admin();
  check('se crea el administrador al inicializar la base', Boolean(seeded));
  check(
    'la contraseña inicial es la de por defecto',
    Boolean(seeded) && verifyPassword(DEFAULT_ADMIN_PASSWORD, seeded!.password_hash),
  );
  check(
    'el correo inicial es el documentado',
    seeded?.email === 'admin@novastore.pe',
    String(seeded?.email),
  );

  // 2. ADMIN_PASSWORD definido: el administrador existente se sincroniza.
  process.env.ADMIN_EMAIL = 'dueno@novastore.pe';
  process.env.ADMIN_PASSWORD = 'ClaveNuevaDePrueba!2026';
  ensureAdmin(db);

  const synced = admin();
  check(
    'el correo se actualiza desde ADMIN_EMAIL',
    synced?.email === 'dueno@novastore.pe',
    String(synced?.email),
  );
  check(
    'la contraseña se actualiza desde ADMIN_PASSWORD',
    Boolean(synced) && verifyPassword('ClaveNuevaDePrueba!2026', synced!.password_hash),
  );
  check(
    'la contraseña por defecto deja de valer',
    Boolean(synced) && !verifyPassword(DEFAULT_ADMIN_PASSWORD, synced!.password_hash),
  );
  check(
    'no se duplica el administrador',
    (
      db.prepare("SELECT COUNT(*) AS total FROM users WHERE role = 'admin'").get() as {
        total: number;
      }
    ).total === 1,
  );

  // 3. Sin variables de entorno: no se pisa la contraseña del dueño.
  delete process.env.ADMIN_EMAIL;
  delete process.env.ADMIN_PASSWORD;
  db.prepare("UPDATE users SET password_hash = ? WHERE role = 'admin'").run(
    hashPassword('ClaveDelDueno!2026'),
  );
  ensureAdmin(db);

  const owned = admin();
  check(
    'sin ADMIN_PASSWORD se respeta la contraseña cambiada por el dueño',
    Boolean(owned) && verifyPassword('ClaveDelDueno!2026', owned!.password_hash),
  );

  // 4. Correo ocupado por otra cuenta: no rompe el arranque ni cambia roles.
  db.prepare(
    `INSERT INTO users (name, email, password_hash, phone, role, balance_cents, is_active, created_at, updated_at)
     VALUES ('Cliente Ocupado', 'ocupado@novastore.pe', ?, NULL, 'customer', 0, 1, ?, ?)`,
  ).run(hashPassword('ClienteClave1!'), '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z');

  process.env.ADMIN_EMAIL = 'ocupado@novastore.pe';
  process.env.ADMIN_PASSWORD = 'OtraClaveAdmin!2026';

  let threw = false;
  try {
    ensureAdmin(db);
  } catch {
    threw = true;
  }
  check('un correo ocupado no lanza excepción', threw === false);

  const afterCollision = admin();
  check(
    'se conserva el correo del administrador si el nuevo está ocupado',
    afterCollision?.email === 'dueno@novastore.pe',
    String(afterCollision?.email),
  );
  check(
    'aun así se aplica la contraseña de ADMIN_PASSWORD',
    Boolean(afterCollision) && verifyPassword('OtraClaveAdmin!2026', afterCollision!.password_hash),
  );
  check(
    'la cuenta del cliente no cambia de rol',
    (
      db.prepare("SELECT role FROM users WHERE email = 'ocupado@novastore.pe'").get() as {
        role: string;
      }
    ).role === 'customer',
  );

  console.log('');
  if (failures > 0) {
    console.log(`Fallaron ${failures} de ${total} comprobaciones.`);
    process.exit(1);
  }
  console.log(`Las ${total} comprobaciones del arranque del administrador pasaron.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
