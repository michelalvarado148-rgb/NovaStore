import crypto from 'node:crypto';
import { getDb, nowIso } from './db';
import { buildCartDetail } from './cart';
import { getActiveOffers, getPaymentMethods, getSetting } from './catalog';
import { maskName } from './format';

export type OrderStatus = 'pendiente' | 'en_proceso' | 'entregado' | 'rechazado' | 'cancelado';
export type PaymentStatus = 'pendiente' | 'verificado' | 'rechazado';

/** Código del método de pago que usa el saldo a favor del cliente. */
export const SALDO_METHOD = 'saldo';

/** Mensaje único cuando el saldo no alcanza; se muestra tal cual en el checkout. */
export const INSUFFICIENT_BALANCE_MESSAGE =
  'No tienes saldo suficiente para realizar esta compra. Recarga tu saldo para continuar';

/** Se lanza dentro de la transacción para revertir el pedido si el saldo no alcanza. */
class InsufficientBalanceError extends Error {
  constructor() {
    super('saldo-insuficiente');
    this.name = 'InsufficientBalanceError';
  }
}

export type OrderSummary = {
  id: number;
  order_number: string;
  user_id: number;
  status: OrderStatus;
  payment_method: string;
  payment_status: PaymentStatus;
  subtotal_cents: number;
  discount_cents: number;
  total_cents: number;
  contact_email: string;
  contact_phone: string | null;
  customer_note: string | null;
  admin_note: string | null;
  created_at: string;
  updated_at: string;
  customer_name?: string;
  customer_email?: string;
  items_count?: number;
  has_proof?: number;
};

export type OrderItem = {
  id: number;
  order_id: number;
  product_id: number | null;
  variant_id: number | null;
  product_name: string;
  variant_name: string | null;
  unit_price_cents: number;
  quantity: number;
  line_total_cents: number;
};

export type OrderDetail = OrderSummary & {
  items: OrderItem[];
  proof: { id: number; file_name: string | null; mime_type: string; size_bytes: number } | null;
};

const ORDER_COLUMNS = `o.id, o.order_number, o.user_id, o.status, o.payment_method,
  o.payment_status, o.subtotal_cents, o.discount_cents, o.total_cents, o.contact_email,
  o.contact_phone, o.customer_note, o.admin_note, o.created_at, o.updated_at`;

