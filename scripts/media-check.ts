/**
 * Comprobación funcional de la capa de imágenes de NOVASTORE.
 *
 * Uso: DATABASE_PATH=... npx tsx scripts/media-check.ts
 *
 * Verifica validación de formatos, rechazo de archivos no permitidos, subida
 * real a Supabase (bucket o base de datos) y lectura posterior de la imagen
 * guardada, además de comprobar que cada subida genera una URL distinta.
 */
import {
  mediaStorageMode,
  readStoredImage,
  saveImage,
  validateImage,
  MAX_IMAGE_BYTES,
} from '../src/lib/media';

const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==',
  'base64',
);

const JPEG = Buffer.concat([
  Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
  Buffer.alloc(64, 0x20),
  Buffer.from([0xff, 0xd9]),
]);

const WEBP = Buffer.concat([
  Buffer.from('RIFF', 'ascii'),
  Buffer.from([0x20, 0x00, 0x00, 0x00]),
  Buffer.from('WEBP', 'ascii'),
  Buffer.alloc(32, 0x00),
]);

let failures = 0;

function check(name: string, condition: boolean, detail = '') {
  if (condition) {
    console.log(`  ok  ${name}${detail ? ` — ${detail}` : ''}`);
  } else {
    failures += 1;
    console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

async function main() {
  console.log(`Modo de almacenamiento: ${mediaStorageMode()}`);

  console.log('Validación de archivos');
  const png = validateImage(PNG_1X1, 'image/png');
  check('acepta PNG real', png.ok && png.kind === 'png');

  const jpeg = validateImage(JPEG, 'image/jpeg');
  check('acepta JPG real', jpeg.ok && jpeg.kind === 'jpeg');

  const webp = validateImage(WEBP, 'image/webp');
  check('acepta WEBP real', webp.ok && webp.kind === 'webp');

  const texto = validateImage(Buffer.from('no soy una imagen'), 'image/png');
  check(
    'rechaza archivo que no es imagen',
    !texto.ok && /JPG, PNG o WEBP/.test(texto.error),
    texto.ok ? 'no rechazó' : texto.error,
  );

  const pdf = validateImage(PNG_1X1, 'application/pdf');
  check('rechaza tipo declarado no permitido', !pdf.ok);

  const grande = validateImage(Buffer.concat([PNG_1X1, Buffer.alloc(MAX_IMAGE_BYTES)]), 'image/png');
  check('rechaza imágenes de más de 6 MB', !grande.ok && /6 MB/.test(grande.error));

  const vacio = validateImage(Buffer.alloc(0), 'image/png');
  check('rechaza archivo vacío', !vacio.ok);

  if (!png.ok) {
    console.log(`\n${failures} comprobaciones fallidas`);
    process.exit(1);
  }

  console.log('Subida a Supabase');
  const first = await saveImage(PNG_1X1, 'png', 'productos');
  check('devuelve una URL guardable', /^(https?:\/\/|\/api\/media\/)/.test(first.url), first.url);
  check('informa el tamaño guardado', first.bytes === PNG_1X1.length);

  const second = await saveImage(PNG_1X1, 'png', 'categorias');
  check('cada imagen obtiene una URL única', first.url !== second.url);

  if (first.storage === 'database') {
    const id = first.url.split('/').pop() ?? '';
    const stored = await readStoredImage(id);
    check('la imagen se recupera desde Supabase', Boolean(stored));
    check('el contenido recuperado coincide', Boolean(stored && stored.data.equals(PNG_1X1)));
    check('el tipo MIME se conserva', stored?.mime === 'image/png');
    const missing = await readStoredImage('00000000-0000-4000-8000-000000000000');
    check('devuelve vacío para una imagen inexistente', missing === null);
    check('rechaza identificadores inválidos', (await readStoredImage('../etc/passwd')) === null);
  } else {
    const response = await fetch(first.url);
    check('la URL pública del bucket responde', response.ok, String(response.status));
    const bytes = Buffer.from(await response.arrayBuffer());
    check('el archivo del bucket coincide', bytes.equals(PNG_1X1));
  }

  console.log(`\nURL de prueba: ${first.url}`);
  console.log(failures === 0 ? 'RESULTADO: todas las comprobaciones pasaron' : `RESULTADO: ${failures} fallidas`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error('Error inesperado:', error instanceof Error ? error.message : error);
  process.exit(1);
});
