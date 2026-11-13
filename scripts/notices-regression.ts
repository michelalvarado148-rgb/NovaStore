/**
 * Regresión de «Avisos y requisitos del producto».
 *
 * Comprueba que la configuración por producto se guarda de forma independiente,
 * que solo se muestran los avisos activos, que los datos del cliente quedan
 * guardados con el pedido y que la configuración no se filtra al escaparate.
 */
import fs from 'node:fs';

const dbPath = '/tmp/novastore-notices-check.db';
for (const suffix of ['', '-wal', '-shm']) {
  try {
    fs.rmSync(`${dbPath}${suffix}`);
  } catch {
    /* archivo inexistente */
  }
}
process.env.DATABASE_PATH = dbPath;
process.env.NOVASTORE_DISABLE_SYNC = '1';

let failures = 0;
function check(name: string, condition: boolean, detail = '') {
  if (condition) {
    console.log(`  ✓ ${name}`);
  } else {
    failures += 1;
    console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

async function main() {
  const {
    saveProductNotice,
    getProductNoticeConfig,
    getActiveNotices,
    getNoticeConfigMap,
    deleteProductNotice,
    saveOrderNoticeAnswers,
    getOrderNoticeAnswers,
  } = await import('../src/lib/product-notice');
  const { getSettings } = await import('../src/lib/catalog');

  console.log('Avisos por producto');

  // 1. Aviso desactivado: se guarda pero no se muestra en la tienda.
  const disabled = saveProductNotice(101, {
    enabled: false,
    type: 'inmediata',
    message: 'Llega al instante.',
    deliveryTime: '',
    fields: [],
  });
  check('guarda un aviso desactivado', disabled.ok);
  check('el aviso desactivado no aparece en la tienda', !getActiveNotices([101]).has(101));
  check('la configuración sigue disponible en el panel', getProductNoticeConfig(101)?.enabled === false);

  // 2. Aviso con datos obligatorios y opcionales.
  const withFields = saveProductNotice(101, {
    enabled: true,
    type: 'datos',
    message: '🔥 Ingresa tu ID de Free Fire antes de continuar.',
    deliveryTime: '5 a 15 minutos',
    fields: [
      { label: 'ID de Free Fire', required: true },
      { label: 'Servidor', required: false },
      { label: '   ', required: true },
      { label: 'id de free fire', required: true },
    ],
  });
  check('guarda un aviso con datos', withFields.ok);

  const active = getActiveNotices([101]).get(101);
  check('el aviso activo aparece en la tienda', Boolean(active));
  check('conserva el tipo y el tiempo de entrega', active?.type === 'datos' && active?.deliveryTime === '5 a 15 minutos');
  check('solo guarda datos con nombre (sin vacíos ni duplicados)', active?.fields.length === 2);
  check(
    'respeta obligatorio/opcional',
    active?.fields[0].required === true && active?.fields[1].required === false,
  );

  // 3. Mensaje vacío: se usa el mensaje sugerido del tipo elegido.
  saveProductNotice(102, {
    enabled: true,
    type: 'demora',
    message: '   ',
    deliveryTime: '15 a 30 minutos',
    fields: [],
  });
  const delay = getActiveNotices([102]).get(102);
  check('genera el mensaje sugerido cuando se deja vacío', Boolean(delay?.message.trim()));
  check('cada producto tiene su propia configuración', delay?.type === 'demora' && active?.type === 'datos');
  check('el tiempo por defecto se aplica en avisos con demora', delay?.deliveryTime === '15 a 30 minutos');

  // 4. Independencia: dos productos, dos configuraciones distintas.
  saveProductNotice(103, {
    enabled: true,
    type: 'personalizado',
    message: 'Solo para mayores de edad.',
    deliveryTime: '',
    fields: [],
  });
  const map = getNoticeConfigMap();
  check('el panel ve los avisos activos de varios productos', map.get(102)?.enabled === true && map.get(103)?.enabled === true);
  check(
    'editar un aviso no afecta a los demás',
    map.get(103)?.message === 'Solo para mayores de edad.' && map.get(102)?.type === 'demora',
  );

  // 5. Producto inválido rechazado.
  const invalid = saveProductNotice(0, {
    enabled: true,
    type: 'inmediata',
    message: '',
    deliveryTime: '',
    fields: [],
  });
  check('rechaza un producto inválido', invalid.ok === false);

  // 6. Datos del cliente guardados con el pedido.
  saveOrderNoticeAnswers('NV-9001', [
    {
      productId: 101,
      productName: 'Diamantes Free Fire 100',
      type: 'datos',
      message: '🔥 Ingresa tu ID de Free Fire antes de continuar.',
      deliveryTime: '5 a 15 minutos',
      values: [
        { label: 'ID de Free Fire', value: '123456789', required: true },
        { label: 'Servidor', value: '', required: false },
      ],
      acknowledgedAt: '2026-11-13T20:00:00.000Z',
    },
  ]);
  const answers = getOrderNoticeAnswers('NV-9001');
  check('guarda los datos ingresados con el pedido', answers.length === 1);
  check('conserva el ID ingresado por el cliente', answers[0]?.values[0]?.value === '123456789');
  check('conserva el aviso mostrado al cliente', answers[0]?.message.includes('ID de Free Fire'));
  check('un pedido sin avisos devuelve una lista vacía', getOrderNoticeAnswers('NV-0000').length === 0);

  // 7. La configuración no se filtra al escaparate.
  const settings = getSettings();
  const leaked = Object.keys(settings).filter(
    (key) => key.startsWith('product_notice:') || key.startsWith('order_inputs:'),
  );
  check('getSettings no expone la configuración de avisos', leaked.length === 0, leaked.join(', '));

  // 8. Borrado del aviso sin tocar el producto.
  deleteProductNotice(103);
  check('elimina solo el aviso del producto indicado', !getProductNoticeConfig(103) && Boolean(getProductNoticeConfig(101)));

  if (failures > 0) {
    console.error(`\n${failures} comprobación(es) fallaron.`);
    process.exit(1);
  }
  console.log('\nTodas las comprobaciones de avisos por producto pasaron.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
