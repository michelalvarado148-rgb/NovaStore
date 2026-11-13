/**
 * Regresión del pago con saldo NovaStore (NOVASTORE).
 *
 * Ejercita placeOrder()/updateOrder() sobre una base SQLite temporal y verifica:
 *  - rechazo con el mensaje exacto cuando el saldo no alcanza (sin saldo y con saldo parcial)
 *  - que un intento fallido no descuente dinero ni cree pedidos
 *  - descuento automático y único al pagar con saldo, con el pago ya verificado
 *  - ausencia de comprobante en el pago con saldo y visibilidad en el panel admin
 *  - idempotencia (reenviar el formulario no cobra ni crea dos pedidos)
 *  - que nunca quede saldo negativo ni se pueda sobregirar el saldo
 *  - reembolso único al cancelar un pedido pagado con saldo
 *  - que los métodos externos sigan exigiendo comprobante
 *
 * Uso: npm run test:saldo
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

let failures = 0;

function check(name: string, condition: boolean, detail = '') {
  if (condition) {
    console.log(`PASS  ${name}`);
  } else {
    failures += 1;
    console.log(`FAIL  ${name}${detail ? ` → ${detail}` : ''}`);
  }
}

function fail(message: string): never {
  console.error(`FAIL  ${message}`);
  process.exit(1);
}

async function main() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'novastore-saldo-'));
  process.env.DATABASE_PATH = path.join(tmpDir, 'saldo.db');

  const { getDb, nowIso } = await import('../src/lib/db');
  const { placeOrder, updateOrder, getAdminOrders, SALDO_METHOD, INSUFFICIENT_BALANCE_MESSAGE } =
    await import('../src/lib/orders');
  const { buildCartDetail } = await import('../src/lib/cart');
  const { getActiveOffers } = await import('../src/lib/catalog');

  const db = getDb();

  /* -------------------------------------------------------------- */
  /* Datos de partida                                                */
  /* -------------------------------------------------------------- */

  const product = db
    .prepare(
      `SELECT id, name, price_cents, stock FROM products
       WHERE is_active = 1 AND stock IS NOT NULL AND stock > 0
       ORDER BY id LIMIT 1`,
    )
    .get() as { id: number; name: string; price_cents: number; stock: number } | undefined;

  if (!product) fail('No hay productos con stock en el seed; no se puede probar el pago con saldo.');

  const now = nowIso();
  const userInfo = db
    .prepare(
      `INSERT INTO users (name, email, password_hash, phone, role, balance_cents, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'customer', 0, 1, ?, ?)`,
    )
    .run('Cliente Saldo', 'saldo@novastore.pe', 'x', '987111222', now, now);
  const userId = Number(userInfo.lastInsertRowid);

  const adminInfo = db
    .prepare(
      `INSERT INTO users (name, email, password_hash, phone, role, balance_cents, is_active, created_at, updated_at)
       VALUES (?, ?, ?, NULL, 'admin', 0, 1, ?, ?)`,
    )
    .run('Admin Saldo', 'admin-saldo@novastore.pe', 'x', now, now);
  const adminId = Number(adminInfo.lastInsertRowid);

  const cartInfo = db
    .prepare('INSERT INTO carts (token, user_id, created_at, updated_at) VALUES (?, ?, ?, ?)')
    .run('cart-saldo-regression', userId, now, now);
  const cartId = Number(cartInfo.lastInsertRowid);

  const setBalance = (cents: number) =>
    db.prepare('UPDATE users SET balance_cents = ? WHERE id = ?').run(cents, userId);
  const balance = () =>
    (db.prepare('SELECT balance_cents FROM users WHERE id = ?').get(userId) as {
      balance_cents: number;
    }).balance_cents;
  const addItem = (quantity: number) =>
    db
      .prepare(
        'INSERT INTO cart_items (cart_id, product_id, variant_id, quantity, created_at) VALUES (?, ?, NULL, ?, ?)',
      )
      .run(cartId, product.id, quantity, nowIso());
  const clearItems = () => db.prepare('DELETE FROM cart_items WHERE cart_id = ?').run(cartId);
  const cartTotal = () => buildCartDetail(cartId, getActiveOffers()).subtotal_cents;
  const countOrders = () =>
    (db.prepare('SELECT COUNT(*) AS n FROM orders WHERE user_id = ?').get(userId) as { n: number }).n;
  const countMovements = (type: string) =>
    (
      db
        .prepare('SELECT COUNT(*) AS n FROM balance_movements WHERE user_id = ? AND type = ?')
        .get(userId, type) as { n: number }
    ).n;

  const saldoInput = (idempotencyKey: string) => ({
    userId,
    paymentMethod: SALDO_METHOD,
    contactEmail: 'saldo@novastore.pe',
    contactPhone: '987111222',
    customerNote: 'Prueba de pago con saldo',
    idempotencyKey,
    proof: null,
  });

  /* -------------------------------------------------------------- */
  /* 1. Saldo parcial: rechazo sin descuento ni pedido               */
  /* -------------------------------------------------------------- */

  addItem(1);
  const total = cartTotal();
  check('el carrito calcula un total válido', total > 0, String(total));

  setBalance(total - 1);
  const partial = placeOrder(saldoInput('saldo-parcial'));
  check('rechaza la compra con saldo insuficiente', partial.ok === false, JSON.stringify(partial));
  check(
    'usa el mensaje exacto de saldo insuficiente',
    (partial as { error?: string }).error === INSUFFICIENT_BALANCE_MESSAGE,
    String((partial as { error?: string }).error),
  );
  check('no descuenta dinero cuando falla', balance() === total - 1, String(balance()));
  check('no crea pedido cuando falla', countOrders() === 0, String(countOrders()));
  check('no registra movimiento de compra cuando falla', countMovements('compra') === 0);

  /* -------------------------------------------------------------- */
  /* 2. Sin saldo: mismo rechazo                                     */
  /* -------------------------------------------------------------- */

  setBalance(0);
  const empty = placeOrder(saldoInput('saldo-cero'));
  check(
    'rechaza la compra sin saldo con el mismo mensaje',
    empty.ok === false && (empty as { error?: string }).error === INSUFFICIENT_BALANCE_MESSAGE,
    JSON.stringify(empty),
  );
  check('el saldo sigue en cero', balance() === 0, String(balance()));
  check('tampoco crea pedido sin saldo', countOrders() === 0);

  /* -------------------------------------------------------------- */
  /* 3. Saldo suficiente: descuento automático y pago verificado     */
  /* -------------------------------------------------------------- */

  setBalance(total);
  const paid = placeOrder(saldoInput('saldo-ok'));
  check('acepta la compra con saldo suficiente', paid.ok === true, JSON.stringify(paid));
  if (!paid.ok) {
    console.error(`\n${failures} comprobación(es) fallaron.`);
    process.exit(1);
  }

  const order = db
    .prepare(
      `SELECT id, order_number, status, payment_status, payment_method, total_cents
       FROM orders WHERE order_number = ?`,
    )
    .get(paid.orderNumber) as
    | {
        id: number;
        order_number: string;
        status: string;
        payment_status: string;
        payment_method: string;
        total_cents: number;
      }
    | undefined;

  check('el pedido pagado con saldo existe', Boolean(order));
  check('el pedido registra el método saldo', order?.payment_method === SALDO_METHOD, order?.payment_method);
  check(
    'el pedido nace con el pago verificado',
    order?.payment_status === 'verificado',
    order?.payment_status,
  );
  check('el total del pedido coincide con el carrito', order?.total_cents === total, String(order?.total_cents));
  check('el saldo se descuenta por completo', balance() === 0, String(balance()));

  const debit = db
    .prepare(
      `SELECT amount_cents, type, order_id FROM balance_movements
       WHERE user_id = ? AND type = 'compra' ORDER BY id DESC LIMIT 1`,
    )
    .get(userId) as { amount_cents: number; type: string; order_id: number | null } | undefined;
  check('registra un único movimiento de compra por el total', debit?.amount_cents === -total, String(debit?.amount_cents));
  check('el movimiento queda ligado al pedido', debit?.order_id === order?.id, String(debit?.order_id));
  check('hay exactamente un movimiento de compra', countMovements('compra') === 1, String(countMovements('compra')));

  const proofs = (
    db.prepare('SELECT COUNT(*) AS n FROM payment_proofs WHERE order_id = ?').get(order?.id) as {
      n: number;
    }
  ).n;
  check('el pago con saldo no guarda comprobante', proofs === 0, String(proofs));

  const adminOrders = getAdminOrders();
  check(
    'el pedido aparece en el panel de administración',
    adminOrders.some((item) => item.order_number === paid.orderNumber),
    String(adminOrders.length),
  );

  const items = (
    db.prepare('SELECT COUNT(*) AS n FROM order_items WHERE order_id = ?').get(order?.id) as {
      n: number;
    }
  ).n;
  check('el pedido guarda sus productos', items > 0, String(items));

  /* -------------------------------------------------------------- */
  /* 4. Idempotencia: reenviar no vuelve a cobrar                    */
  /* -------------------------------------------------------------- */

  const resend = placeOrder(saldoInput('saldo-ok'));
  check('reenviar el formulario no duplica el pedido', resend.ok === true && resend.duplicated === true, JSON.stringify(resend));
  check('reenviar no vuelve a descontar saldo', balance() === 0, String(balance()));
  check('sigue habiendo un solo pedido', countOrders() === 1, String(countOrders()));
  check('sigue habiendo un solo movimiento de compra', countMovements('compra') === 1);

  /* -------------------------------------------------------------- */
  /* 5. Sin sobregiro con compras sucesivas                          */
  /* -------------------------------------------------------------- */

  addItem(1);
  const total2 = cartTotal();
  setBalance(total2);
  const second = placeOrder(saldoInput('saldo-2'));
  check('acepta una segunda compra con saldo justo', second.ok === true, JSON.stringify(second));
  check('el saldo queda en cero tras la segunda compra', balance() === 0, String(balance()));

  addItem(1);
  const third = placeOrder(saldoInput('saldo-3'));
  check(
    'bloquea una tercera compra sin saldo',
    third.ok === false && (third as { error?: string }).error === INSUFFICIENT_BALANCE_MESSAGE,
    JSON.stringify(third),
  );
  check('el saldo no queda negativo', balance() === 0, String(balance()));
  check('solo existen los dos pedidos pagados con saldo', countOrders() === 2, String(countOrders()));

  /* -------------------------------------------------------------- */
  /* 6. Reembolso único al cancelar                                  */
  /* -------------------------------------------------------------- */

  const secondOrder = db
    .prepare('SELECT id FROM orders WHERE order_number = ?')
    .get(second.ok ? second.orderNumber : '') as { id: number } | undefined;

  const cancel = updateOrder({ orderId: secondOrder?.id ?? 0, status: 'cancelado', adminId });
  check('el administrador puede cancelar el pedido', cancel.ok === true, JSON.stringify(cancel));
  check('el saldo se reembolsa al cancelar', balance() === total2, String(balance()));
  check('se registra un movimiento de reembolso', countMovements('reembolso') === 1, String(countMovements('reembolso')));

  const cancelAgain = updateOrder({ orderId: secondOrder?.id ?? 0, status: 'cancelado', adminId });
  check('cancelar de nuevo responde correctamente', cancelAgain.ok === true, JSON.stringify(cancelAgain));
  check('no reembolsa dos veces el mismo pedido', balance() === total2, String(balance()));
  check('sigue habiendo un solo reembolso', countMovements('reembolso') === 1, String(countMovements('reembolso')));

  /* -------------------------------------------------------------- */
  /* 7. Los métodos externos siguen exigiendo comprobante            */
  /* -------------------------------------------------------------- */

  const external = db
    .prepare(
      `SELECT code FROM payment_methods WHERE is_enabled = 1 AND code <> 'saldo'
       ORDER BY position LIMIT 1`,
    )
    .get() as { code: string } | undefined;
  if (!external) fail('No hay métodos de pago externos habilitados para la prueba.');

  clearItems();
  addItem(1);
  const balanceBeforeExternal = balance();

  const externalWithoutProof = placeOrder({
    ...saldoInput('externo-sin-proof'),
    paymentMethod: external.code,
    proof: null,
  });
  check(
    'el método externo sigue exigiendo comprobante',
    externalWithoutProof.ok === false &&
      /comprobante/i.test(String((externalWithoutProof as { error?: string }).error ?? '')),
    JSON.stringify(externalWithoutProof),
  );

  const externalWithProof = placeOrder({
    ...saldoInput('externo-con-proof'),
    paymentMethod: external.code,
    proof: {
      fileName: 'comprobante.png',
      mimeType: 'image/png',
      size: 64,
      data: Buffer.from('89504e470d0a1a0a-comprobante'),
    },
  });
  check('el pago externo con comprobante se registra', externalWithProof.ok === true, JSON.stringify(externalWithProof));
  check('el pago externo no descuenta saldo', balance() === balanceBeforeExternal, String(balance()));

  const externalOrder = db
    .prepare('SELECT payment_status FROM orders WHERE order_number = ?')
    .get(externalWithProof.ok ? externalWithProof.orderNumber : '') as
    | { payment_status: string }
    | undefined;
  check(
    'el pago externo queda pendiente de verificación',
    externalOrder?.payment_status === 'pendiente',
    externalOrder?.payment_status,
  );

  /* -------------------------------------------------------------- */
  /* 8. Ningún saldo negativo en toda la base                        */
  /* -------------------------------------------------------------- */

  const negative = (
    db.prepare('SELECT COUNT(*) AS n FROM users WHERE balance_cents < 0').get() as { n: number }
  ).n;
  check('ningún usuario tiene saldo negativo', negative === 0, String(negative));

  if (failures > 0) {
    console.error(`\n${failures} comprobación(es) fallaron.`);
    process.exit(1);
  }
  console.log('\nRESULTADO: todas las comprobaciones del pago con saldo pasaron');
}

main().catch((error) => {
  console.error('FAIL  error inesperado:', error);
  process.exit(1);
});
