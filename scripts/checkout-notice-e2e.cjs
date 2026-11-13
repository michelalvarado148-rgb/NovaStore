/**
 * Comprobación end-to-end de avisos y requisitos por producto (NOVASTORE).
 *
 * Arranca la app compilada con una base temporal sembrada, recorre el checkout
 * como cliente real y verifica:
 *   1. El aviso aparece al pulsar «Confirmar pedido».
 *   2. Sin el dato obligatorio no se puede confirmar.
 *   3. Al completar el dato, el pedido se crea con el ID guardado.
 */
const { spawn, execSync } = require('node:child_process');
const fs = require('node:fs');
const { chromium } = require('/opt/appjet/browser/node_modules/playwright');

const PORT = 3418;
const BASE = `http://127.0.0.1:${PORT}`;
const DB = '/tmp/notices-ui.db';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function check(ok, label) {
  if (!ok) throw new Error(`FALLO: ${label}`);
  console.log(`  ✓ ${label}`);
}

function sql(query) {
  return execSync(`sqlite3 ${DB} "${query}"`, { encoding: 'utf8' }).trim();
}

(async () => {
  const ordersBefore = Number(sql('select count(*) from orders;'));
  check(ordersBefore === 0, 'la base de prueba empieza sin pedidos');

  const srv = spawn('npx', ['next', 'start', '-p', String(PORT)], {
    cwd: '/workspace/NovaStore',
    env: { ...process.env, DATABASE_PATH: DB, NOVASTORE_DISABLE_SYNC: '1' },
    stdio: 'ignore',
    detached: true,
  });
  await sleep(7000);

  const browser = await chromium.launch();
  try {
    const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));

    await page.goto(`${BASE}/login`);
    await page.fill('input[name="email"]', 'cliente@novastore.test');
    await page.fill('input[name="password"]', 'Prueba1234');
    await page.click('button[type="submit"]');
    await page.getByRole('button', { name: 'Salir' }).waitFor({ timeout: 15000 });
    check(true, 'el cliente inicia sesión');

    await page.goto(`${BASE}/checkout`);
    await page.getByRole('button', { name: 'Confirmar pedido' }).first().waitFor({ timeout: 15000 });
    check(await page.getByText('Este pedido tiene un aviso que debes leer').isVisible(), 'el checkout anuncia que hay un aviso');

    // El teléfono es obligatorio en el checkout.
    await page.fill('#contact_phone', '987654321');

    await page.getByRole('button', { name: 'Confirmar pedido' }).first().click();
    const dialog = page.locator('div[role="dialog"]');
    await dialog.waitFor({ timeout: 10000 });
    check(true, 'el aviso se abre antes de confirmar');
    check(await dialog.getByText('ID de Free Fire', { exact: false }).first().isVisible(), 'muestra el dato solicitado (ID de Free Fire)');
    check(await dialog.getByText('Tiempo estimado: 5 a 15 minutos').isVisible(), 'muestra el tiempo de entrega configurado');

    const dialogConfirm = dialog.locator('button.btn-primary');
    check(await dialogConfirm.isDisabled(), 'no permite confirmar sin el dato obligatorio');
    check(await dialog.getByText('Completa los datos obligatorios para continuar.').isVisible(), 'explica qué falta para continuar');

    await dialog.locator('input[type="checkbox"]').check();
    await dialog.getByRole('textbox', { name: 'ID de Free Fire*' }).fill('123456789');
    await sleep(300);
    check(await dialogConfirm.isEnabled(), 'habilita la confirmación al completar el dato');

    await dialogConfirm.click();
    await page.waitForURL(/\/pedido\//, { timeout: 20000 });
    check(true, 'el pedido se registra y abre su página');

    const body = await page.locator('body').innerText();
    check(body.includes('123456789'), 'la página del pedido muestra el ID ingresado');
    check(body.includes('Diamantes Free Fire 100'), 'la página del pedido muestra el producto');

    const orders = Number(sql('select count(*) from orders;'));
    check(orders === 1, 'se creó exactamente un pedido (sin duplicados)');

    const stored = sql("select value from settings where key like 'order_inputs:%' limit 1;");
    check(stored.includes('123456789') && stored.includes('ID de Free Fire'), 'el dato quedó guardado en la base con su etiqueta');

    const balance = Number(sql("select balance_cents from users where email='cliente@novastore.test';"));
    check(balance === 48800, 'el saldo se descontó una sola vez (S/ 500.00 → S/ 488.00)');

    const items = Number(sql('select count(*) from cart_items;'));
    check(items === 0, 'el carrito quedó vacío tras la compra');

    check(errors.length === 0, 'sin errores de JavaScript en la página');
    console.log('Todas las comprobaciones de avisos en el checkout pasaron.');
  } finally {
    await browser.close();
    try { process.kill(-srv.pid, 'SIGKILL'); } catch {}
  }
  process.exit(0);
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
