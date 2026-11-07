/**
 * Regresión del tramo de confirmación de pedido (NOVASTORE).
 *
 * Ejercita placeOrder() sobre una base SQLite temporal y verifica:
 *  - creación del pedido con número único y estado pendiente de verificación
 *  - guardado del comprobante adjunto
 *  - descuento de stock y vaciado del carrito
 *  - idempotencia (no se duplican pedidos al reenviar el formulario)
 *  - validaciones de servidor (comprobante obligatorio, saldo insuficiente)
 *
 * Uso: npx tsx scripts/checkout-regression.ts
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'novastore-checkout-'));
process.env.DATABASE_PATH = path.join(tmpDir, 'regression.db');

const { getDb, nowIso } = await import('../src/lib/db');
const { placeOrder } = await import('../src/lib/orders');

let failures = 0;
function check(name: string, condition: boolean, detail = '') {
  if (condition) {
    console.log(`PASS  ${name}`);
  } else {
    failures += 1;
    console.log(`FAIL  ${name}${detail ? ` → ${detail}` : ''}`);
  }
}

const db = getDb();

/* ---------------------------------------------------------------- */
/* Datos de partida                                                  */
/* ---------------------------------------------------------------- */

const product = db
  .prepare(
    `SELECT id, name, price_cents, stock FROM products
     WHERE is_active = 1 AND stock IS NOT NULL AND stock > 0
     ORDER BY id LIMIT 1`,
  )
  .get() as { id: number; name: string; price_cents: number; stock: number } | undefined;

if (!product) {
  console.error('FAIL  No hay productos con stock en el seed; no se puede probar el checkout.');
  process.exit(1);
}

const methodRow = db
  .prepare(`SELECT code FROM payment_methods WHERE is_enabled = 1 AND code <> 'saldo' ORDER BY position LIMIT 1`)
  .get() as { code: string } | undefined;

if (!methodRow) {
  console.error('FAIL  No hay métodos de pago habilitados distintos de saldo.');
  process.exit(1);
}
const method = methodRow.code;

const userInfo = db
  .prepare(
    `INSERT INTO users (name, email, password_hash, phone, role, balance_cents, is_active, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'customer', ?, 1, ?, ?)`,
  )
  .run('Cliente Checkout', 'checkout@novastore.pe', 'x', '987654321', 0, nowIso(), nowIso());
const userId = Number(userInfo.lastInsertRowid);

const cartInfo = db
  .prepare('INSERT INTO carts (token, user_id, created_at, updated_at) VALUES (?, ?, ?, ?)')
  .run('cart-checkout-regression', userId, nowIso(), nowIso());
const cartId = Number(cartInfo.lastInsertRowid);

const QUANTITY = 2;
db.prepare(
  'INSERT INTO cart_items (cart_id, product_id, variant_id, quantity, created_at) VALUES (?, ?, NULL, ?, ?)',
).run(cartId, product.id, QUANTITY, nowIso());

const stockBefore = product.stock;
const proof = {
  fileName: 'comprobante.png',
  mimeType: 'image/png',
  size: 128,
  data: Buffer.from('89504e470d0a1a0a-comprobante-de-prueba'),
};

const baseInput = {
  userId,
  paymentMethod: method,
  contactEmail: 'checkout@novastore.pe',
  contactPhone: '987654321',
  customerNote: 'Prueba de regresión',
  idempotencyKey: 'regression-key-1',
  proof,
};

/* ---------------------------------------------------------------- */
/* 1. Sin comprobante no se crea el pedido                            */
/* ---------------------------------------------------------------- */

const withoutProof = placeOrder({ ...baseInput, idempotencyKey: 'regression-sin-proof', proof: null });
check(
  'rechaza el pedido sin comprobante',
  !withoutProof.ok && /comprobante/i.test(String((withoutProof as { error?: string }).error ?? '')),
  JSON.stringify(withoutProof),
);

/* ---------------------------------------------------------------- */
/* 2. Creación correcta del pedido                                    */
/* ---------------------------------------------------------------- */

const created = placeOrder(baseInput);
check('crea el pedido', created.ok === true, JSON.stringify(created));

if (!created.ok) {
  console.error(`\n${failures} comprobación(es) fallaron.`);
  process.exit(1);
}

const order = db
  .prepare(
    `SELECT id, order_number, status, payment_status, subtotal_cents, total_cents, payment_method,
            contact_email, created_at
     FROM orders WHERE order_number = ?`,
  )
  .get(created.orderNumber) as
  | {
      id: number;
      order_number: string;
      status: string;
      payment_status: string;
      subtotal_cents: number;
      total_cents: number;
      payment_method: string;
      contact_email: string;
      created_at: string;
    }
  | undefined;

