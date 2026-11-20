/**
 * Comprobación end-to-end del ID de jugador de Free Fire (NOVASTORE).
 *
 * Arranca la app compilada con una copia aislada de la base, recorre la compra
 * como cliente real y verifica:
 *   1. El campo «Ingresa tu ID de Free Fire» aparece solo en productos de Free Fire.
 *   2. Sin el ID no se puede continuar (no entra al carrito).
 *   3. El ID se guarda con el pedido.
 *   4. El panel administrativo muestra el ID en el detalle del pedido.
 */
const { spawn, execSync } = require('node:child_process');
const crypto = require('node:crypto');
const { chromium } = require('/opt/appjet/browser/node_modules/playwright');

const PORT = 3419;
const BASE = `http://127.0.0.1:${PORT}`;
const DB = '/tmp/freefire-id.db';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');

function check(ok, label) {
  if (!ok) throw new Error(`FALLO: ${label}`);
  console.log(`  ✓ ${label}`);
}

function sql(query) {
  return execSync(`sqlite3 ${DB} "${query}"`, { encoding: 'utf8' }).trim();
}

(async () => {
  // Copia aislada: no se toca la base real de la tienda.
  execSync(`sqlite3 /workspace/NovaStore/data/novastore.db ".backup ${DB}"`);
  sql(`UPDATE settings SET value=json_set(value,'$.enabled',json('false'))
       WHERE key LIKE '%antenimiento%' OR key LIKE '%aintenance%';`);
  sql(`DELETE FROM sessions;`);

  // Categoría Free Fire (subcategoría de Juegos) con su producto.
  sql(`DELETE FROM products WHERE slug IN ('ff-diamantes-100','streaming-prueba');`);
  sql(`DELETE FROM categories WHERE slug='free-fire';`);
  sql(`INSERT INTO categories (name, slug, description, image_url, position, is_active, created_at)
       VALUES ('Free Fire','free-fire','Recargas y pases de Free Fire',NULL,20,1,datetime('now'));`);
  const ffCat = Number(sql(`SELECT id FROM categories WHERE slug='free-fire';`));
  sql(`INSERT INTO settings (key, value) VALUES ('cat_parent:${ffCat}','1');`);
  sql(`INSERT INTO products (category_id, name, slug, description, image_url, price_cents, stock, is_active, is_featured, sold_count, created_at, updated_at)
       VALUES (${ffCat},'Diamantes Free Fire 100','ff-diamantes-100','Recarga de diamantes',NULL,1200,NULL,1,0,0,datetime('now'),datetime('now'));`);
  // Producto de otra categoría (Streaming) para comprobar que NO pide el ID.
  sql(`INSERT INTO products (category_id, name, slug, description, image_url, price_cents, stock, is_active, is_featured, sold_count, created_at, updated_at)
       VALUES (2,'Streaming Prueba 1 mes','streaming-prueba','Cuenta de streaming',NULL,1500,NULL,1,0,0,datetime('now'),datetime('now'));`);

  // Cliente con saldo y su sesión (sin depender de contraseñas).
  sql(`DELETE FROM users WHERE email='ff-cliente@novastore.test';`);
  sql(`INSERT INTO users (name,email,password_hash,phone,role,balance_cents,is_active,created_at,updated_at)
       VALUES ('Cliente FF','ff-cliente@novastore.test','x','987654321','customer',50000,1,datetime('now'),datetime('now'));`);
  const customerToken = crypto.randomBytes(16).toString('hex');
  sql(`INSERT INTO sessions (token_hash,user_id,user_agent,created_at,expires_at)
       VALUES ('${sha256(customerToken)}',(SELECT id FROM users WHERE email='ff-cliente@novastore.test'),'e2e',datetime('now'),datetime('now','+1 day'));`);

  // Administrador: se reutiliza el existente o se crea uno de prueba.
  const adminId = Number(
    sql(`SELECT COALESCE((SELECT id FROM users WHERE role='admin' LIMIT 1),0);`),
  );
  if (!adminId) {
    sql(`INSERT INTO users (name,email,password_hash,phone,role,balance_cents,is_active,created_at,updated_at)
         VALUES ('Admin FF','ff-admin@novastore.test','x',NULL,'admin',0,1,datetime('now'),datetime('now'));`);
  }
  const adminToken = crypto.randomBytes(16).toString('hex');
  sql(`INSERT INTO sessions (token_hash,user_id,user_agent,created_at,expires_at)
       VALUES ('${sha256(adminToken)}',${adminId || `(SELECT id FROM users WHERE email='ff-admin@novastore.test')`},'e2e',datetime('now'),datetime('now','+1 day'));`);

  const srv = spawn('npx', ['next', 'start', '-p', String(PORT)], {
    cwd: '/workspace/NovaStore',
    env: { ...process.env, DATABASE_PATH: DB, NOVASTORE_DISABLE_SYNC: '1' },
    stdio: 'ignore',
    detached: true,
  });
  await sleep(8000);

  const browser = await chromium.launch();
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await context.addCookies([{ name: 'nova_session', value: customerToken, url: BASE }]);
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));

    // 1) Producto de Free Fire: campo obligatorio visible con su indicación.
    await page.goto(`${BASE}/producto/ff-diamantes-100`);
    const ffInput = page.locator('#ff_player_id');
    await ffInput.waitFor({ timeout: 15000 });
    check(await ffInput.isVisible(), 'el producto de Free Fire muestra el campo de ID');
    check(
      await page.getByText('Ingresa tu ID de Free Fire').first().isVisible(),
      'el campo se titula «Ingresa tu ID de Free Fire»',
    );
    check(
      await page.getByText('Verifica que tu ID sea correcto').first().isVisible(),
      'muestra la indicación de verificar el ID',
    );
    check((await ffInput.getAttribute('required')) !== null, 'el campo es obligatorio en el navegador');

    // 2) Sin ID no se puede continuar: el navegador bloquea el envío.
    await page.getByRole('button', { name: 'Agregar al carrito' }).click();
    await sleep(1200);
    check(
      Number(sql('SELECT count(*) FROM cart_items;')) === 0,
      'sin el ID no se agrega nada al carrito',
    );

    // 3) Con ID válido sí continúa y queda recordado.
    await ffInput.fill('123456789');
    await page.getByRole('button', { name: 'Agregar al carrito' }).click();
    await sleep(2500);
    check(
      Number(sql('SELECT count(*) FROM cart_items;')) === 1,
      'con el ID se agrega el producto al carrito',
    );
    check(
      sql("SELECT value FROM settings WHERE key LIKE 'ff_player:%';").includes('123456789'),
      'el ID queda recordado en la cuenta del cliente',
    );

    // 4) Un producto que no es de Free Fire no pide el ID.
    await page.goto(`${BASE}/producto/streaming-prueba`);
    await page.getByRole('button', { name: 'Agregar al carrito' }).waitFor({ timeout: 15000 });
    check(
      (await page.locator('#ff_player_id').count()) === 0,
      'el producto de Streaming NO muestra el campo de ID',
    );

    // 5) Checkout: el aviso trae el ID ya rellenado y el pedido se registra.
    await page.goto(`${BASE}/checkout`);
    await page.getByRole('button', { name: 'Confirmar pedido' }).first().waitFor({ timeout: 15000 });
    await page.fill('#contact_phone', '987654321');
    await page.getByRole('button', { name: 'Confirmar pedido' }).first().click();
    const dialog = page.locator('div[role="dialog"]');
    await dialog.waitFor({ timeout: 10000 });
    const dialogInput = dialog.locator('input[type="text"]').first();
    check(
      (await dialogInput.inputValue()) === '123456789',
      'el checkout reutiliza el ID guardado en la cuenta',
    );
    await dialog.locator('input[type="checkbox"]').check();
    await dialog.locator('button.btn-primary').click();
    await page.waitForURL(/\/pedido\//, { timeout: 20000 });
    check(true, 'el pedido se registra y abre su página');

    const orderId = Number(sql('SELECT id FROM orders ORDER BY id DESC LIMIT 1;'));
    const stored = sql("SELECT value FROM settings WHERE key LIKE 'order_inputs:%' ORDER BY rowid DESC LIMIT 1;");
    check(
      stored.includes('123456789') && stored.includes('ID de Free Fire'),
      'el ID quedó guardado junto con el pedido',
    );

    // 6) Panel administrativo: el ID se ve claramente en el detalle del pedido.
    const adminContext = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    await adminContext.addCookies([{ name: 'nova_session', value: adminToken, url: BASE }]);
    const adminPage = await adminContext.newPage();
    await adminPage.goto(`${BASE}/admin/pedidos/${orderId}`);
    await adminPage.getByText('ID de Free Fire del cliente').waitFor({ timeout: 15000 });
    const adminBody = await adminPage.locator('body').innerText();
    check(adminBody.includes('ID de Free Fire del cliente'), 'el panel muestra el bloque del ID');
    check(adminBody.includes('123456789'), 'el panel muestra el ID ingresado por el cliente');

    check(errors.length === 0, 'sin errores de JavaScript en las páginas');
    console.log('Todas las comprobaciones del ID de Free Fire pasaron.');
  } finally {
    await browser.close();
    try { process.kill(-srv.pid, 'SIGKILL'); } catch {}
  }
  process.exit(0);
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
