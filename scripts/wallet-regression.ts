/**
 * Regresión de NovaWallet (alcancía independiente de NOVASTORE).
 *
 * Comprueba con una base temporal lo que el usuario pidió explícitamente:
 *  - el saldo de NovaWallet no se mezcla con el saldo de la tienda;
 *  - las recargas y los retiros quedan pendientes y NO mueven dinero;
 *  - el saldo solo cambia cuando el administrador aprueba;
 *  - una aprobación repetida no acredita ni descuenta dos veces;
 *  - los retiros respetan el saldo, el mínimo y la comisión configurable;
 *  - cada operación deja su movimiento en el historial.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

async function main() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'novawallet-'));
  process.env.DATABASE_PATH = path.join(dir, 'wallet.db');
  process.env.NOVASTORE_DISABLE_SYNC = '1';

  const { getDb, hashPassword, nowIso } = await import('../src/lib/db');
  const wallet = await import('../src/lib/wallet');

  const db = getDb();
  const admin = db
    .prepare("SELECT id FROM users WHERE role = 'admin' ORDER BY id LIMIT 1")
    .get() as { id: number } | undefined;
  assert.ok(admin && admin.id > 0, 'debe existir un administrador');
  const adminId = admin.id;

  const stamp = nowIso();
  const created = db
    .prepare(
      'INSERT INTO users (name, email, password_hash, role, balance_cents, is_active, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?)',
    )
    .run('Cliente Wallet', 'wallet@test.com', hashPassword('Prueba1234'), 'customer', 5000, 1, stamp, stamp);
  const userId = Number(created.lastInsertRowid);

  const storeBalance = () =>
    (db.prepare('SELECT balance_cents FROM users WHERE id = ?').get(userId) as { balance_cents: number })
      .balance_cents;

  // 1. La alcancía arranca vacía aunque la tienda tenga saldo.
  assert.equal(wallet.getWalletBalance(userId), 0, 'NovaWallet empieza en cero');
  assert.equal(storeBalance(), 5000, 'el saldo de la tienda no se toca');

  // 2. Configuración: número de Yape, aviso y comisión del 5 %.
  const saved = wallet.saveWalletConfig({
    yapeNumber: '999 111 222',
    yapeHolder: 'Michel A.',
    notice: 'Se cobra una comisión del 5 % en cada retiro.',
    feeEnabled: true,
    feePercent: '5',
    feeFixedCents: '0',
    minRechargeCents: '1000',
    minWithdrawCents: '1000',
  });
  assert.equal(saved.ok, true, 'la configuración se guarda');
  const config = wallet.getWalletConfig();
  assert.equal(config.yape_number, '999 111 222');
  assert.equal(config.fee_enabled, true);
  assert.equal(config.min_recharge_cents, 1000);
  const feeSmall = wallet.walletFeeCents(config, 1000);
  const feeBig = wallet.walletFeeCents(config, 4000);
  assert.ok(feeSmall > 0, 'la comisión configurada se calcula');
  assert.ok(feeBig > feeSmall, 'la comisión crece con el monto');

  // 3. Recarga: monto mínimo, comprobante obligatorio y saldo intacto.
  const tooSmall = wallet.createWalletRecharge({
    userId,
    amountCents: 500,
    reference: 'OP-1',
    note: '',
    proofUrl: '/api/media/1',
    proofName: 'comprobante.png',
  });
  assert.equal(tooSmall.ok, false, 'se rechaza un monto menor al mínimo');

  const noProof = wallet.createWalletRecharge({
    userId,
    amountCents: 2000,
    reference: 'OP-2',
    note: '',
    proofUrl: '',
    proofName: '',
  });
  assert.equal(noProof.ok, false, 'el comprobante es obligatorio');

  const recharge = wallet.createWalletRecharge({
    userId,
    amountCents: 2000,
    reference: 'OP-123',
    note: 'Yape de prueba',
    proofUrl: '/api/media/1',
    proofName: 'comprobante.png',
  });
  assert.equal(recharge.ok, true, 'la recarga se registra');
  assert.equal(wallet.getWalletBalance(userId), 0, 'la recarga pendiente no acredita saldo');
  const rechargeId = recharge.ok ? recharge.id : 0;

  const pendingRecharge = wallet.listWalletRequests({ kind: 'recarga', status: 'pendiente' });
  assert.equal(pendingRecharge.length, 1);
  assert.equal(pendingRecharge[0].status, 'pendiente');

  const duplicate = wallet.createWalletRecharge({
    userId,
    amountCents: 2000,
    reference: 'OP-123',
    note: '',
    proofUrl: '/api/media/1',
    proofName: 'comprobante.png',
  });
  assert.equal(duplicate.ok, false, 'no se duplica una recarga con el mismo número de operación');

  // 4. El administrador aprueba: recién ahí entra el dinero.
  const approved = wallet.reviewWalletRequest({
    id: rechargeId,
    action: 'aprobar',
    adminId,
    adminNote: 'Comprobante verificado',
  });
  assert.equal(approved.ok, true, 'el administrador aprueba la recarga');
  assert.equal(wallet.getWalletBalance(userId), 2000, 'el saldo se acredita al aprobar');
  assert.equal(storeBalance(), 5000, 'el saldo de la tienda sigue intacto');

  const again = wallet.reviewWalletRequest({
    id: rechargeId,
    action: 'aprobar',
    adminId,
    adminNote: '',
  });
  assert.equal(again.ok, false, 'una recarga ya revisada no se vuelve a aprobar');
  assert.equal(wallet.getWalletBalance(userId), 2000, 'no se acredita dos veces');

  // 5. Retiro: no descuenta hasta aprobar, respeta saldo y comisión.
  const overBalance = wallet.createWalletWithdrawal({
    userId,
    amountCents: 9000,
    method: 'Yape',
    note: '',
  });
  assert.equal(overBalance.ok, false, 'no se puede retirar más que el saldo');

  const withdrawal = wallet.createWalletWithdrawal({
    userId,
    amountCents: 1500,
    method: 'Yape',
    note: 'Mi Yape 999111222',
  });
  assert.equal(withdrawal.ok, true, 'el retiro se registra');
  const withdrawalId = withdrawal.ok ? withdrawal.id : 0;
  assert.equal(wallet.getWalletBalance(userId), 2000, 'el retiro pendiente no descuenta saldo');

  const storedWithdrawal = wallet
    .listWalletRequests({ kind: 'retiro' })
    .find((row) => row.id === withdrawalId);
  assert.ok(storedWithdrawal, 'el retiro queda en el historial');
  assert.equal(storedWithdrawal.net_cents, 1500 - storedWithdrawal.fee_cents);
  assert.ok(storedWithdrawal.fee_cents > 0, 'la comisión queda registrada en la solicitud');

  const rejected = wallet.reviewWalletRequest({
    id: withdrawalId,
    action: 'rechazar',
    adminId,
    adminNote: 'Datos de Yape incorrectos',
  });
  assert.equal(rejected.ok, true, 'el administrador rechaza el retiro');
  assert.equal(wallet.getWalletBalance(userId), 2000, 'un retiro rechazado no descuenta');

  const withdrawal2 = wallet.createWalletWithdrawal({
    userId,
    amountCents: 1500,
    method: 'Plin',
    note: 'Plin 999111222',
  });
  assert.equal(withdrawal2.ok, true, 'tras el rechazo puede pedir otro retiro');
  const withdrawal2Id = withdrawal2.ok ? withdrawal2.id : 0;
  assert.equal(
    wallet.reviewWalletRequest({ id: withdrawal2Id, action: 'aprobar', adminId, adminNote: '' }).ok,
    true,
  );
  assert.equal(wallet.getWalletBalance(userId), 500, 'el retiro aprobado descuenta el saldo');

  // 6. Una recarga rechazada no acredita nada.
  const recharge2 = wallet.createWalletRecharge({
    userId,
    amountCents: 3000,
    reference: 'OP-999',
    note: '',
    proofUrl: '/api/media/2',
    proofName: 'otro.png',
  });
  assert.equal(recharge2.ok, true);
  const recharge2Id = recharge2.ok ? recharge2.id : 0;
  assert.equal(
    wallet.reviewWalletRequest({ id: recharge2Id, action: 'rechazar', adminId, adminNote: '' }).ok,
    true,
  );
  assert.equal(wallet.getWalletBalance(userId), 500, 'una recarga rechazada no acredita saldo');

  // 7. Historial de movimientos: solo las operaciones aprobadas.
  const movements = wallet.listWalletMovements(userId);
  assert.equal(movements.length, 2, 'solo las operaciones aprobadas dejan movimiento');
  assert.equal(
    movements.reduce((sum, row) => sum + row.amount_cents, 0),
    500,
    'los movimientos suman el saldo actual',
  );
  assert.equal(movements.some((row) => row.kind === 'ingreso' && row.amount_cents === 2000), true);
  assert.equal(movements.some((row) => row.kind === 'retiro' && row.amount_cents === -1500), true);

  const totals = wallet.getWalletTotals();
  assert.equal(totals.accounts, 1);
  assert.equal(totals.balance_cents, 500);
  assert.equal(wallet.countPendingWalletRequests(), 0, 'no quedan solicitudes pendientes');

  // 8. El dinero de NovaWallet nunca tocó el saldo de la tienda.
  assert.equal(storeBalance(), 5000, 'el saldo de NOVASTORE permanece igual');

  console.log('NovaWallet OK: saldo independiente, aprobación obligatoria, comisiones e historial.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
