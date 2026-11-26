/**
 * Siembra datos de demostración en una COPIA de la base (por ejemplo
 * /tmp/preview.db) para verificar la interfaz de NovaWallet sin tocar la tienda
 * real: un cliente de prueba, un administrador de prueba y una recarga pendiente.
 */
async function main() {
  const { getDb, hashPassword, nowIso } = await import('../src/lib/db');
  const wallet = await import('../src/lib/wallet');

  const db = getDb();
  const stamp = nowIso();

  const ensureUser = (name: string, email: string, role: 'customer' | 'admin') => {
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email) as
      | { id: number }
      | undefined;
    if (existing) return existing.id;
    const info = db
      .prepare(
        'INSERT INTO users (name, email, password_hash, role, balance_cents, is_active, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?)',
      )
      .run(name, email, hashPassword('Prueba1234'), role, 0, 1, stamp, stamp);
    return Number(info.lastInsertRowid);
  };

  const clientId = ensureUser('Cliente Wallet Demo', 'wallet.demo@novastore.test', 'customer');
  const adminId = ensureUser('Admin Demo', 'wallet.admin@novastore.test', 'admin');

  wallet.saveWalletConfig({
    yapeNumber: '999 111 222',
    yapeHolder: 'Michel Alvarado',
    notice: 'Se cobra una comisión del 5 % sobre cada retiro aprobado.',
    feeEnabled: true,
    feePercent: '5',
    feeFixedCents: '0',
    minRechargeCents: '1000',
    minWithdrawCents: '1000',
  });

  const pending = wallet
    .listWalletRequests({ kind: 'recarga', status: 'pendiente' })
    .filter((row) => row.user_id === clientId);

  let requestId = pending[0]?.id ?? 0;
  if (!requestId) {
    const created = wallet.createWalletRecharge({
      userId: clientId,
      amountCents: 2000,
      reference: 'OP-DEMO-1',
      note: 'Recarga de prueba para revisar en el panel',
      proofUrl: '/api/media/1',
      proofName: 'comprobante-demo.png',
    });
    requestId = created.ok ? created.id : 0;
  }

  console.log(
    JSON.stringify({
      clientId,
      adminId,
      requestId,
      balance: wallet.getWalletBalance(clientId),
      totalRequests: wallet.listWalletRequests().length,
    }),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
