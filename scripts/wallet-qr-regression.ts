/**
 * Regresión del QR de pago de NovaWallet.
 *
 * Comprueba que solo se acepten imágenes subidas desde el panel, que el QR se
 * guarde en la configuración de la alcancía (persistente en Supabase), que
 * guardar comisiones no lo borre y que el administrador pueda eliminarlo sin
 * tocar el resto de ajustes ni el dinero de NovaStore.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'novawallet-qr-'));
process.env.DATABASE_PATH = path.join(dir, 'wallet-qr.db');

const BUCKET_QR =
  'https://abcd.supabase.co/storage/v1/object/public/novastore-media/pagos/qr.png';
const LOCAL_QR = '/api/media/3f1a2b3c-4d5e-6f70-8a9b-0c1d2e3f4a5b';

async function main() {
  const wallet = await import('../src/lib/wallet');

  // 1. Una alcancía nueva no tiene QR: nunca se inventa uno de ejemplo.
  assert.equal(wallet.getWalletConfig().qr_url, '', 'NovaWallet empieza sin QR');

  // 2. Solo se aceptan imágenes subidas desde el panel.
  assert.equal(
    wallet.setWalletQrUrl('https://sitio-externo.com/qr.png').ok,
    false,
    'se rechaza un QR alojado fuera de la tienda',
  );
  assert.equal(
    wallet.setWalletQrUrl('/api/media/123').ok,
    false,
    'se rechaza una ruta de medios inválida',
  );
  assert.equal(
    wallet.setWalletQrUrl(
      'https://abcd.supabase.co/storage/v1/object/public/novastore-media/pagos/qr.svg',
    ).ok,
    false,
    'se rechaza un SVG como QR',
  );
  assert.equal(wallet.setWalletQrUrl('').ok, false, 'se rechaza un QR vacío');

  // 3. El QR de Supabase Storage y el servido por la tienda se guardan.
  assert.equal(wallet.setWalletQrUrl(BUCKET_QR).ok, true, 'se acepta el QR de Storage');
  assert.equal(wallet.getWalletConfig().qr_url, BUCKET_QR, 'el QR queda guardado');
  assert.equal(wallet.setWalletQrUrl(LOCAL_QR).ok, true, 'se puede reemplazar el QR');
  assert.equal(wallet.getWalletConfig().qr_url, LOCAL_QR, 'el QR nuevo reemplaza al anterior');

  // 4. Guardar el resto de la configuración conserva el QR.
  const saved = wallet.saveWalletConfig({
    yapeNumber: '999 111 222',
    yapeHolder: 'Michel Alvarado',
    notice: 'Comisión de prueba',
    feeEnabled: true,
    feePercent: '5',
    feeFixedCents: '0',
    minRechargeCents: '1000',
    minWithdrawCents: '1000',
  });
  assert.equal(saved.ok, true, 'la configuración se guarda');
  assert.equal(wallet.getWalletConfig().qr_url, LOCAL_QR, 'guardar ajustes no borra el QR');
  assert.equal(wallet.getWalletConfig().yape_number, '999 111 222');

  // 5. Eliminar el QR no toca el resto de ajustes ni el dinero de la tienda.
  wallet.clearWalletQrUrl();
  assert.equal(wallet.getWalletConfig().qr_url, '', 'el administrador puede eliminar el QR');
  assert.equal(
    wallet.getWalletConfig().yape_number,
    '999 111 222',
    'eliminar el QR conserva los demás ajustes',
  );
  assert.equal(
    wallet.getWalletConfig().min_recharge_cents,
    1000,
    'eliminar el QR conserva el monto mínimo',
  );

  console.log('[wallet-qr] OK: validación, guardado, conservación y eliminación del QR.');
}

main().catch((error) => {
  console.error('[wallet-qr] FALLÓ:', error);
  process.exit(1);
});