function generateOrderNumber(): string {
  const db = getDb();
  const prefix = getSetting('order_prefix', 'NV') || 'NV';
  const date = new Date();
  const stamp = `${String(date.getFullYear()).slice(2)}${String(date.getMonth() + 1).padStart(2, '0')}${String(
    date.getDate(),
  ).padStart(2, '0')}`;
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const random = crypto.randomBytes(3).toString('hex').toUpperCase();
    const candidate = `${prefix}-${stamp}-${random}`;
    const exists = db.prepare('SELECT 1 FROM orders WHERE order_number = ?').get(candidate);
    if (!exists) return candidate;
  }
  return `${prefix}-${stamp}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
}

export type ProofInput = {
  fileName: string;
  mimeType: string;
  size: number;
  data: Buffer;
};

export type PlaceOrderInput = {
  userId: number;
  paymentMethod: string;
  contactEmail: string;
  contactPhone: string;
  customerNote?: string;
  idempotencyKey: string;
  proof: ProofInput | null;
};

export type PlaceOrderResult =
  | { ok: true; orderNumber: string; duplicated: boolean }
  | { ok: false; error: string };

export function placeOrder(input: PlaceOrderInput): PlaceOrderResult {
  const db = getDb();

  const existing = db
    .prepare('SELECT order_number FROM orders WHERE idempotency_key = ?')
    .get(input.idempotencyKey) as { order_number: string } | undefined;
  if (existing) {
    return { ok: true, orderNumber: existing.order_number, duplicated: true };
  }

  const methods = getPaymentMethods(true);
  const method = methods.find((m) => m.code === input.paymentMethod);
  if (!method) {
    return { ok: false, error: 'Selecciona un método de pago válido.' };
  }

  const cartRow = db.prepare('SELECT id FROM carts WHERE user_id = ?').get(input.userId) as
    | { id: number }
    | undefined;
  const cart = buildCartDetail(cartRow?.id ?? null, getActiveOffers());

  if (!cart.cartId || cart.lines.length === 0) {
    return { ok: false, error: 'Tu carrito está vacío.' };
  }

  for (const line of cart.lines) {
    if (!line.is_active) {
      return { ok: false, error: `El producto "${line.name}" ya no está disponible.` };
    }
    if (line.stock !== null && line.quantity > line.stock) {
      return {
        ok: false,
        error: `Stock insuficiente para "${line.name}". Disponible: ${line.stock}.`,
      };
    }
  }

  if (method.code !== SALDO_METHOD && !input.proof) {
    return {
      ok: false,
      error: 'Adjunta la imagen de tu comprobante de pago para continuar.',
    };
  }

  const total = cart.subtotal_cents;
  if (!Number.isFinite(total) || total <= 0) {
    return { ok: false, error: 'El total del pedido no es válido.' };
  }

  const user = db
    .prepare('SELECT id, balance_cents FROM users WHERE id = ?')
    .get(input.userId) as { id: number; balance_cents: number } | undefined;
  if (!user) return { ok: false, error: 'Tu sesión expiró. Vuelve a iniciar sesión.' };

  const payingWithBalance = method.code === SALDO_METHOD;
  if (payingWithBalance && user.balance_cents < total) {
    return { ok: false, error: INSUFFICIENT_BALANCE_MESSAGE };
  }

  const now = nowIso();
  const orderNumber = generateOrderNumber();
  // El pago con saldo se cobra en el acto: el pedido nace con el pago ya verificado.
  const initialPaymentStatus: PaymentStatus = payingWithBalance ? 'verificado' : 'pendiente';

  const createTx = db.transaction(() => {
    const info = db
      .prepare(
        `INSERT INTO orders (order_number, idempotency_key, user_id, status, payment_method,
           payment_status, subtotal_cents, discount_cents, total_cents, contact_email,
           contact_phone, customer_note, created_at, updated_at)
         VALUES (?, ?, ?, 'pendiente', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        orderNumber,
        input.idempotencyKey,
        input.userId,
        method.code,
        initialPaymentStatus,
        cart.subtotal_cents,
        cart.savings_cents,
        total,
        input.contactEmail,
        input.contactPhone || null,
        input.customerNote?.slice(0, 500) || null,
        now,
        now,
      );
    const orderId = Number(info.lastInsertRowid);

    const insertItem = db.prepare(
      `INSERT INTO order_items (order_id, product_id, variant_id, product_name, variant_name,
         unit_price_cents, quantity, line_total_cents)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    const decrementProduct = db.prepare(
      'UPDATE products SET stock = stock - ?, sold_count = sold_count + ?, updated_at = ? WHERE id = ? AND stock IS NOT NULL',
    );
    const decrementVariant = db.prepare(
      'UPDATE product_variants SET stock = stock - ? WHERE id = ? AND stock IS NOT NULL',
    );
    const bumpSold = db.prepare(
      'UPDATE products SET sold_count = sold_count + ?, updated_at = ? WHERE id = ?',
    );

    for (const line of cart.lines) {
      insertItem.run(
        orderId,
        line.product_id,
        line.variant_id,
        line.name,
        line.variant_name,
        line.unit_price_cents,
        line.quantity,
        line.line_total_cents,
      );
      if (line.variant_id && line.stock !== null) {
        decrementVariant.run(line.quantity, line.variant_id);
      }
      const productHasStock = db
        .prepare('SELECT stock FROM products WHERE id = ?')
        .get(line.product_id) as { stock: number | null } | undefined;
      if (productHasStock && productHasStock.stock !== null) {
        decrementProduct.run(line.quantity, line.quantity, now, line.product_id);
      } else {
        bumpSold.run(line.quantity, now, line.product_id);
      }
    }

    if (input.proof) {
      db.prepare(
        `INSERT INTO payment_proofs (order_id, user_id, file_name, mime_type, size_bytes, data, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        orderId,
        input.userId,
        input.proof.fileName.slice(0, 200),
        input.proof.mimeType,
        input.proof.size,
        input.proof.data,
        now,
      );
    }

    if (payingWithBalance) {
      // Descuento atómico y condicional: solo se aplica si el saldo real alcanza el total.
      // Si otra compra simultánea consumió el saldo, changes === 0 y se revierte todo el pedido.
      const debit = db
        .prepare(
          'UPDATE users SET balance_cents = balance_cents - ?, updated_at = ? WHERE id = ? AND balance_cents >= ?',
        )
        .run(total, now, input.userId, total);
      if (debit.changes !== 1) {
        throw new InsufficientBalanceError();
      }
      db.prepare(
        `INSERT INTO balance_movements (user_id, amount_cents, type, description, order_id, created_by, created_at)
         VALUES (?, ?, 'compra', ?, ?, NULL, ?)`,
      ).run(input.userId, -total, `Pago del pedido ${orderNumber}`, orderId, now);
    }

    db.prepare('DELETE FROM cart_items WHERE cart_id = ?').run(cart.cartId);
    db.prepare('UPDATE carts SET updated_at = ? WHERE id = ?').run(now, cart.cartId);
  });

  try {
    createTx();
  } catch (error) {
    if (error instanceof InsufficientBalanceError) {
      return { ok: false, error: INSUFFICIENT_BALANCE_MESSAGE };
    }
    const message = error instanceof Error ? error.message : 'Error desconocido';
    if (message.includes('UNIQUE') && message.includes('idempotency')) {
      const dup = db
        .prepare('SELECT order_number FROM orders WHERE idempotency_key = ?')
        .get(input.idempotencyKey) as { order_number: string } | undefined;
      if (dup) return { ok: true, orderNumber: dup.order_number, duplicated: true };
    }
    return { ok: false, error: 'No pudimos registrar tu pedido. Intenta nuevamente.' };
  }

  return { ok: true, orderNumber, duplicated: false };
}