check('el pedido existe en la base de datos', Boolean(order));
check('el número de pedido es único y no vacío', Boolean(order && order.order_number.length >= 6), order?.order_number);
check('el pedido queda en estado pendiente', order?.status === 'pendiente', order?.status);
check('el pago queda pendiente de verificación', order?.payment_status === 'pendiente', order?.payment_status);
check('guarda el método de pago elegido', order?.payment_method === method, order?.payment_method);
check('guarda el correo de contacto', order?.contact_email === 'checkout@novastore.pe', order?.contact_email);
check(
  'el total coincide con el precio del carrito',
  order?.total_cents === product.price_cents * QUANTITY,
  `${order?.total_cents} vs ${product.price_cents * QUANTITY}`,
);

const items = db
  .prepare('SELECT product_name, quantity, unit_price_cents, line_total_cents FROM order_items WHERE order_id = ?')
  .all(order!.id) as { product_name: string; quantity: number; unit_price_cents: number; line_total_cents: number }[];
check('registra una línea de pedido', items.length === 1, `líneas: ${items.length}`);
check('la línea guarda cantidad y precio unitario', items[0]?.quantity === QUANTITY && items[0]?.unit_price_cents === product.price_cents, JSON.stringify(items[0]));
check('la línea calcula su total', items[0]?.line_total_cents === product.price_cents * QUANTITY, String(items[0]?.line_total_cents));

const proofs = db
  .prepare('SELECT file_name, mime_type, size_bytes, length(data) AS bytes FROM payment_proofs WHERE order_id = ?')
  .all(order!.id) as { file_name: string; mime_type: string; size_bytes: number; bytes: number }[];
check('guarda el comprobante adjunto', proofs.length === 1, `comprobantes: ${proofs.length}`);
check('el comprobante conserva nombre, tipo y contenido', proofs[0]?.file_name === proof.fileName && proofs[0]?.mime_type === proof.mimeType && proofs[0]?.bytes === proof.data.length, JSON.stringify(proofs[0]));

const stockAfter = (
  db.prepare('SELECT stock FROM products WHERE id = ?').get(product.id) as { stock: number }
).stock;
check('descuenta el stock vendido', stockAfter === stockBefore - QUANTITY, `${stockBefore} → ${stockAfter}`);

const remainingItems = (
  db.prepare('SELECT COUNT(*) AS total FROM cart_items WHERE cart_id = ?').get(cartId) as { total: number }
).total;
check('vacía el carrito tras confirmar', remainingItems === 0, `quedan ${remainingItems}`);

/* ---------------------------------------------------------------- */
/* 3. Idempotencia: reenviar no duplica el pedido                     */
/* ---------------------------------------------------------------- */

db.prepare(
  'INSERT INTO cart_items (cart_id, product_id, variant_id, quantity, created_at) VALUES (?, ?, NULL, ?, ?)',
).run(cartId, product.id, QUANTITY, nowIso());

const resent = placeOrder(baseInput);
check('el reenvío con la misma clave no falla', resent.ok === true, JSON.stringify(resent));
check(
  'el reenvío devuelve el mismo número de pedido',
  resent.ok && resent.orderNumber === created.orderNumber,
  `${(resent as { orderNumber?: string }).orderNumber} vs ${created.orderNumber}`,
);
check('el reenvío se marca como duplicado', resent.ok === true && resent.duplicated === true, JSON.stringify(resent));

const orderCount = (
  db.prepare('SELECT COUNT(*) AS total FROM orders WHERE user_id = ?').get(userId) as { total: number }
).total;
check('no se crean pedidos duplicados', orderCount === 1, `pedidos: ${orderCount}`);

const stockAfterResend = (
  db.prepare('SELECT stock FROM products WHERE id = ?').get(product.id) as { stock: number }
).stock;
check('el reenvío no vuelve a descontar stock', stockAfterResend === stockAfter, `${stockAfter} → ${stockAfterResend}`);

/* ---------------------------------------------------------------- */
/* 4. Validación de saldo insuficiente                                */
/* ---------------------------------------------------------------- */

const saldoAttempt = placeOrder({
  ...baseInput,
  paymentMethod: 'saldo',
  idempotencyKey: 'regression-saldo',
  proof: null,
});
check(
  'rechaza el pago con saldo insuficiente',
  !saldoAttempt.ok && /saldo/i.test(String((saldoAttempt as { error?: string }).error ?? '')),
  JSON.stringify(saldoAttempt),
);

/* ---------------------------------------------------------------- */
/* 5. Método de pago inválido                                         */
/* ---------------------------------------------------------------- */

const badMethod = placeOrder({ ...baseInput, paymentMethod: 'metodo-inexistente', idempotencyKey: 'regression-bad' });
check('rechaza un método de pago inválido', !badMethod.ok, JSON.stringify(badMethod));

/* ---------------------------------------------------------------- */

fs.rmSync(tmpDir, { recursive: true, force: true });

if (failures > 0) {
  console.error(`\n${failures} comprobación(es) fallaron.`);
  process.exit(1);
}
console.log('\nTodas las comprobaciones del checkout pasaron.');
