/**
 * Regresión de las funciones de recarga de saldo y soporte privado.
 * Usa una base temporal para no tocar los datos reales de la tienda.
 */
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'novastore-recharge-'));
process.env.DATABASE_PATH = path.join(tmpDir, 'regression.db');

async function main() {
  const { getDb } = await import('../src/lib/db');
  const rechargeModule = await import('../src/lib/recharge');
  const {
    RECHARGE_MIN_CENTS,
    countPendingRecharges,
    createRechargeRequest,
    getMyRecharges,
    reviewRechargeRequest,
  } = rechargeModule;
  const {
    countUnreadForAdmin,
    countUnreadForUser,
    getMessages,
    getThreadForUser,
    markThreadRead,
    sendAdminMessage,
    sendCustomerMessage,
  } = await import('../src/lib/support');

  const db = getDb();

  // 1. Las tablas nuevas existen en una base recién migrada.
  const tables = (
    db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as { name: string }[]
  ).map((r) => r.name);
  for (const table of ['recharge_requests', 'support_threads', 'support_messages']) {
    assert.ok(tables.includes(table), `Falta la tabla ${table}`);
  }

  // 2. Usuarios de prueba (solo columnas que existan realmente).
  const userCols = (db.prepare('PRAGMA table_info(users)').all() as { name: string }[]).map(
    (c) => c.name,
  );
  const insertUser = (email: string, role = 'customer') => {
    const row: Record<string, unknown> = {
      name: `Prueba ${email.split('@')[0]}`,
      email,
      password_hash: 'x',
      role,
      balance_cents: 0,
      created_at: new Date().toISOString(),
    };
    const entries = Object.entries(row).filter(([key]) => userCols.includes(key));
    const keys = entries.map(([key]) => key);
    const info = db
      .prepare(`INSERT INTO users (${keys.join(',')}) VALUES (${keys.map(() => '?').join(',')})`)
      .run(...entries.map(([, value]) => value));
    return Number(info.lastInsertRowid);
  };

  const clienteA = insertUser('cliente.a@test.pe');
  const clienteB = insertUser('cliente.b@test.pe');
  const adminId = insertUser('admin.regresion@test.pe', 'admin');

  const balanceOf = (id: number) =>
    (db.prepare('SELECT balance_cents FROM users WHERE id = ?').get(id) as {
      balance_cents: number;
    }).balance_cents;

  const method = db
    .prepare("SELECT code FROM payment_methods WHERE is_enabled = 1 AND code <> 'saldo' LIMIT 1")
    .get() as { code: string } | undefined;
  assert.ok(method, 'Debe existir al menos un método de pago habilitado');

  // 3. Recarga sin comprobante: debe rechazarse.
  const sinComprobante = await createRechargeRequest({
    userId: clienteA,
    amountCents: 5000,
    method: method.code,
    reference: '',
    note: '',
    file: null,
  });
  assert.equal(sinComprobante.ok, false, 'No debe aceptar una recarga sin comprobante');

  // 4. Monto por debajo del mínimo: debe rechazarse.
  const montoBajo = await createRechargeRequest({
    userId: clienteA,
    amountCents: 100,
    method: method.code,
    reference: '',
    note: '',
    file: new File([Buffer.from('x')], 'p.png', { type: 'image/png' }),
  });
  assert.equal(montoBajo.ok, false, 'No debe aceptar montos menores al mínimo');

  // 4b. Límites nuevos: mínimo S/ 10.00 y sin monto máximo.
  assert.equal(RECHARGE_MIN_CENTS, 1000, 'El monto mínimo de recarga debe ser S/ 10.00');
  assert.equal(
    'RECHARGE_MAX_CENTS' in rechargeModule,
    false,
    'No debe existir un monto máximo de recarga',
  );

  const casiMinimo = await createRechargeRequest({
    userId: clienteA,
    amountCents: 999,
    method: method.code,
    reference: '',
    note: '',
    file: new File([Buffer.from('x')], 'p.png', { type: 'image/png' }),
  });
  assert.equal(casiMinimo.ok, false, 'S/ 9.99 debe rechazarse por debajo del mínimo');

  const montoMinimo = await createRechargeRequest({
    userId: clienteB,
    amountCents: RECHARGE_MIN_CENTS,
    method: method.code,
    reference: '',
    note: '',
    file: new File([Buffer.from('x')], 'minimo.png', { type: 'image/png' }),
  });
  assert.ok(montoMinimo.ok, 'Debe aceptar exactamente S/ 10.00');
  if (montoMinimo.ok) db.prepare('DELETE FROM recharge_requests WHERE id = ?').run(montoMinimo.id);

  const montoAlto = await createRechargeRequest({
    userId: clienteB,
    amountCents: 500000,
    method: method.code,
    reference: '',
    note: '',
    file: new File([Buffer.from('x')], 'alto.png', { type: 'image/png' }),
  });
  assert.ok(montoAlto.ok, 'No debe existir monto máximo: S/ 5,000 debe aceptarse');
  if (montoAlto.ok) db.prepare('DELETE FROM recharge_requests WHERE id = ?').run(montoAlto.id);

  // 5. Recarga válida: queda pendiente hasta que el admin la revise.
  const valida = await createRechargeRequest({
    userId: clienteA,
    amountCents: 5000,
    method: method.code,
    reference: 'OP-123',
    note: 'Pago de prueba',
    file: new File([Buffer.from('png-falso')], 'comprobante.png', { type: 'image/png' }),
  });
  assert.ok(valida.ok, 'La solicitud válida debe crearse');
  const rechargeId = valida.ok ? valida.id : 0;
  assert.equal(countPendingRecharges(), 1, 'Debe haber una solicitud pendiente');
  assert.equal(balanceOf(clienteA), 0, 'El saldo no debe acreditarse sin revisión');
  assert.equal(getMyRecharges(clienteA).length, 1, 'El cliente debe ver su solicitud');
  assert.equal(getMyRecharges(clienteB).length, 0, 'Otro cliente no debe ver la solicitud');

  // 6. Aprobación: acredita saldo una sola vez.
  const aprobada = reviewRechargeRequest({
    id: rechargeId,
    action: 'aprobar',
    adminId,
    adminNote: 'Verificado',
  });
  assert.ok(aprobada.ok, 'La aprobación debe funcionar');
  assert.equal(balanceOf(clienteA), 5000, 'El saldo debe acreditarse exactamente una vez');

  const repetida = reviewRechargeRequest({
    id: rechargeId,
    action: 'aprobar',
    adminId,
    adminNote: '',
  });
  assert.equal(repetida.ok, false, 'No debe permitir aprobar dos veces la misma recarga');
  assert.equal(balanceOf(clienteA), 5000, 'El saldo no debe duplicarse');

  // 7. Rechazo con motivo.
  const segunda = await createRechargeRequest({
    userId: clienteB,
    amountCents: 3000,
    method: method.code,
    reference: '',
    note: '',
    file: new File([Buffer.from('jpg-falso')], 'p.jpg', { type: 'image/jpeg' }),
  });
  assert.ok(segunda.ok);
  const rechazada = reviewRechargeRequest({
    id: segunda.ok ? segunda.id : 0,
    action: 'rechazar',
    adminId,
    adminNote: 'Comprobante ilegible',
  });
  assert.ok(rechazada.ok);
  assert.equal(balanceOf(clienteB), 0, 'Un rechazo no debe acreditar saldo');

  // 8. Soporte privado: cada cliente ve solo su conversación.
  assert.equal(sendCustomerMessage(clienteA, '   ').ok, false, 'No debe aceptar mensajes vacíos');
  assert.ok(sendCustomerMessage(clienteA, 'Hola, tengo un problema con mi pedido').ok);
  const threadA = getThreadForUser(clienteA);
  assert.ok(threadA, 'Debe crearse la conversación del cliente A');
  assert.equal(countUnreadForAdmin(), 1, 'El admin debe tener un mensaje sin leer');
  assert.ok(sendAdminMessage(adminId, threadA.id, 'Claro, cuéntame más').ok);

  const mensajes = getMessages(threadA.id);
  assert.equal(mensajes.length, 2, 'La conversación debe tener dos mensajes');
  assert.equal(mensajes[0].sender_role, 'customer');
  assert.equal(mensajes[1].sender_role, 'admin');
  assert.equal(getThreadForUser(clienteB), undefined, 'El cliente B no debe tener esa conversación');

  markThreadRead(threadA.id, 'customer');
  assert.equal(countUnreadForUser(clienteA), 0, 'Tras leer, no deben quedar mensajes pendientes');

  // 9. Persistencia: los datos siguen en el archivo tras reabrir la base.
  const Database = (await import('better-sqlite3')).default;
  const fresh = new Database(process.env.DATABASE_PATH as string);
  const recargas = (fresh.prepare('SELECT COUNT(*) AS c FROM recharge_requests').get() as {
    c: number;
  }).c;
  const mensajesGuardados = (fresh.prepare('SELECT COUNT(*) AS c FROM support_messages').get() as {
    c: number;
  }).c;
  fresh.close();
  assert.equal(recargas, 2, 'Las recargas deben persistir en disco');
  assert.equal(mensajesGuardados, 2, 'Los mensajes deben persistir en disco');

  console.log('OK recargas + soporte: solicitud, comprobante, aprobación única, rechazo, aislamiento y persistencia.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
