/**
 * Regresión de aprobación y rechazo de recargas de saldo (NOVASTORE).
 *
 * Reproduce el error «Solicitud inválida» y comprueba que la revisión funciona:
 *  - aprobar deja la solicitud en 'aprobado' y acredita el saldo una sola vez
 *  - una segunda aprobación (o dos pestañas a la vez) no vuelve a acreditar
 *  - rechazar deja 'rechazado' sin tocar el saldo
 *  - una solicitud rechazada no se puede aprobar después
 *  - un ID inexistente responde con un mensaje claro
 *  - la aprobación acredita al dueño de la solicitud, no a otro cliente
 *  - los botones del panel envían el ID y la acción por formAction
 *
 * Uso: npm run test:recargas
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

async function main() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'novastore-recargas-'));
  process.env.DATABASE_PATH = path.join(dir, 'recargas.db');
  // Aísla la prueba: no restaura ni replica nada en Supabase.
  process.env.NOVASTORE_DISABLE_SYNC = '1';

  const { getDb, nowIso } = await import('../src/lib/db');
  const { reviewRechargeRequest } = await import('../src/lib/recharge');

  const db = getDb();
  const insertUser = db.prepare(
    `INSERT INTO users (name, email, password_hash, role, balance_cents, is_active, created_at)
     VALUES (?, ?, ?, ?, ?, 1, ?)`,
  );
  const adminId = Number(
    insertUser.run('Admin', 'admin@novastore.pe', 'x', 'admin', 0, nowIso()).lastInsertRowid,
  );
  const clienteId = Number(
    insertUser.run('Cliente', 'cliente@novastore.pe', 'x', 'customer', 5000, nowIso()).lastInsertRowid,
  );
  const otroId = Number(
    insertUser.run('Otro', 'otro@novastore.pe', 'x', 'customer', 700, nowIso()).lastInsertRowid,
  );

  const insertReq = db.prepare(
    `INSERT INTO recharge_requests (user_id, amount_cents, method, reference, note, status, created_at)
     VALUES (?, ?, ?, ?, NULL, 'pendiente', ?)`,
  );
  const reqA = Number(insertReq.run(clienteId, 2000, 'yape', 'OP-1', nowIso()).lastInsertRowid);
  const reqB = Number(insertReq.run(clienteId, 1500, 'plin', 'OP-2', nowIso()).lastInsertRowid);
  const reqC = Number(insertReq.run(otroId, 3000, 'yape', 'OP-3', nowIso()).lastInsertRowid);

  const balance = (id: number) =>
    (db.prepare('SELECT balance_cents FROM users WHERE id = ?').get(id) as { balance_cents: number })
      .balance_cents;
  const movements = (id: number) =>
    (db.prepare('SELECT COUNT(*) AS c FROM balance_movements WHERE user_id = ?').get(id) as { c: number })
      .c;
  const row = (id: number) =>
    db.prepare('SELECT status, admin_note, reviewed_by, reviewed_at FROM recharge_requests WHERE id = ?').get(
      id,
    ) as {
      status: string;
      admin_note: string | null;
      reviewed_by: number | null;
      reviewed_at: string | null;
    };

  /* 1. Aprobar: estado y saldo una sola vez ------------------------------ */
  const aprobado = reviewRechargeRequest({
    id: reqA,
    action: 'aprobar',
    adminId,
    adminNote: 'Comprobante verificado',
  });
  check('aprobar devuelve ok', aprobado.ok === true, JSON.stringify(aprobado));
  check('la solicitud queda aprobada', row(reqA).status === 'aprobado', row(reqA).status);
  check('el saldo se acredita una vez', balance(clienteId) === 7000, `saldo=${balance(clienteId)}`);
  check('se registra un movimiento de saldo', movements(clienteId) === 1, `mov=${movements(clienteId)}`);
  check(
    'se guarda quién revisó y cuándo',
    row(reqA).reviewed_by === adminId && Boolean(row(reqA).reviewed_at),
  );
  check('se guarda la nota del administrador', row(reqA).admin_note === 'Comprobante verificado');

  /* 2. Doble aprobación: no vuelve a acreditar --------------------------- */
  const repetido = reviewRechargeRequest({ id: reqA, action: 'aprobar', adminId, adminNote: '' });
  check('la segunda aprobación falla', repetido.ok === false, JSON.stringify(repetido));
  check(
    'explica que ya fue aprobada',
    repetido.ok === false && /ya fue aprobada/i.test(repetido.error),
    repetido.ok === false ? repetido.error : '',
  );
  check('el saldo no cambia al repetir', balance(clienteId) === 7000, `saldo=${balance(clienteId)}`);
  check('sigue habiendo un solo movimiento', movements(clienteId) === 1);

  /* 3. Rechazar: estado sin acreditar ------------------------------------ */
  const rechazado = reviewRechargeRequest({
    id: reqB,
    action: 'rechazar',
    adminId,
    adminNote: 'Comprobante ilegible',
  });
  check('rechazar devuelve ok', rechazado.ok === true, JSON.stringify(rechazado));
  check('la solicitud queda rechazada', row(reqB).status === 'rechazado');
  check('rechazar no acredita saldo', balance(clienteId) === 7000);
  check('rechazar no crea movimientos', movements(clienteId) === 1);
  check('se guarda el motivo del rechazo', row(reqB).admin_note === 'Comprobante ilegible');

  /* 4. Una rechazada no se puede aprobar después ------------------------- */
  const tardio = reviewRechargeRequest({ id: reqB, action: 'aprobar', adminId, adminNote: '' });
  check('una solicitud rechazada no se aprueba', tardio.ok === false, JSON.stringify(tardio));
  check('el saldo sigue intacto', balance(clienteId) === 7000);

  /* 5. Solicitud inexistente -------------------------------------------- */
  const inexistente = reviewRechargeRequest({ id: 999999, action: 'aprobar', adminId, adminNote: '' });
  check('un ID inexistente falla', inexistente.ok === false);
  check(
    'avisa que la solicitud ya no existe',
    inexistente.ok === false && /ya no existe/i.test(inexistente.error),
    inexistente.ok === false ? inexistente.error : '',
  );

  /* 6. Otro cliente no se ve afectado ----------------------------------- */
  check('otro cliente conserva su saldo', balance(otroId) === 700, `saldo=${balance(otroId)}`);
  const tercero = reviewRechargeRequest({ id: reqC, action: 'aprobar', adminId, adminNote: '' });
  check(
    'la aprobación acredita al dueño de la solicitud',
    tercero.ok === true && balance(otroId) === 3700 && balance(clienteId) === 7000,
    `otro=${balance(otroId)} cliente=${balance(clienteId)}`,
  );

  /* 7. Guardia del envío de ID y acción desde el panel ------------------- */
  const page = fs.readFileSync(path.join(process.cwd(), 'src/app/admin/recargas/page.tsx'), 'utf8');
  const actions = fs.readFileSync(path.join(process.cwd(), 'src/app/actions/recharge.ts'), 'utf8');
  check(
    'los botones usan formAction para aprobar y rechazar',
    page.includes('formAction={approveRechargeAction}') &&
      page.includes('formAction={rejectRechargeAction}'),
  );
  check('ningún botón depende de name="action"', !page.includes('name="action"'));
  check(
    'las acciones existen y reciben el ID del formulario',
    actions.includes('export async function approveRechargeAction') &&
      actions.includes('export async function rejectRechargeAction') &&
      /formData\.get\('id'\)/.test(actions) &&
      actions.includes('Number.isInteger(id)'),
  );

  if (failures > 0) {
    console.error(`\n${failures} comprobación(es) fallaron.`);
    process.exit(1);
  }
  console.log('\nAprobar y rechazar funcionan correctamente.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