export function getUserOrders(userId: number): OrderSummary[] {
  return getDb()
    .prepare(
      `SELECT ${ORDER_COLUMNS}, (SELECT COALESCE(SUM(quantity), 0) FROM order_items oi WHERE oi.order_id = o.id) AS items_count,
              (SELECT COUNT(*) FROM payment_proofs pp WHERE pp.order_id = o.id) AS has_proof
         FROM orders o
        WHERE o.user_id = ?
        ORDER BY o.id DESC`,
    )
    .all(userId) as OrderSummary[];
}

export function getOrderForUser(orderNumber: string, userId: number): OrderDetail | null {
  const db = getDb();
  const order = db
    .prepare(`SELECT ${ORDER_COLUMNS} FROM orders o WHERE o.order_number = ? AND o.user_id = ?`)
    .get(orderNumber, userId) as OrderSummary | undefined;
  if (!order) return null;
  return attachDetail(order);
}

export function getOrderById(orderId: number): OrderDetail | null {
  const order = getDb()
    .prepare(`SELECT ${ORDER_COLUMNS} FROM orders o WHERE o.id = ?`)
    .get(orderId) as OrderSummary | undefined;
  if (!order) return null;
  return attachDetail(order);
}

function attachDetail(order: OrderSummary): OrderDetail {
  const db = getDb();
  const items = db
    .prepare('SELECT * FROM order_items WHERE order_id = ? ORDER BY id ASC')
    .all(order.id) as OrderItem[];
  const proof = db
    .prepare(
      'SELECT id, file_name, mime_type, size_bytes FROM payment_proofs WHERE order_id = ? ORDER BY id DESC LIMIT 1',
    )
    .get(order.id) as OrderDetail['proof'];
  return { ...order, items, proof: proof ?? null };
}

export function getProofForAccess(proofId: number): {
  data: Buffer;
  mime_type: string;
  user_id: number;
  order_id: number;
} | null {
  const row = getDb()
    .prepare('SELECT data, mime_type, user_id, order_id FROM payment_proofs WHERE id = ?')
    .get(proofId) as
    | { data: Buffer; mime_type: string; user_id: number; order_id: number }
    | undefined;
  return row ?? null;
}

export type AdminOrderFilter = {
  status?: string;
  search?: string;
  paymentStatus?: string;
  limit?: number;
};

