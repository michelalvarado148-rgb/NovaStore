/**
 * Regresión del MODO MANTENIMIENTO de NOVASTORE.
 *
 * Arranca la app compilada (`next start`) contra una base temporal sembrada y
 * comprueba, en el servidor:
 *   1. Con el mantenimiento apagado la tienda funciona normal.
 *   2. Al activarlo, todas las rutas de cliente muestran la pantalla de
 *      mantenimiento (aunque se entre por enlace directo).
 *   3. /login y /admin siguen disponibles para el administrador, que además
 *      sigue viendo la tienda.
 *   4. El estado persiste en la tabla settings (base de datos) y las acciones
 *      de compra quedan bloqueadas.
 *   5. Al desactivarlo todo vuelve a funcionar sin perder datos.
 */
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const PORT = 3311;
const BASE = `http://127.0.0.1:${PORT}`;
const COOKIE = 'nova_session';
const MAINTENANCE_TITLE = 'Estamos mejorando NOVASTORE';

let failures = 0;

function check(label: string, condition: boolean, extra = '') {
  if (condition) {
    console.log(`  ✓ ${label}`);
  } else {
    failures += 1;
    console.log(`  ✗ ${label}${extra ? ` — ${extra}` : ''}`);
  }
}

async function waitForServer(timeoutMs = 90000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${BASE}/login`, { redirect: 'manual' });
      if (res.status > 0) return;
    } catch {
      /* aún arrancando */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error('El servidor de prueba no arrancó a tiempo.');
}

async function get(path: string, token?: string) {
  const res = await fetch(`${BASE}${path}`, {
    headers: token ? { Cookie: `${COOKIE}=${token}` } : {},
    redirect: 'manual',
  });
  const body = await res.text();
  return { status: res.status, body };
}

async function main() {
  const dir = mkdtempSync(join(tmpdir(), 'novastore-maint-'));
  process.env.DATABASE_PATH = join(dir, 'test.db');
  process.env.NOVASTORE_DISABLE_SYNC = '1';

  const { getDb, hashToken } = await import('../src/lib/db');
  const { getMaintenanceConfig, saveMaintenanceConfig, MAINTENANCE_KEY, DEFAULT_MAINTENANCE_MESSAGE } =
    await import('../src/lib/maintenance');

  const db = getDb() as ReturnType<typeof getDb>;

  const tableColumns = (table: string) =>
    new Set(
      (db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]).map((c) => c.name),
    );

  const insert = (table: string, values: Record<string, unknown>) => {
    const cols = tableColumns(table);
    const entries = Object.entries(values).filter(([key]) => cols.has(key));
    const sql = `INSERT INTO ${table} (${entries.map(([k]) => k).join(',')}) VALUES (${entries
      .map(() => '?')
      .join(',')})`;
    return db
      .prepare(sql)
      .run(...entries.map(([, value]) => value as never)).lastInsertRowid as number;
  };

  const now = new Date().toISOString();
  const expires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  const adminId = insert('users', {
    name: 'Admin Prueba',
    email: `admin-${Date.now()}@novastore.test`,
    phone: '999000111',
    password_hash: 'x',
    role: 'admin',
    balance_cents: 0,
    is_active: 1,
    created_at: now,
  });

  const customerId = insert('users', {
    name: 'Cliente Prueba',
    email: `cliente-${Date.now()}@novastore.test`,
    phone: '999000222',
    password_hash: 'x',
    role: 'customer',
    balance_cents: 50000,
    is_active: 1,
    created_at: now,
  });

  const adminToken = 'maint-admin-token';
  const customerToken = 'maint-customer-token';
  insert('sessions', {
    token_hash: hashToken(adminToken),
    user_id: adminId,
    expires_at: expires,
    created_at: now,
  });
  insert('sessions', {
    token_hash: hashToken(customerToken),
    user_id: customerId,
    expires_at: expires,
    created_at: now,
  });

  const productsBefore = (
    db.prepare('SELECT COUNT(*) AS c FROM products').get() as { c: number }
  ).c;

  // Estado inicial limpio.
  saveMaintenanceConfig({ enabled: false, message: '', imageUrl: '', returnAt: '' });

  const server: ChildProcess = spawn(
    'npx',
    ['next', 'start', '-H', '127.0.0.1', '-p', String(PORT)],
    { env: { ...process.env, PORT: String(PORT) }, stdio: 'ignore' },
  );

  try {
    await waitForServer();

    console.log('\nCon la tienda abierta');
    const homeOpen = await get('/');
    check('la portada responde 200', homeOpen.status === 200, `status ${homeOpen.status}`);
    check('la portada no muestra mantenimiento', !homeOpen.body.includes(MAINTENANCE_TITLE));

    console.log('\nActivación del mantenimiento');
    const saved = saveMaintenanceConfig({
      enabled: true,
      message: 'Estamos renovando el catálogo. Volvemos en unas horas.',
      imageUrl: '',
      returnAt: '2026-12-01T18:30',
    });
    check('la configuración se guarda', saved.ok === true, saved.ok ? '' : saved.error);

    const storedRow = db
      .prepare('SELECT value FROM settings WHERE key = ?')
      .get(MAINTENANCE_KEY) as { value: string } | undefined;
    check('el estado queda persistido en la base de datos', Boolean(storedRow?.value));
    check(
      'la base de datos registra el mantenimiento activo',
      Boolean(storedRow?.value?.includes('"enabled":true')),
    );
    check('la configuración se relee igual', getMaintenanceConfig().enabled === true);

    console.log('\nLos clientes quedan bloqueados');
    const homeClosed = await get('/', customerToken);
    check('la portada muestra la pantalla de mantenimiento', homeClosed.body.includes(MAINTENANCE_TITLE));
    check(
      'se muestra el mensaje personalizado del administrador',
      homeClosed.body.includes('Estamos renovando el catálogo'),
    );
    check('se muestra la fecha de regreso', homeClosed.body.includes('Regreso estimado'));

    const blockedRoutes = [
      ['/productos', 'catálogo'],
      ['/carrito', 'carrito'],
      ['/checkout', 'checkout'],
      ['/cuenta', 'cuenta'],
      ['/cuenta/saldo', 'añadir saldo'],
      ['/cuenta/pedidos', 'mis compras'],
      ['/cuenta/soporte', 'soporte'],
      ['/pedido/NOVA-0000', 'detalle de pedido'],
      ['/contacto', 'contacto'],
      ['/registro', 'registro'],
    ] as const;

    for (const [path, label] of blockedRoutes) {
      const res = await get(path, customerToken);
      check(
        `${label} (${path}) queda bloqueado por enlace directo`,
        res.status === 200 && res.body.includes(MAINTENANCE_TITLE),
        `status ${res.status}`,
      );
    }

    const anonHome = await get('/');
    check('un visitante sin sesión también ve el mantenimiento', anonHome.body.includes(MAINTENANCE_TITLE));

    console.log('\nEl administrador conserva el acceso');
    const adminPanel = await get('/admin', adminToken);
    check('el panel admin responde 200', adminPanel.status === 200, `status ${adminPanel.status}`);
    check('el panel admin no muestra mantenimiento', !adminPanel.body.includes(MAINTENANCE_TITLE));
    check('el panel admin muestra su resumen', adminPanel.body.includes('Resumen'));

    const adminMaintenancePage = await get('/admin/mantenimiento', adminToken);
    check('la sección Modo mantenimiento abre', adminMaintenancePage.body.includes('Modo mantenimiento'));

    const adminStore = await get('/', adminToken);
    check('el administrador sigue viendo la tienda', !adminStore.body.includes(MAINTENANCE_TITLE));

    const loginPage = await get('/login');
    check('el inicio de sesión sigue disponible', loginPage.status === 200 && loginPage.body.includes('Iniciar sesión'));

    console.log('\nLas acciones del servidor están bloqueadas');
    const { guardStoreOpen } = await import('../src/lib/maintenance');
    let guardThrew = false;
    try {
      await guardStoreOpen();
    } catch {
      guardThrew = true;
    }
    check('una acción de compra sin sesión de admin se redirige al mantenimiento', guardThrew);

    console.log('\nValidaciones de seguridad');
    const badImage = saveMaintenanceConfig({
      enabled: true,
      message: 'x',
      imageUrl: 'https://sitio-externo.example/banner.png',
      returnAt: '',
    });
    check('se rechaza una imagen externa no permitida', badImage.ok === false);
    const badDate = saveMaintenanceConfig({
      enabled: true,
      message: 'x',
      imageUrl: '',
      returnAt: 'mañana',
    });
    check('se rechaza una fecha de regreso inválida', badDate.ok === false);
    check('la configuración sigue activa tras los rechazos', getMaintenanceConfig().enabled === true);

    console.log('\nMensaje por defecto');
    saveMaintenanceConfig({ enabled: true, message: '   ', imageUrl: '', returnAt: '' });
    const fallback = await get('/', customerToken);
    check('sin mensaje propio se usa el mensaje estándar', fallback.body.includes('Estamos realizando mejoras'));

    console.log('\nDesactivación');
    saveMaintenanceConfig({ enabled: false, message: '', imageUrl: '', returnAt: '' });
    const homeBack = await get('/', customerToken);
    check('la tienda vuelve a abrir', !homeBack.body.includes(MAINTENANCE_TITLE));
    check('la portada responde 200 tras desactivar', homeBack.status === 200);
    const accountBack = await get('/cuenta', customerToken);
    check('la cuenta del cliente vuelve a estar disponible', !accountBack.body.includes(MAINTENANCE_TITLE));

    const productsAfter = (
      db.prepare('SELECT COUNT(*) AS c FROM products').get() as { c: number }
    ).c;
    check(
      'los productos no se modificaron',
      productsAfter === productsBefore,
      `${productsBefore} → ${productsAfter}`,
    );
    const customerRow = db
      .prepare('SELECT balance_cents FROM users WHERE id = ?')
      .get(customerId) as { balance_cents: number };
    check('el saldo del cliente se conserva', customerRow.balance_cents === 50000);
    check(
      'el mensaje estándar es el solicitado',
      DEFAULT_MAINTENANCE_MESSAGE.includes('¡Volveremos pronto!'),
    );
  } finally {
    server.kill('SIGTERM');
    await new Promise((r) => setTimeout(r, 500));
  }

  if (failures > 0) {
    console.log(`\n${failures} comprobaciones fallaron.`);
    process.exit(1);
  }
  console.log('\nTodas las comprobaciones del modo mantenimiento pasaron.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
