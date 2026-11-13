/**
 * Comprobación puntual del endpoint real de subida (/api/admin/upload).
 *
 * Levanta el build de producción sobre una copia temporal de la base, crea una
 * sesión de administrador desechable y comprueba: rechazo sin sesión, subida
 * multipart real, rechazo de archivos que no son imágenes y servido posterior
 * de la imagen guardada. Usa Supabase real para el almacenamiento.
 */
import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import net from 'node:net';
import Database from 'better-sqlite3';

const PORT = 3100;
const DB = '/tmp/nb-route.db';
const BASE = `http://127.0.0.1:${PORT}`;
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==',
  'base64',
);

fs.copyFileSync('data/novastore.db', DB);
const token = crypto.randomBytes(24).toString('hex');
const hash = crypto.createHash('sha256').update(token).digest('hex');
const now = new Date();
const seed = new Database(DB);
seed
  .prepare(
    'INSERT OR REPLACE INTO sessions (token_hash, user_id, user_agent, created_at, expires_at) VALUES (?, ?, ?, ?, ?)',
  )
  .run(hash, 1, 'prueba-galeria', now.toISOString(), new Date(now.getTime() + 7_200_000).toISOString());
seed.close();

const server = spawn('npx', ['next', 'start', '-p', String(PORT)], {
  env: { ...process.env, DATABASE_PATH: DB },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let log = '';
server.stdout.on('data', (chunk) => (log += chunk));
server.stderr.on('data', (chunk) => (log += chunk));

function waitForPort() {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const attempt = () => {
      const socket = net.connect(PORT, '127.0.0.1');
      socket.once('connect', () => {
        socket.destroy();
        resolve();
      });
      socket.once('error', () => {
        socket.destroy();
        if (Date.now() - start > 60_000) reject(new Error('El servidor no arrancó'));
        else setTimeout(attempt, 400);
      });
    };
    attempt();
  });
}

const results = [];
const check = (name, ok, extra = '') => {
  results.push({ name, ok });
  console.log(`  ${ok ? 'ok  ' : 'FALLA'} ${name}${extra ? ` — ${extra}` : ''}`);
};

function form(folder, bytes, type, filename) {
  const body = new FormData();
  body.append('file', new Blob([bytes], { type }), filename);
  if (folder) body.append('folder', folder);
  return body;
}

try {
  await waitForPort();

  const noSession = await fetch(`${BASE}/api/admin/upload`, {
    method: 'POST',
    body: form('productos', PNG, 'image/png', 'galeria.png'),
  });
  const noSessionJson = await noSession.json().catch(() => ({}));
  check(
    'rechaza la subida sin sesión de administrador',
    noSession.status === 401,
    `http=${noSession.status} ${noSessionJson.error ?? ''}`,
  );

  const cookie = { cookie: `nova_session=${token}` };
  const upload = await fetch(`${BASE}/api/admin/upload`, {
    method: 'POST',
    headers: cookie,
    body: form('categorias', PNG, 'image/png', 'galeria.png'),
  });
  const uploadJson = await upload.json().catch(() => ({}));
  check(
    'sube la imagen con sesión de administrador',
    upload.ok && uploadJson.ok === true && typeof uploadJson.url === 'string',
    `http=${upload.status} url=${uploadJson.url ?? ''} almacenamiento=${uploadJson.storage ?? ''}`,
  );

  const notImage = await fetch(`${BASE}/api/admin/upload`, {
    method: 'POST',
    headers: cookie,
    body: form('productos', Buffer.from('hola'), 'image/png', 'texto.png'),
  });
  const notImageJson = await notImage.json().catch(() => ({}));
  check(
    'rechaza un archivo que no es imagen con mensaje de error',
    !notImage.ok && typeof notImageJson.error === 'string',
    `http=${notImage.status} ${notImageJson.error ?? ''}`,
  );

  for (const [section, page] of [
    ['Productos', '/admin/productos/nuevo'],
    ['Categorías', '/admin/categorias'],
  ]) {
    const response = await fetch(`${BASE}${page}`, { headers: cookie, redirect: 'manual' });
    const html = await response.text();
    check(
      `muestra el selector de galería en ${section}`,
      response.status === 200 && html.includes('Seleccionar imagen de galería'),
      `http=${response.status}`,
    );
  }

  if (uploadJson.url) {
    const served = await fetch(`${BASE}${uploadJson.url}`);
    const bytes = Buffer.from(await served.arrayBuffer());
    check(
      'sirve la imagen guardada con los mismos bytes',
      served.ok && bytes.equals(PNG),
      `http=${served.status} tipo=${served.headers.get('content-type')} bytes=${bytes.length}`,
    );
    fs.writeFileSync('/tmp/nb-media-url.txt', uploadJson.url);
  }
} catch (error) {
  check('ejecución de la prueba', false, error instanceof Error ? error.message : String(error));
  if (log) console.log(log.slice(-800));
} finally {
  server.kill('SIGTERM');
}

const failed = results.filter((item) => !item.ok).length;
console.log(
  failed === 0 ? '\nRESULTADO: todas las comprobaciones pasaron' : `\nRESULTADO: ${failed} fallo(s)`,
);
process.exit(failed === 0 ? 0 : 1);