export function getAdminOrders(filter: AdminOrderFilter = {}): OrderSummary[] {
  const clauses: string[] = [];
  const params: string[] = [];

  if (filter.status && filter.status !== 'todos') {
    clauses.push('o.status = ?');
    params.push(filter.status);
  }
  if (filter.paymentStatus && filter.paymentStatus !== 'todos') {
    clauses.push('o.payment_status = ?');
    params.push(filter.paymentStatus);
  }
  if (filter.search) {
    clauses.push('(o.order_number LIKE ? OR u.name LIKE ? OR u.email LIKE ?)');
    const term = `%${filter.search.trim()}%`;
    params.push(term, term, term);
  }

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const limit = filter.limit ? `LIMIT ${Math.max(1, Math.floor(filter.limit))}` : '';

  return getDb()
    .prepare(
      `SELECT ${ORDER_COLUMNS}, u.name AS customer_name, u.email AS customer_email,
              (SELECT COALESCE(SUM(quantity), 0) FROM order_items oi WHERE oi.order_id = o.id) AS items_count,
              (SELECT COUNT(*) FROM payment_proofs pp WHERE pp.order_id = o.id) AS has_proof
         FROM orders o
         JOIN users u ON u.id = o.user_id
         ${where}
        ORDER BY o.id DESC ${limit}`,
    )
    .all(...params) as OrderSummary[];
}

export function getPendingProofs(): OrderSummary[] {
  return getDb()
    .prepare(
      `SELECT ${ORDER_COLUMNS}, u.name AS customer_name, u.email AS customer_email,
              (SELECT COUNT(*) FROM payment_proofs pp WHERE pp.order_id = o.id) AS has_proof
         FROM orders o
         JOIN users u ON u.id = o.user_id
        WHERE o.payment_status = 'pendiente'
        ORDER BY o.id DESC`,
    )
    .all() as OrderSummary[];
}

export function restoreStockForOrder(orderId: number): void {
  const db = getDb();
  const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(orderId) as OrderItem[];
  const now = nowIso();
  for (const item of items) {
    if (item.product_id) {
      db.prepare(
        'UPDATE products SET stock = stock + ?, sold_count = MAX(0, sold_count - ?), updated_at = ? WHERE id = ? AND stock IS NOT NULL',
      ).run(item.quantity, item.quantity, now, item.product_id);
      db.prepare(
        'UPDATE products SET sold_count = MAX(0, sold_count - ?) WHERE id = ? AND stock IS NULL',
      ).run(item.quantity, item.product_id);
    }
    if (item.variant_id) {
      db.prepare(
        'UPDATE product_variants SET stock = stock + ? WHERE id = ? AND stock IS NOT NULL',
      ).run(item.quantity, item.variant_id);
    }
  }
}

export type UpdateOrderInput = {
  orderId: number;
  status?: OrderStatus;
  paymentStatus?: PaymentStatus;
  adminNote?: string;
  adminId: number;
  restoreStock?: boolean;
};

export function updateOrder(input: UpdateOrderInput): { ok: true } | { ok: false; error: string } {
  const db = getDb();
  const order = db
    .prepare('SELECT * FROM orders WHERE id = ?')
    .get(input.orderId) as
    | {
        id: number;
        order_number: string;
        user_id: number;
        status: OrderStatus;
        payment_method: string;
        payment_status: PaymentStatus;
        total_cents: number;
      }
    | undefined;

  if (!order) return { ok: false, error: 'El pedido no existe.' };

  const nextStatus = input.status ?? order.status;
  const nextPayment = input.paymentStatus ?? order.payment_status;
  const now = nowIso();

  const tx = db.transaction(() => {
    db.prepare(
      `UPDATE orders SET status = ?, payment_status = ?, admin_note = ?, reviewed_by = ?, reviewed_at = ?, updated_at = ?
        WHERE id = ?`,
    ).run(
      nextStatus,
      nextPayment,
      input.adminNote?.slice(0, 500) ?? null,
      input.adminId,
      now,
      now,
      order.id,
    );

    const wasClosed = order.status === 'rechazado' || order.status === 'cancelado';
    const isClosed = nextStatus === 'rechazado' || nextStatus === 'cancelado';
    if (input.restoreStock || (!wasClosed && isClosed)) {
      const alreadyRestored = db
        .prepare('SELECT 1 FROM balance_movements WHERE order_id = ? AND type = ?')
        .get(order.id, 'ajuste');
      if (!alreadyRestored) {
        restoreStockForOrder(order.id);
      }
    }

    const paidWithBalance = order.payment_method === SALDO_METHOD;
    // Reembolso único al rechazar el pago o cerrar (rechazar/cancelar) un pedido pagado con saldo.
    if (paidWithBalance && (isClosed || nextPayment === 'rechazado')) {
      const alreadyRefunded = db
        .prepare("SELECT 1 FROM balance_movements WHERE order_id = ? AND type = 'reembolso'")
        .get(order.id);
      if (!alreadyRefunded) {
        db.prepare('UPDATE users SET balance_cents = balance_cents + ? WHERE id = ?').run(
          order.total_cents,
          order.user_id,
        );
        db.prepare(
          `INSERT INTO balance_movements (user_id, amount_cents, type, description, order_id, created_by, created_at)
           VALUES (?, ?, 'reembolso', ?, ?, ?, ?)`,
        ).run(
          order.user_id,
          order.total_cents,
          `Reembolso del pedido ${order.order_number}`,
          order.id,
          input.adminId,
          now,
        );
      }
    }
  });

  try {
    tx();
    return { ok: true };
  } catch {
    return { ok: false, error: 'No se pudo actualizar el pedido.' };
  }
}

