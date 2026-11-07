/**
 * Regresión del panel administrativo y del aislamiento de datos (NOVASTORE).
 *
 * Verifica, sobre una base SQLite temporal:
 *  - CRUD de categorías y productos (con variantes)
 *  - ofertas: aplican descuento al carrito y se pueden desactivar
 *  - configuración de la tienda y activación/desactivación de métodos de pago
 *  - gestión de saldo del cliente (recarga y compra con saldo)
 *  - administración de pedidos: entrega, verificación de pago y rechazo con reposición de stock
 *  - comprobantes pendientes de revisión
 *  - aislamiento: un cliente no puede consultar pedidos de otro
 *
 * Uso: npm run test:admin
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
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'novastore-admin-'));
  process.env.DATABASE_PATH = path.join(tmpDir, 'regression.db');

  const { getDb, nowIso } = await import('../src/lib/db');
  const admin = await import('../src/lib/admin');
  const orders = await import('../src/lib/orders');
  const cart = await import('../src/lib/cart');
  const catalog = await import('../src/lib/catalog');

  const db = getDb();

  /* -------------------------------------------------------------- */
  /* Utilidades                                                      */
  /* -------------------------------------------------------------- */

  function createUser(email: string, role: 'admin' | 'customer', balance = 0) {
    const info = db
      .prepare(
        `INSERT INTO users (name, email, password_hash, phone, role, balance_cents, is_active, created_at, updated_at)
         VALUES (?, ?, ?, NULL, ?, ?, 1, ?, ?)`,
      )
      .run(`Usuario ${email}`, email, 'x', role, balance, nowIso(), nowIso());
    return Number(info.lastInsertRowid);
  }

  function createCart(userId: number, token: string) {
    const info = db
      .prepare('INSERT INTO carts (token, user_id, created_at, updated_at) VALUES (?, ?, ?, ?)')
      .run(token, userId, nowIso(), nowIso());
    return Number(info.lastInsertRowid);
  }

  function addItem(cartId: number, productId: number, quantity: number) {
    // El carrito real fusiona cantidades (índice único cart+producto+variante),
    // así que aquí se replica con un upsert en lugar de un INSERT simple.
    db.prepare(
      `INSERT INTO cart_items (cart_id, product_id, variant_id, quantity, created_at)
       VALUES (?, ?, NULL, ?, ?)
       ON CONFLICT DO UPDATE SET quantity = excluded.quantity`,
    ).run(cartId, productId, quantity, nowIso());
  }

  const adminId = createUser('admin-reg@novastore.pe', 'admin');
  const buyerId = createUser('comprador@novastore.pe', 'customer');
  const strangerId = createUser('ajeno@novastore.pe', 'customer');

  /* -------------------------------------------------------------- */
  /* 1. Categorías                                                   */
  /* -------------------------------------------------------------- */

  const catResult = admin.saveCategory({
    name: 'Categoría Regresión',
    description: 'Categoría creada por la prueba',
    imageUrl: null,
    position: 99,
    isActive: true,
  });
  check('crea una categoría', catResult.ok === true, JSON.stringify(catResult));
  const categoryId = catResult.ok ? catResult.id : 0;

  const catRows = db
    .prepare('SELECT name, is_active FROM categories WHERE id = ?')
    .get(categoryId) as { name: string; is_active: number } | undefined;
  check('la categoría queda guardada y activa', catRows?.name === 'Categoría Regresión' && catRows?.is_active === 1, JSON.stringify(catRows));

  const emptyCategory = admin.saveCategory({
    name: '   ',
    description: '',
    imageUrl: null,
    position: 100,
    isActive: true,
  });
  check('rechaza una categoría sin nombre', emptyCategory.ok === false, JSON.stringify(emptyCategory));

  const renamed = admin.saveCategory({
    id: categoryId,
    name: 'Categoría Regresión Editada',
    description: 'Editada',
    imageUrl: null,
    position: 99,
    isActive: true,
  });
  check('edita una categoría existente', renamed.ok === true && renamed.id === categoryId, JSON.stringify(renamed));

  /* -------------------------------------------------------------- */
  /* 2. Productos con variantes                                      */
  /* -------------------------------------------------------------- */

  const productResult = admin.saveProduct({
    name: 'Producto Regresión',
    description: 'Producto creado por la prueba',
    categoryId,
    imageUrl: null,
    priceCents: 10000,
    comparePriceCents: null,
    stock: 10,
    isActive: true,
    isFeatured: false,
    variants: [
      { name: '1 mes', priceCents: 10000, stock: 5 },
      { name: '3 meses', priceCents: 25000, stock: 5 },
    ],
  });
  check('crea un producto con variantes', productResult.ok === true, JSON.stringify(productResult));
  const productId = productResult.ok ? productResult.id : 0;

  const variants = db
    .prepare('SELECT name, price_cents, stock FROM product_variants WHERE product_id = ? ORDER BY id')
    .all(productId) as { name: string; price_cents: number; stock: number }[];
  check('guarda las dos variantes', variants.length === 2, `variantes: ${variants.length}`);
  check('la variante conserva su precio', variants[1]?.price_cents === 25000, JSON.stringify(variants[1]));

  const listed = admin.listAdminProducts().find((p) => p.id === productId);
  check('el producto aparece en el listado del panel', Boolean(listed), 'no encontrado');
  check('el listado muestra stock y categoría', listed?.stock === 10 && listed?.category_id === categoryId, JSON.stringify(listed));

  const noName = admin.saveProduct({
    name: '',
    description: '',
    categoryId: null,
    imageUrl: null,
    priceCents: 1000,
    comparePriceCents: null,
    stock: 1,
    isActive: true,
    isFeatured: false,
    variants: [],
  });
  check('rechaza un producto sin nombre', noName.ok === false, JSON.stringify(noName));

  const negativePrice = admin.saveProduct({
    name: 'Precio inválido',
    description: '',
    categoryId: null,
    imageUrl: null,
    priceCents: -500,
    comparePriceCents: null,
    stock: 1,
    isActive: true,
    isFeatured: false,
    variants: [],
  });
  check('rechaza un precio negativo', negativePrice.ok === false, JSON.stringify(negativePrice));

  /* -------------------------------------------------------------- */
  /* 3. Ofertas                                                      */
  /* -------------------------------------------------------------- */

  const cartId = createCart(buyerId, 'cart-admin-regression');
  addItem(cartId, productId, 1);

  const beforeOffer = cart.buildCartDetail(cartId);
  check('sin oferta se cobra el precio de lista', beforeOffer.lines[0]?.unit_price_cents === 10000, String(beforeOffer.lines[0]?.unit_price_cents));

  const offerResult = admin.saveOffer({
    title: 'Oferta Regresión',
    description: '25% de descuento',
    productId,
    categoryId: null,
    discountPercent: 25,
    startsAt: null,
    endsAt: null,
    isActive: true,
  });
  check('crea una oferta', offerResult.ok === true, JSON.stringify(offerResult));

  const withOffer = cart.buildCartDetail(cartId);
  check('la oferta aplica 25% al carrito', withOffer.lines[0]?.unit_price_cents === 7500, String(withOffer.lines[0]?.unit_price_cents));

  const offerRow = db
    .prepare('SELECT id FROM offers WHERE title = ? ORDER BY id DESC LIMIT 1')
    .get('Oferta Regresión') as { id: number } | undefined;
  admin.toggleOffer(offerRow!.id);
  const afterToggle = cart.buildCartDetail(cartId);
  check('desactivar la oferta devuelve el precio de lista', afterToggle.lines[0]?.unit_price_cents === 10000, String(afterToggle.lines[0]?.unit_price_cents));
  admin.toggleOffer(offerRow!.id);
  admin.deleteOffer(offerRow!.id);
  const afterDelete = cart.buildCartDetail(cartId);
  check('eliminar la oferta devuelve el precio de lista', afterDelete.lines[0]?.unit_price_cents === 10000, String(afterDelete.lines[0]?.unit_price_cents));

  /* -------------------------------------------------------------- */
  /* 4. Configuración y métodos de pago                              */
  /* -------------------------------------------------------------- */

  admin.saveSettings({ store_name: 'NOVASTORE', telegram_url: 'https://t.me/canal-regresion' });
  const settings = db
    .prepare("SELECT key, value FROM settings WHERE key IN ('store_name','telegram_url')")
    .all() as { key: string; value: string }[];
  check('guarda la configuración de la tienda', settings.find((s) => s.key === 'telegram_url')?.value === 'https://t.me/canal-regresion', JSON.stringify(settings));

  const methods = admin.listAdminPaymentMethods();
  const yape = methods.find((m) => m.code === 'yape');
  check('lista los métodos de pago con su estado', Boolean(yape), JSON.stringify(methods.map((m) => m.code)));

  const disabled = admin.savePaymentMethod({
    id: yape!.id,
    name: yape!.name,
    description: yape!.description,
    accountInfo: yape!.account_info,
    instructions: yape!.instructions,
    isEnabled: false,
    position: yape!.position,
  });
  check('desactiva un método de pago', disabled.ok === true, JSON.stringify(disabled));

  const enabledCodes = catalog.getPaymentMethods(true).map((m) => m.code);
  check('el método desactivado no se ofrece al cliente', !enabledCodes.includes('yape'), enabledCodes.join(','));
  check('los demás métodos siguen disponibles', enabledCodes.length >= 1, enabledCodes.join(','));

  const blockedMethod = orders.placeOrder({
    userId: buyerId,
    paymentMethod: 'yape',
    contactEmail: 'comprador@novastore.pe',
    contactPhone: '',
    customerNote: undefined,
    idempotencyKey: 'admin-reg-method-off',
    proof: { fileName: 'p.png', mimeType: 'image/png', size: 3, data: Buffer.from('abc') },
  });
  check('el checkout rechaza un método desactivado', blockedMethod.ok === false, JSON.stringify(blockedMethod));

  admin.savePaymentMethod({
    id: yape!.id,
    name: yape!.name,
    description: yape!.description,
    accountInfo: yape!.account_info,
    instructions: yape!.instructions,
    isEnabled: true,
    position: yape!.position,
  });
  check('reactiva el método de pago', catalog.getPaymentMethods(true).some((m) => m.code === 'yape'));

  /* -------------------------------------------------------------- */
  /* 5. Saldo del cliente                                            */
  /* -------------------------------------------------------------- */

  const credit = orders.adjustBalance({
    userId: buyerId,
    amountCents: 30000,
    type: 'recarga',
    description: 'Recarga de prueba',
    adminId,
  });
  check('el administrador acredita saldo', credit.ok === true, JSON.stringify(credit));

  const balanceAfterCredit = (
    db.prepare('SELECT balance_cents FROM users WHERE id = ?').get(buyerId) as { balance_cents: number }
  ).balance_cents;
  check('el saldo del cliente se actualiza', balanceAfterCredit === 30000, String(balanceAfterCredit));

  const movements = orders.getBalanceMovements(buyerId);
  check('registra el movimiento de saldo', movements.some((m) => m.type === 'recarga' && m.amount_cents === 30000), JSON.stringify(movements.slice(0, 2)));

  const zeroAmount = orders.adjustBalance({
    userId: buyerId,
    amountCents: 0,
    type: 'ajuste',
    description: 'Cero',
    adminId,
  });
  check('rechaza un ajuste de saldo en cero', zeroAmount.ok === false, JSON.stringify(zeroAmount));

  /* -------------------------------------------------------------- */
  /* 6. Pago con saldo                                               */
  /* -------------------------------------------------------------- */

  addItem(cartId, productId, 1);
  const saldoOrder = orders.placeOrder({
    userId: buyerId,
    paymentMethod: 'saldo',
    contactEmail: 'comprador@novastore.pe',
    contactPhone: '',
    customerNote: undefined,
    idempotencyKey: 'admin-reg-saldo',
    proof: null,
  });
  check('el cliente paga con saldo', saldoOrder.ok === true, JSON.stringify(saldoOrder));

  const balanceAfterPurchase = (
    db.prepare('SELECT balance_cents FROM users WHERE id = ?').get(buyerId) as { balance_cents: number }
  ).balance_cents;
  check('el saldo se descuenta al comprar', balanceAfterPurchase === 20000, String(balanceAfterPurchase));

  /* -------------------------------------------------------------- */
  /* 7. Administración de pedidos                                    */
  /* -------------------------------------------------------------- */

  const orderRow = db
    .prepare('SELECT id, status, payment_status, total_cents FROM orders WHERE order_number = ?')
    .get(saldoOrder.ok ? saldoOrder.orderNumber : '') as
    | { id: number; status: string; payment_status: string; total_cents: number }
    | undefined;
  check('el pedido con saldo existe', Boolean(orderRow));

  const delivered = orders.updateOrder({
    orderId: orderRow!.id,
    status: 'entregado',
    paymentStatus: 'verificado',
    adminNote: 'Entregado por la prueba',
    adminId,
  });
  check('el administrador entrega y verifica el pedido', delivered.ok === true, JSON.stringify(delivered));

  const updated = db
    .prepare('SELECT status, payment_status, admin_note, reviewed_by FROM orders WHERE id = ?')
    .get(orderRow!.id) as { status: string; payment_status: string; admin_note: string; reviewed_by: number };
  check('el estado del pedido queda en entregado', updated.status === 'entregado', updated.status);
  check('el pago queda verificado', updated.payment_status === 'verificado', updated.payment_status);
  check('guarda la nota y el revisor', updated.admin_note === 'Entregado por la prueba' && updated.reviewed_by === adminId, JSON.stringify(updated));

  /* -------------------------------------------------------------- */
  /* 8. Rechazo con reposición de stock                              */
  /* -------------------------------------------------------------- */

  const stockBefore = (db.prepare('SELECT stock FROM products WHERE id = ?').get(productId) as { stock: number }).stock;
  addItem(cartId, productId, 2);
  const rejectable = orders.placeOrder({
    userId: buyerId,
    paymentMethod: 'yape',
    contactEmail: 'comprador@novastore.pe',
    contactPhone: '',
    customerNote: undefined,
    idempotencyKey: 'admin-reg-rechazo',
    proof: { fileName: 'pago.png', mimeType: 'image/png', size: 4, data: Buffer.from('abcd') },
  });
  check('crea el pedido a rechazar', rejectable.ok === true, JSON.stringify(rejectable));

  const stockAfterSale = (db.prepare('SELECT stock FROM products WHERE id = ?').get(productId) as { stock: number }).stock;
  check('descuenta stock al vender', stockAfterSale === stockBefore - 2, `${stockBefore} → ${stockAfterSale}`);

  const pending = orders.getPendingProofs();
  check('el comprobante aparece como pendiente de revisión', pending.some((p) => p.order_number === (rejectable.ok ? rejectable.orderNumber : '')), `pendientes: ${pending.length}`);

  const rejectOrder = db
    .prepare('SELECT id FROM orders WHERE order_number = ?')
    .get(rejectable.ok ? rejectable.orderNumber : '') as { id: number } | undefined;

  const proof = db
    .prepare('SELECT id FROM payment_proofs WHERE order_id = ?')
    .get(rejectOrder!.id) as { id: number } | undefined;
  const proofAccess = orders.getProofForAccess(proof!.id);
  check('el administrador puede abrir el comprobante', Boolean(proofAccess) && proofAccess!.mime_type === 'image/png', JSON.stringify(proofAccess?.mime_type));

  const rejected = orders.updateOrder({
    orderId: rejectOrder!.id,
    status: 'rechazado',
    paymentStatus: 'rechazado',
    adminNote: 'Comprobante ilegible',
    adminId,
    restoreStock: true,
  });
  check('el administrador rechaza el pedido', rejected.ok === true, JSON.stringify(rejected));

  const stockAfterReject = (db.prepare('SELECT stock FROM products WHERE id = ?').get(productId) as { stock: number }).stock;
  check('el rechazo repone el stock', stockAfterReject === stockBefore, `${stockAfterSale} → ${stockAfterReject}`);

  const rejectedRow = db
    .prepare('SELECT status, payment_status FROM orders WHERE id = ?')
    .get(rejectOrder!.id) as { status: string; payment_status: string };
  check('el pedido queda rechazado con pago rechazado', rejectedRow.status === 'rechazado' && rejectedRow.payment_status === 'rechazado', JSON.stringify(rejectedRow));

  /* -------------------------------------------------------------- */
  /* 9. Aislamiento entre clientes                                   */
  /* -------------------------------------------------------------- */

  const ownOrder = orders.getOrderForUser(saldoOrder.ok ? saldoOrder.orderNumber : '', buyerId);
  check('el cliente ve su propio pedido', ownOrder !== null && ownOrder?.order_number === (saldoOrder.ok ? saldoOrder.orderNumber : ''), JSON.stringify(ownOrder?.order_number));

  const foreignOrder = orders.getOrderForUser(saldoOrder.ok ? saldoOrder.orderNumber : '', strangerId);
  check('otro cliente no puede ver el pedido ajeno', foreignOrder === null, JSON.stringify(foreignOrder));

  const strangerOrders = orders.getUserOrders(strangerId);
  check('el historial ajeno no incluye pedidos de otros', strangerOrders.length === 0, `pedidos: ${strangerOrders.length}`);

  const buyerOrders = orders.getUserOrders(buyerId);
  check('el historial propio lista sus pedidos', buyerOrders.length === 2, `pedidos: ${buyerOrders.length}`);

  const adminOrders = orders.getAdminOrders({});
  check('el administrador ve todos los pedidos', adminOrders.length === 2, `pedidos: ${adminOrders.length}`);

  /* -------------------------------------------------------------- */
  /* 10. Clientes y resumen                                          */
  /* -------------------------------------------------------------- */

  const customers = orders.getCustomers('comprador@novastore.pe');
  check('el panel encuentra al cliente por correo', customers.length === 1, `clientes: ${customers.length}`);

  const toggled = admin.toggleUserActive(strangerId);
  check('el administrador desactiva una cuenta', toggled.ok === true, JSON.stringify(toggled));
  const strangerActive = (
    db.prepare('SELECT is_active FROM users WHERE id = ?').get(strangerId) as { is_active: number }
  ).is_active;
  check('la cuenta queda inactiva', strangerActive === 0, String(strangerActive));

  const stats = orders.getDashboardStats();
  check('el resumen de ventas cuenta los pedidos', stats.ordersTotal >= 2, JSON.stringify(stats));

  /* -------------------------------------------------------------- */
  /* 11. Eliminación en el catálogo                                  */
  /* -------------------------------------------------------------- */

  // Producto con pedidos: no se borra, se desactiva para conservar el historial.
  const deleteOrdered = admin.deleteProduct(productId);
  check('no borra un producto con pedidos', deleteOrdered.ok === false, JSON.stringify(deleteOrdered));
  const orderedActive = (
    db.prepare('SELECT is_active FROM products WHERE id = ?').get(productId) as { is_active: number }
  ).is_active;
  check('el producto con pedidos queda desactivado', orderedActive === 0, String(orderedActive));

  // Producto sin pedidos: se elimina de verdad.
  const disposable = admin.saveProduct({
    name: 'Producto Desechable',
    description: '',
    categoryId: null,
    imageUrl: null,
    priceCents: 500,
    comparePriceCents: null,
    stock: 1,
    isActive: true,
    isFeatured: false,
    variants: [],
  });
  const disposableId = disposable.ok ? disposable.id : 0;
  const deletedProduct = admin.deleteProduct(disposableId);
  check('elimina un producto sin pedidos', deletedProduct.ok === true, JSON.stringify(deletedProduct));
  check(
    'el producto desaparece del catálogo',
    !admin.listAdminProducts().some((p) => p.id === disposableId),
  );

  // Categoría con productos: se protege.
  const deleteFilledCategory = admin.deleteCategory(categoryId);
  check('no borra una categoría con productos', deleteFilledCategory.ok === false, JSON.stringify(deleteFilledCategory));

  // Categoría vacía: se elimina.
  const emptyCat = admin.saveCategory({
    name: 'Categoría Vacía',
    description: '',
    imageUrl: null,
    position: 101,
    isActive: true,
  });
  const emptyCatId = emptyCat.ok ? emptyCat.id : 0;
  const deletedCategory = admin.deleteCategory(emptyCatId);
  check('elimina una categoría vacía', deletedCategory.ok === true, JSON.stringify(deletedCategory));
  check('la categoría vacía desaparece', !db.prepare('SELECT 1 FROM categories WHERE id = ?').get(emptyCatId));

  /* -------------------------------------------------------------- */

  fs.rmSync(tmpDir, { recursive: true, force: true });

  if (failures > 0) {
    console.error(`\n${failures} comprobación(es) fallaron.`);
    process.exit(1);
  }
  console.log('\nTodas las comprobaciones del panel administrativo pasaron.');
}

main().catch((error) => {
  console.error('Error ejecutando la regresión del panel administrativo:', error);
  process.exit(1);
});
