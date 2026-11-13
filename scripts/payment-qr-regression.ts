/**
 * Regresión del QR de pago configurable por el administrador.
 * Usa una base temporal para no tocar los datos reales de la tienda.
 */
import assert from 'node:assert';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'novastore-qr-'));
process.env.DATABASE_PATH = path.join(tmpDir, 'regression.db');

async function main() {
  const { getDb } = await import('../src/lib/db');
  const { getSetting, getSettings } = await import('../src/lib/catalog');
  const rechargeModule = await import('../src/lib/recharge');
  const {
    PAYMENT_QR_KEY,
    clearPaymentQrUrl,
    getPaymentQrUrl,
    hasPaymentQr,
    isAllowedPaymentQrUrl,
    savePaymentQrUrl,
  } = await import('../src/lib/payment-qr');

  const db = getDb();
  const settingsBefore = getSettings();
  const paymentMethodsBefore = db
    .prepare('SELECT code, name, account_info, is_enabled FROM payment_methods ORDER BY code')
    .all();

  // 1. Sin configurar no hay QR de ejemplo ni un valor inventado.
  assert.equal(getPaymentQrUrl(), '', 'no debe existir un QR por defecto');
  assert.equal(hasPaymentQr(), false);

  // 2. Rechaza cualquier valor que no sea una imagen de la tienda o de Supabase Storage.
  const invalids = [
    '',
    '   ',
    'javascript:alert(1)',
    'http://ejemplo.com/qr.png',
    '/images/products/canva-pro.svg',
    'https://ejemplo.com/qr.png',
    'https://abcd.supabase.co/storage/v1/object/public/novastore-media/pagos/qr.svg',
    '/api/media/../../etc/passwd',
  ];
  for (const value of invalids) {
    const result = savePaymentQrUrl(value);
    assert.equal(result.ok, false, `debió rechazar «${value}»`);
    assert.equal(getPaymentQrUrl(), '', 'un valor inválido no debe quedar guardado');
  }

  // 3. Acepta la imagen servida por la propia tienda (modo database).
  const mediaId = crypto.randomUUID();
  assert.equal(savePaymentQrUrl(`/api/media/${mediaId}`).ok, true);
  assert.equal(getPaymentQrUrl(), `/api/media/${mediaId}`);
  assert.equal(getSetting(PAYMENT_QR_KEY), `/api/media/${mediaId}`);
  assert.equal(hasPaymentQr(), true);

  // 4. Acepta la URL pública de Supabase Storage (modo bucket) y reemplaza sin duplicar.
  const storageUrl =
    'https://abcd.supabase.co/storage/v1/object/public/novastore-media/pagos/2026-11/qr.png';
  assert.equal(isAllowedPaymentQrUrl(storageUrl), true);
  assert.equal(savePaymentQrUrl(storageUrl).ok, true);
  assert.equal(getPaymentQrUrl(), storageUrl);
  const rows = db
    .prepare('SELECT COUNT(*) AS total FROM settings WHERE key = ?')
    .get(PAYMENT_QR_KEY) as { total: number };
  assert.equal(rows.total, 1, 'el QR debe ocupar una sola clave de configuración');

  // 5. Persiste al reabrir la base: no queda solo en memoria del proceso.
  const Database = (await import('better-sqlite3')).default;
  const reopened = new Database(process.env.DATABASE_PATH as string, { readonly: true });
  const persisted = reopened
    .prepare('SELECT value FROM settings WHERE key = ?')
    .get(PAYMENT_QR_KEY) as { value: string };
  reopened.close();
  assert.equal(persisted.value, storageUrl);

  // 6. Eliminar vuelve a «no disponible» sin tocar otras configuraciones ni métodos de pago.
  clearPaymentQrUrl();
  assert.equal(getPaymentQrUrl(), '');
  assert.equal(hasPaymentQr(), false);
  const settingsAfter = getSettings();
  for (const [key, value] of Object.entries(settingsBefore)) {
    assert.equal(settingsAfter[key], value, `la configuración ${key} no debe cambiar`);
  }
  const paymentMethodsAfter = db
    .prepare('SELECT code, name, account_info, is_enabled FROM payment_methods ORDER BY code')
    .all();
  assert.deepEqual(paymentMethodsAfter, paymentMethodsBefore, 'los métodos de pago no cambian');

  // 7. El mínimo de recarga sigue en S/10 y no hay monto máximo.
  assert.equal(rechargeModule.RECHARGE_MIN_CENTS, 1000);
  assert.ok(!('RECHARGE_MAX_CENTS' in rechargeModule), 'no debe existir un monto máximo');

  console.log('QR de pago: 7 bloques de comprobaciones correctos.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