export type BalanceMovement = {
  id: number;
  user_id: number;
  amount_cents: number;
  type: 'recarga' | 'compra' | 'reembolso' | 'ajuste';
  description: string;
  order_id: number | null;
  created_by: number | null;
  created_at: string;
  customer_name?: string;
  customer_email?: string;
};

export function adjustBalance(input: {
  userId: number;
  amountCents: number;
  type: 'recarga' | 'compra' | 'reembolso' | 'ajuste';
  description: string;
  adminId: number;
}): { ok: true } | { ok: false; error: string } {
  const db = getDb();
  if (!Number.isFinite(input.amountCents) || input.amountCents === 0) {
    return { ok: false, error: 'Ingresa un monto distinto de cero.' };
  }
  const user = db
    .prepare('SELECT id, balance_cents FROM users WHERE id = ?')
    .get(input.userId) as { id: number; balance_cents: number } | undefined;
  if (!user) return { ok: false, error: 'El cliente no existe.' };
  if (user.balance_cents + input.amountCents < 0) {
    return { ok: false, error: 'El saldo no puede quedar en negativo.' };
  }

  const tx = db.transaction(() => {
    db.prepare('UPDATE users SET balance_cents = balance_cents + ? WHERE id = ?').run(
      input.amountCents,
      input.userId,
    );
    db.prepare(
      `INSERT INTO balance_movements (user_id, amount_cents, type, description, order_id, created_by, created_at)
       VALUES (?, ?, ?, ?, NULL, ?, ?)`,
    ).run(
      input.userId,
      input.amountCents,
      input.type,
      input.description.slice(0, 200),
      input.adminId,
      nowIso(),
    );
  });
  tx();
  return { ok: true };
}

export function getUserBalance(userId: number): number {
  const row = getDb()
    .prepare('SELECT balance_cents FROM users WHERE id = ?')
    .get(userId) as { balance_cents: number } | undefined;
  return row?.balance_cents ?? 0;
}

export function getBalanceMovements(userId?: number, limit = 100): BalanceMovement[] {
  const db = getDb();
  if (userId) {
    return db
      .prepare(
        'SELECT * FROM balance_movements WHERE user_id = ? ORDER BY id DESC LIMIT ?',
      )
      .all(userId, limit) as BalanceMovement[];
  }
  return db
    .prepare(
      `SELECT bm.*, u.name AS customer_name, u.email AS customer_email
         FROM balance_movements bm
         JOIN users u ON u.id = bm.user_id
        ORDER BY bm.id DESC LIMIT ?`,
    )
    .all(limit) as BalanceMovement[];
}

export type DashboardStats = {
  salesTodayCents: number;
  salesMonthCents: number;
  salesTotalCents: number;
  ordersTotal: number;
  ordersPending: number;
  proofsPending: number;
  customers: number;
  lowStock: number;
  topProducts: { product_name: string; units: number; revenue: number }[];
  last7Days: { day: string; total: number }[];
};

