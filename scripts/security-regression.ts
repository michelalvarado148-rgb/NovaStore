/**
 * Regresión del control de intentos de inicio de sesión.
 *
 * Comprueba que el bloqueo por fuerza bruta se guarda en SQLite (por lo tanto
 * sobrevive a un reinicio del contenedor), que no afecta a otras cuentas y que
 * un inicio de sesión correcto lo limpia.
 *
 * Ejecuta: npm run test:security
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
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'novastore-security-'));
  process.env.DATABASE_PATH = path.join(tmpDir, 'security.db');

  const { getDb } = await import('../src/lib/db');
  const { checkLoginRate, registerFailedLogin, clearLoginAttempts, MAX_LOGIN_ATTEMPTS } =
    await import('../src/lib/auth');

  const victim = 'victima@novastore.test';
  const other = 'otra@novastore.test';

  check('una cuenta sin fallos no está bloqueada', checkLoginRate(victim) === null);

  for (let i = 0; i < MAX_LOGIN_ATTEMPTS - 1; i += 1) {
    registerFailedLogin(victim);
  }
  check(
    `tras ${MAX_LOGIN_ATTEMPTS - 1} fallos todavía no hay bloqueo`,
    checkLoginRate(victim) === null,
  );

  registerFailedLogin(victim);
  const blocked = checkLoginRate(victim);
  check(
    `el fallo número ${MAX_LOGIN_ATTEMPTS} activa el bloqueo`,
    typeof blocked === 'string' && blocked.includes('Demasiados intentos fallidos'),
    String(blocked),
  );

  // El bloqueo vive en la base, no en la memoria del proceso.
  const row = getDb()
    .prepare('SELECT count, blocked_until FROM login_attempts WHERE key = ?')
    .get(victim) as { count: number; blocked_until: string | null } | undefined;
  check('el bloqueo queda guardado en SQLite', Boolean(row?.blocked_until), JSON.stringify(row));
  check(
    'el bloqueo guardado vence en el futuro',
    Boolean(row?.blocked_until && Date.parse(row.blocked_until) > Date.now()),
  );

  check('otra cuenta no queda bloqueada', checkLoginRate(other) === null);

  clearLoginAttempts(victim);
  check('un inicio de sesión correcto elimina el bloqueo', checkLoginRate(victim) === null);
  const afterClear = getDb()
    .prepare('SELECT COUNT(*) AS n FROM login_attempts WHERE key = ?')
    .get(victim) as { n: number };
  check('la fila de intentos se borra', afterClear.n === 0);

  // Un bloqueo vencido no debe arrastrar el contador anterior.
  registerFailedLogin(other);
  getDb()
    .prepare('UPDATE login_attempts SET blocked_until = ? WHERE key = ?')
    .run(new Date(Date.now() - 60_000).toISOString(), other);
  registerFailedLogin(other);
  const restarted = getDb()
    .prepare('SELECT count FROM login_attempts WHERE key = ?')
    .get(other) as { count: number } | undefined;
  check('al vencer el bloqueo el contador se reinicia', restarted?.count === 1, JSON.stringify(restarted));
  check('un bloqueo vencido ya no bloquea', checkLoginRate(other) === null);

  fs.rmSync(tmpDir, { recursive: true, force: true });
}

main()
  .then(() => {
    if (failures > 0) {
      console.error(`\n${failures} de ${total} comprobaciones fallaron.`);
      process.exit(1);
    }
    console.log(`\nLas ${total} comprobaciones de seguridad del login pasaron.`);
  })
  .catch((error) => {
    console.error('Error ejecutando la regresión de seguridad:', error);
    process.exit(1);
  });
