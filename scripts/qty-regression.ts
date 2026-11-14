/**
 * Regresión de «Productos con cantidad personalizada».
 *
 * Cubre las reglas de cálculo y límites, la persistencia por producto, el
 * rechazo de cantidades inválidas al confirmar el pedido y el renderizado real
 * (página de producto y carrito) con un servidor `next start` y base temporal.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, type ChildProcess } from 'node:child_process';

const PORT = Number(process.env.QTY_TEST_PORT ?? 3312);
const BASE = `http://127.0.0.1:${PORT}`;
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'novastore-qty-'));
process.env.DATABASE_PATH = path.join(tmpDir, 'qty.db');
process.env.NOVASTORE_DISABLE_SYNC = '1';
process.env.ADMIN_EMAIL = 'admin@novastore.test';
process.env.ADMIN_PASSWORD = 'TestAdmin123!';

let passed = 0;
let failed = 0;

function check(name: string, fn: () => void) {
  try {
    fn();
    passed += 1;
    console.log(`  \u2713 ${name}`);
  } catch (error) {
    failed += 1;
    console.error(`  \u2717 ${name} \u2014 ${(error as Error).message}`);
  }
}

async function checkAsync(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    passed += 1;
    console.log(`  \u2713 ${name}`);
  } catch (error) {
    failed += 1;
    console.error(`  \u2717 ${name} \u2014 ${(error as Error).message}`);
  }
}

function normalize(html: string): string {
  return html.replace(/[\u00a0\u202f]/g, ' ');
}

async function main() {
  const rules = await import('../src/lib/qty-rules');
  const store = await import('../src/lib/custom-quantity');
  const { getDb, hashToken, nowIso } = await import('../src/lib/db');
  const { placeOrder } = await import('../src/lib/orders');

  const cfg = rules.normalizeQtyConfig({ enabled: true, basis: 100, min: 100, max: 10000, step: 100 });

  console.log('\nReglas de cálculo y límites');
  check('normaliza la configuración del ejemplo (100/10 000/de 100 en 100)', () => {
    assert.deepEqual(cfg, { enabled: true, basis: 100, min: 100, max: 10000, step: 100 });
  });
  check('acepta 100, 200 y 10 000', () => {
    for (const qty of [100, 200, 500, 1000, 10000]) {
      assert.equal(rules.validateQuantity(cfg, qty).ok, true, `debería aceptar ${qty}`);
    }
  });
  check('rechaza cantidades menores al mínimo (50)', () => {
    const result = rules.validateQuantity(cfg, 50);
    assert.equal(result.ok, false);
    assert.match((result as { error: string }).error, /mínima .* 100/i);
  });
  check('rechaza cantidades fuera del intervalo (150)', () => {
    const result = rules.validateQuantity(cfg, 150);
    assert.equal(result.ok, false);
    assert.match((result as { error: string }).error, /100 en 100/);
  });
  check('rechaza cantidades mayores al máximo (10 100)', () => {
    const result = rules.validateQuantity(cfg, 10100);
    assert.equal(result.ok, false);
    assert.match((result as { error: string }).error, /máxima/i);
  });
  check('rechaza valores no numéricos, cero y negativos', () => {
    for (const bad of [0, -10, 'abc', '', 12.5, null]) {
      assert.equal(rules.validateQuantity(cfg, bad).ok, false, `debería rechazar ${String(bad)}`);
    }
  });
  check('calcula el total: 100 → S/ 2.00 y 500 → S/ 10.00', () => {
    assert.equal(rules.totalCentsFor(200, 100, cfg), 200);
    assert.equal(rules.totalCentsFor(200, 500, cfg), 1000);
    assert.equal(rules.totalCentsFor(200, 1000, cfg), 2000);
  });
  check('muestra el precio por unidad (S/ 0.02 por cada 100)', () => {
    assert.equal(rules.unitPriceCents(200, cfg), 2);
    assert.match(normalize(rules.formatUnitPrice(2)), /0\.02/);
    assert.match(rules.basisLabel(100), /100 unidades/);
  });
  check('sugiere cantidades válidas (100, 500, 1000)', () => {
    const presets = rules.quantityPresets(cfg);
    for (const qty of [100, 500, 1000]) assert.ok(presets.includes(qty), `falta ${qty}`);
    for (const qty of presets) assert.equal(rules.validateQuantity(cfg, qty).ok, true);
  });
  check('describe el rango configurado', () => {
    const text = normalize(rules.describeQtyRange(cfg));
    assert.match(text, /Desde 100 hasta 10 000/);
    assert.match(text, /de 100 en 100/);
  });
  check('un producto sin la opción activada mantiene el comportamiento anterior', () => {
    const off = rules.normalizeQtyConfig({ enabled: false });
    assert.equal(off.enabled, false);
    assert.equal(rules.validateQuantity(off, 3).ok, true);
  });
  check('normaliza valores inválidos del panel', () => {
    const weird = rules.normalizeQtyConfig({ enabled: 'on', basis: 7, min: -5, max: 10, step: 0 });
    assert.equal(weird.enabled, true);
    assert.equal(weird.basis, 1);
    assert.equal(weird.min, 1);
    assert.equal(weird.max, 10);
    assert.equal(weird.step, 1);
  });

  console.log('\nPersistencia y pedidos (base temporal)');
  const db = getDb();
  const categoryId = Number(
    db
      .prepare('INSERT INTO categories (name, slug, description, position, is_active, created_at) VALUES (?,?,?,?,?,?)')
      .run('Pruebas', 'pruebas-qty', '', 0, 1, nowIso()).lastInsertRowid,
  );
  const productId = Number(
    db
      .prepare(
        `INSERT INTO products (category_id, name, slug, description, price_cents, stock, is_active, is_featured, created_at)
         VALUES (?,?,?,?,?,?,?,?,?)`,
      )
      .run(categoryId, 'Diamantes de prueba', 'diamantes-prueba', 'Producto de prueba', 200, null, 1, 0, nowIso())
      .lastInsertRowid,
  );

  check('guarda y recupera la configuración del producto', () => {
    store.saveQtyConfig(productId, { enabled: true, basis: 100, min: 100, max: 10000, step: 100 });
    assert.deepEqual(store.readQtyConfig(productId), {
      enabled: true,
      basis: 100,
      min: 100,
      max: 10000,
      step: 100,
    });
  });
  check('la configuración persiste entre lecturas (no es memoria temporal)', () => {
    const again = store.readQtyConfig(productId);
    assert.equal(again.enabled, true);
    assert.equal(again.min, 100);
  });
  check('leer varios productos devuelve la configuración de cada uno', () => {
    const map = store.readQtyConfigs([productId, 999999]);
    assert.equal(map.get(productId)?.enabled, true);
    assert.equal(map.get(999999)?.enabled, false);
  });
  check('desactivar la opción borra la configuración del producto', () => {
    store.saveQtyConfig(productId, { enabled: false });
    assert.equal(store.readQtyConfig(productId).enabled, false);
    const row = db.prepare('SELECT key FROM settings WHERE key = ?').get(`qty:${productId}`);
    assert.equal(row, undefined);
    store.saveQtyConfig(productId, { enabled: true, basis: 100, min: 100, max: 10000, step: 100 });
  });

  const userId = Number(
    db
      .prepare(
        'INSERT INTO users (name, email, password_hash, role, balance_cents, created_at, updated_at) VALUES (?,?,?,?,?,?,?)',
      )
      .run('Cliente Prueba', 'cliente@novastore.test', 'x', 'customer', 100000, nowIso(), nowIso()).lastInsertRowid,
  );
  const cartId = Number(
    db
      .prepare('INSERT INTO carts (token, user_id, created_at, updated_at) VALUES (?,?,?,?)')
      .run('cart-qty-test', userId, nowIso(), nowIso()).lastInsertRowid,
  );
  const itemId = Number(
    db
      .prepare('INSERT INTO cart_items (cart_id, product_id, variant_id, quantity, created_at) VALUES (?,?,?,?,?)')
      .run(cartId, productId, null, 150, nowIso()).lastInsertRowid,
  );

  check('el servidor rechaza el pedido con cantidad fuera del intervalo (150)', () => {
    const result = placeOrder({
      userId,
      paymentMethod: 'saldo',
      contactEmail: 'cliente@novastore.test',
      contactPhone: '999888777',
      idempotencyKey: 'qty-test-invalid',
      proof: null,
    });
    assert.equal(result.ok, false);
    assert.match((result as { error: string }).error, /100 en 100/);
  });
  check('no se creó ningún pedido ni se descontó saldo con la cantidad inválida', () => {
    const orders = db.prepare('SELECT COUNT(*) AS n FROM orders WHERE user_id = ?').get(userId) as { n: number };
    assert.equal(orders.n, 0);
    const user = db.prepare('SELECT balance_cents FROM users WHERE id = ?').get(userId) as { balance_cents: number };
    assert.equal(user.balance_cents, 100000);
  });

  db.prepare('UPDATE cart_items SET quantity = ? WHERE id = ?').run(200, itemId);
  check('acepta el pedido con cantidad válida (200) y cobra 2 × S/ 2.00', () => {
    const result = placeOrder({
      userId,
      paymentMethod: 'saldo',
      contactEmail: 'cliente@novastore.test',
      contactPhone: '999888777',
      idempotencyKey: 'qty-test-valid',
      proof: null,
    });
    assert.equal(result.ok, true, result.ok ? '' : (result as { error: string }).error);
    assert.equal((result as { totalCents: number }).totalCents, 400);
  });
  check('registra la cantidad y el importe correctos y descuenta el saldo', () => {
    const order = db.prepare('SELECT id, total_cents FROM orders WHERE user_id = ?').get(userId) as {
      id: number;
      total_cents: number;
    };
    assert.equal(order.total_cents, 400);
    const item = db.prepare('SELECT quantity, unit_price_cents, line_total_cents FROM order_items WHERE order_id = ?').get(
      order.id,
    ) as { quantity: number; unit_price_cents: number; line_total_cents: number };
    assert.equal(item.quantity, 200);
    assert.equal(item.line_total_cents, 400);
    const user = db.prepare('SELECT balance_cents FROM users WHERE id = ?').get(userId) as { balance_cents: number };
    assert.equal(user.balance_cents, 99600);
  });

  // Carrito de otro cliente para comprobar el renderizado del carrito.
  const buyerId = Number(
    db
      .prepare(
        'INSERT INTO users (name, email, password_hash, role, balance_cents, created_at, updated_at) VALUES (?,?,?,?,?,?,?)',
      )
      .run('Comprador Prueba', 'comprador@novastore.test', 'x', 'customer', 50000, nowIso(), nowIso()).lastInsertRowid,
  );
  const buyerCart = Number(
    db
      .prepare('INSERT INTO carts (token, user_id, created_at, updated_at) VALUES (?,?,?,?)')
      .run('cart-qty-buyer', buyerId, nowIso(), nowIso()).lastInsertRowid,
  );
  db.prepare('INSERT INTO cart_items (cart_id, product_id, variant_id, quantity, created_at) VALUES (?,?,?,?,?)').run(
    buyerCart,
    productId,
    null,
    300,
    nowIso(),
  );
  const token = 'qty-session-token';
  db.prepare('INSERT INTO sessions (token_hash, user_id, user_agent, created_at, expires_at) VALUES (?,?,?,?,?)').run(
    hashToken(token),
    buyerId,
    'qty-regression',
    nowIso(),
    new Date(Date.now() + 3600_000).toISOString(),
  );

  console.log('\nRenderizado real (next start)');
  let server: ChildProcess | null = null;
  try {
    server = spawn('npx', ['next', 'start', '-p', String(PORT)], {
      cwd: process.cwd(),
      env: { ...process.env },
      stdio: 'ignore',
    });

    let ready = false;
    for (let attempt = 0; attempt < 60 && !ready; attempt += 1) {
      try {
        const response = await fetch(`${BASE}/login`);
        if (response.status < 500) ready = true;
      } catch {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }
    if (!ready) throw new Error('el servidor de prueba no arrancó');

    await checkAsync('la página del producto muestra el selector de cantidad', async () => {
      const response = await fetch(`${BASE}/producto/diamantes-prueba`);
      const html = normalize(await response.text());
      assert.equal(response.status, 200);
      assert.match(html, /Elige la cantidad/);
      assert.match(html, /por cada 100 unidades/);
      assert.match(html, /Desde 100 hasta 10 000/);
      assert.match(html, /Precio por unidad/);
      assert.match(html, /Total a pagar/);
    });

    await checkAsync('el carrito recalcula el total según la cantidad (300 → S/ 6.00)', async () => {
      const response = await fetch(`${BASE}/carrito`, {
        headers: { cookie: `nova_session=${token}` },
      });
      const html = normalize(await response.text());
      assert.equal(response.status, 200);
      assert.match(html, /S\/ 6\.00/);
      assert.match(html, /por 100/);
      assert.match(html, /Desde 100 hasta 10 000/);
    });

    await checkAsync('un producto sin la opción activada no muestra el selector', async () => {
      const plainId = Number(
        db
          .prepare(
            `INSERT INTO products (category_id, name, slug, description, price_cents, stock, is_active, is_featured, created_at)
             VALUES (?,?,?,?,?,?,?,?,?)`,
          )
          .run(categoryId, 'Producto normal', 'producto-normal-prueba', '', 1500, null, 1, 0, nowIso()).lastInsertRowid,
      );
      assert.ok(plainId > 0);
      const response = await fetch(`${BASE}/producto/producto-normal-prueba`);
      const html = normalize(await response.text());
      assert.equal(response.status, 200);
      assert.doesNotMatch(html, /Elige la cantidad/);
      assert.match(html, /Cantidad/);
    });
  } finally {
    if (server) {
      server.kill('SIGTERM');
      await new Promise((resolve) => setTimeout(resolve, 600));
    }
  }

  console.log(`\n${passed} comprobaciones correctas, ${failed} fallidas.`);
  if (failed > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