export function getDashboardStats(): DashboardStats {
  const db = getDb();
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const startOfMonth = new Date(startOfDay.getFullYear(), startOfDay.getMonth(), 1);

  const sum = (since: Date | null) => {
    const row = since
      ? (db
          .prepare(
            "SELECT COALESCE(SUM(total_cents), 0) AS total FROM orders WHERE payment_status = 'verificado' AND created_at >= ?",
          )
          .get(since.toISOString()) as { total: number })
      : (db
          .prepare(
            "SELECT COALESCE(SUM(total_cents), 0) AS total FROM orders WHERE payment_status = 'verificado'",
          )
          .get() as { total: number });
    return row.total;
  };

  const ordersTotal = (
    db.prepare('SELECT COUNT(*) AS total FROM orders').get() as { total: number }
  ).total;
  const ordersPending = (
    db.prepare("SELECT COUNT(*) AS total FROM orders WHERE status = 'pendiente'").get() as {
      total: number;
    }
  ).total;
  const proofsPending = (
    db
      .prepare(
        "SELECT COUNT(*) AS total FROM orders WHERE payment_status = 'pendiente' AND status != 'rechazado'",
      )
      .get() as { total: number }
  ).total;
  const customers = (
    db.prepare("SELECT COUNT(*) AS total FROM users WHERE role = 'customer'").get() as {
      total: number;
    }
  ).total;
  const lowStock = (
    db
      .prepare('SELECT COUNT(*) AS total FROM products WHERE is_active = 1 AND stock IS NOT NULL AND stock <= 5')
      .get() as { total: number }
  ).total;

  const topProducts = db
    .prepare(
      `SELECT oi.product_name, SUM(oi.quantity) AS units, SUM(oi.line_total_cents) AS revenue
         FROM order_items oi
         JOIN orders o ON o.id = oi.order_id
        WHERE o.payment_status = 'verificado'
        GROUP BY oi.product_name
        ORDER BY units DESC LIMIT 5`,
    )
    .all() as { product_name: string; units: number; revenue: number }[];

  const last7Days: { day: string; total: number }[] = [];
  for (let i = 6; i >= 0; i -= 1) {
    const day = new Date(startOfDay);
    day.setDate(day.getDate() - i);
    const next = new Date(day);
    next.setDate(next.getDate() + 1);
    const row = db
      .prepare(
        `SELECT COALESCE(SUM(total_cents), 0) AS total FROM orders
          WHERE payment_status = 'verificado' AND created_at >= ? AND created_at < ?`,
      )
      .get(day.toISOString(), next.toISOString()) as { total: number };
    last7Days.push({
      day: new Intl.DateTimeFormat('es-PE', { weekday: 'short', day: '2-digit' }).format(day),
      total: row.total,
    });
  }

  return {
    salesTodayCents: sum(startOfDay),
    salesMonthCents: sum(startOfMonth),
    salesTotalCents: sum(null),
    ordersTotal,
    ordersPending,
    proofsPending,
    customers,
    lowStock,
    topProducts,
    last7Days,
  };
}

export type CustomerRow = {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  role: string;
  balance_cents: number;
  is_active: number;
  created_at: string;
  orders_count: number;
  spent_cents: number;
};

export function getCustomers(search?: string): CustomerRow[] {
  const params: string[] = [];
  let where = '';
  if (search) {
    where = 'WHERE (u.name LIKE ? OR u.email LIKE ?)';
    const term = `%${search.trim()}%`;
    params.push(term, term);
  }
  return getDb()
    .prepare(
      `SELECT u.id, u.name, u.email, u.phone, u.role, u.balance_cents, u.is_active, u.created_at,
              (SELECT COUNT(*) FROM orders o WHERE o.user_id = u.id) AS orders_count,
              (SELECT COALESCE(SUM(o.total_cents), 0) FROM orders o
                WHERE o.user_id = u.id AND o.payment_status = 'verificado') AS spent_cents
         FROM users u ${where}
        ORDER BY u.id DESC`,
    )
    .all(...params) as CustomerRow[];
}

export function getRecentPurchasesPublic(limit = 6): {
  order_number: string;
  created_at: string;
  buyer: string;
  product_name: string;
  quantity: number;
}[] {
  const rows = getDb()
    .prepare(
      `SELECT o.order_number, o.created_at, u.name AS buyer, oi.product_name, oi.quantity
         FROM orders o
         JOIN users u ON u.id = o.user_id
         JOIN order_items oi ON oi.order_id = o.id
        WHERE o.status IN ('pendiente', 'en_proceso', 'entregado')
        ORDER BY o.id DESC, oi.id ASC
        LIMIT ?`,
    )
    .all(Math.max(1, limit)) as {
    order_number: string;
    created_at: string;
    buyer: string;
    product_name: string;
    quantity: number;
  }[];
  return rows.map((row) => ({ ...row, buyer: maskName(row.buyer) }));
}

export function getCustomerOrderCount(userId: number): number {
  const row = getDb()
    .prepare('SELECT COUNT(*) AS total FROM orders WHERE user_id = ?')
    .get(userId) as { total: number };
  return row.total;
}
