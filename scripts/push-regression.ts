/**
 * Regresión de las notificaciones push del administrador.
 * Usa una base temporal y un remitente falso: no envía notificaciones reales.
 */
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'novastore-push-'));
process.env.DATABASE_PATH = path.join(tmpDir, 'regression.db');
process.env.NOVASTORE_DISABLE_SYNC = '1';

async function main() {
  const { getSetting, getSettings } = await import('../src/lib/catalog');
  const { formatPEN } = await import('../src/lib/format');
  const push = await import('../src/lib/push');

  // 1. Claves VAPID estables y persistidas en settings
  const keys = push.getVapidKeys();
  assert.match(keys.publicKey, /^B[A-Za-z0-9_-]{80,}$/, 'clave pública VAPID válida');
  assert.ok(keys.privateKey.length >= 40, 'clave privada VAPID presente');
  assert.equal(push.getVapidKeys().publicKey, keys.publicKey, 'las claves se reutilizan');
  assert.ok(getSetting('push:vapid_private').length > 0, 'clave privada guardada');
  console.log('✔ claves VAPID generadas una vez y persistentes');

  // 2. Un endpoint = un dispositivo (sin duplicados)
  const endpoint = 'https://push.example.com/device-a';
  const first = push.saveSubscription({
    endpoint,
    keys: { p256dh: 'p'.repeat(80), auth: 'a'.repeat(22) },
    device: 'Android · Chrome',
  });
  assert.equal(first.ok, true);
  assert.equal(first.deviceCount, 1);
  const second = push.saveSubscription({
    endpoint,
    keys: { p256dh: 'q'.repeat(80), auth: 'b'.repeat(22) },
    device: 'Android · Chrome',
  });
  assert.equal(second.ok, true);
  assert.equal(second.deviceCount, 1, 'no duplica el mismo dispositivo');
  console.log('✔ dispositivo guardado sin duplicados');

  // 3. Estado del panel sin exponer la clave privada
  const state = push.getPushState();
  assert.equal(state.deviceCount, 1);
  assert.equal(state.devices[0].device, 'Android · Chrome');
  assert.equal(
    JSON.stringify(state).includes(keys.privateKey),
    false,
    'el estado no expone la clave privada',
  );
  console.log('✔ estado del panel sin secretos');

  // 4. Payloads con importes y deep link
  const order = push.buildOrderNotification({
    orderId: 7,
    orderNumber: 'NV-260101-ABC123',
    totalCents: 2500,
    methodName: 'Yape',
  });
  assert.equal(order.key, 'pedido:7');
  assert.equal(order.title, '🛒 NUEVO PEDIDO');
  assert.ok(order.body.includes('NV-260101-ABC123'));
  assert.ok(order.body.includes(formatPEN(2500)));
  assert.ok(order.body.includes('Yape'));
  assert.equal(order.url, '/admin/pedidos?q=NV-260101-ABC123');

  const recharge = push.buildRechargeNotification({
    id: 3,
    amountCents: 2000,
    methodName: 'Plin',
  });
  assert.equal(recharge.key, 'recarga:3');
  assert.equal(recharge.title, '💰 NUEVA RECARGA');
  assert.ok(recharge.body.includes(formatPEN(2000)));
  assert.ok(recharge.body.includes('Pendiente de aprobación'));
  assert.equal(recharge.url, '/admin/recargas?estado=pendiente');

  const proof = push.buildProofNotification({
    orderId: 7,
    orderNumber: 'NV-260101-ABC123',
    totalCents: 2500,
  });
  assert.equal(proof.key, 'comprobante:7');
  assert.equal(proof.title, '💳 NUEVO COMPROBANTE');
  assert.ok(proof.body.includes('Requiere revisión'));
  assert.equal(proof.url, '/admin/comprobantes');
  console.log('✔ payloads con importe, estado y deep link');

  // 5. Envío real al remitente y deduplicación por evento
  const calls: string[] = [];
  const sender = async (_record: unknown, payload: string) => {
    calls.push(payload);
    return { statusCode: 201 };
  };

  const sent = await push.sendAdminPush(order, { sender });
  assert.equal(sent.sent, 1);
  assert.equal(sent.failed, 0);
  assert.equal(calls.length, 1);
  const delivered = JSON.parse(calls[0]) as { title: string; url: string; kind: string };
  assert.equal(delivered.title, '🛒 NUEVO PEDIDO');
  assert.equal(delivered.url, '/admin/pedidos?q=NV-260101-ABC123');
  assert.equal(delivered.kind, 'pedido');

  const duplicated = await push.sendAdminPush(order, { sender });
  assert.equal(duplicated.reason, 'duplicado');
  assert.equal(calls.length, 1, 'no reenvía el mismo pedido');
  console.log('✔ envío único por evento (sin duplicados)');

  // 6. Interruptor de avisos
  push.setPushEnabled(false);
  const disabled = await push.sendAdminPush(recharge, { sender });
  assert.equal(disabled.reason, 'deshabilitado');
  assert.equal(calls.length, 1);
  push.setPushEnabled(true);
  console.log('✔ interruptor de notificaciones respetado');

  // 7. Sin dispositivos no se pierde el aviso; al autorizar uno, se entrega
  push.removeSubscription(endpoint);
  assert.equal(push.listSubscriptions().length, 0);
  const withoutDevice = await push.sendAdminPush(proof, { sender });
  assert.equal(withoutDevice.reason, 'sin-dispositivos');
  push.saveSubscription({
    endpoint,
    keys: { p256dh: 'r'.repeat(80), auth: 'c'.repeat(22) },
    device: 'iPhone/iPad · Safari',
  });
  const afterSubscribe = await push.sendAdminPush(proof, { sender });
  assert.equal(afterSubscribe.sent, 1, 'se entrega cuando hay dispositivo autorizado');
  console.log('✔ aviso pendiente entregado tras autorizar el teléfono');

  // 8. Suscripciones caducadas se eliminan sin afectar a las demás
  const gone = 'https://push.example.com/gone';
  push.saveSubscription({
    endpoint: gone,
    keys: { p256dh: 'g'.repeat(40), auth: 'd'.repeat(20) },
    device: 'Equipo antiguo',
  });
  const failing = async () => {
    const error = Object.assign(new Error('gone'), { statusCode: 410 });
    throw error;
  };
  const pruned = await push.sendAdminPush(
    {
      key: 'prueba:410',
      kind: 'prueba',
      title: 'Prueba',
      body: 'Prueba',
      url: '/admin/notificaciones',
    },
    { sender: failing },
  );
  assert.equal(pruned.sent, 0);
  assert.equal(pruned.failed, 2);
  assert.equal(
    push.listSubscriptions().some((item) => item.endpoint === gone),
    false,
    'elimina la suscripción caducada',
  );
  console.log('✔ suscripciones caducadas depuradas');

  // 9. Límite de dispositivos y validación de suscripciones
  for (let i = 0; i < 15; i += 1) {
    push.saveSubscription({
      endpoint: `https://push.example.com/extra-${i}`,
      keys: { p256dh: 'x'.repeat(40), auth: 'y'.repeat(20) },
      device: `Equipo ${i}`,
    });
  }
  assert.equal(push.listSubscriptions().length, push.MAX_PUSH_SUBSCRIPTIONS);
  const invalidEndpoint = push.saveSubscription({
    endpoint: 'ftp://push.example.com/nope',
    keys: { p256dh: 'a', auth: 'b' },
  });
  assert.equal(invalidEndpoint.ok, false);
  const invalidKeys = push.saveSubscription({ endpoint: 'https://push.example.com/x', keys: { p256dh: '', auth: '' } });
  assert.equal(invalidKeys.ok, false);
  console.log('✔ límite de dispositivos y validación de suscripciones');

  // 10. Las claves push no se cargan en el escaparate
  const storefront = getSettings();
  assert.equal(
    Object.keys(storefront).some((key) => key.startsWith('push:')),
    false,
    'el escaparate no recibe las claves push',
  );
  console.log('✔ claves push aisladas del escaparate');

  // 11. Etiqueta de dispositivo legible
  assert.equal(
    push.describeDevice('Mozilla/5.0 (Linux; Android 14) Chrome/120 Mobile Safari/537.36'),
    'Android · Chrome',
  );
  assert.equal(
    push.describeDevice('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) Version/17.0 Mobile Safari/604.1'),
    'iPhone/iPad · Safari',
  );
  console.log('✔ etiquetas de dispositivo');

  fs.rmSync(tmpDir, { recursive: true, force: true });
  console.log('\nRegresión de notificaciones push completada.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
