#!/usr/bin/env node
/**
 * NOVASTORE - prueba de humo HTTP.
 *
 * Arranca el build de producción con una base de datos temporal y verifica
 * páginas públicas y protecciones de rutas privadas.
 *
 * Uso:
 *   npm run build && npm run smoke
 *   BASE_URL=https://mi-dominio npm run smoke   (prueba un servidor ya activo)
 */
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const PORT = Number(process.env.SMOKE_PORT || 3100);
const EXTERNAL_URL = process.env.BASE_URL?.replace(/\/$/, '') || null;
const BASE = EXTERNAL_URL || `http://127.0.0.1:${PORT}`;

let child = null;
let tempDir = null;
const results = [];

function record(name, passed, detail = '') {
  results.push({ name, passed, detail });
  console.log(`${passed ? 'OK  ' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
}

async function get(path, { redirect = 'manual' } = {}) {
  const res = await fetch(`${BASE}${path}`, { redirect, headers: { 'user-agent': 'novastore-smoke' } });
  const body = redirect === 'manual' && res.status >= 300 && res.status < 400 ? '' : await res.text();
  return { status: res.status, location: res.headers.get('location') || '', body };
}

async function waitForServer(timeoutMs = 60000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const res = await fetch(`${BASE}/`, { redirect: 'manual' });
      if (res.status < 500) return true;
    } catch {
      /* servidor aún no disponible */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

function startServer() {
  tempDir = mkdtempSync(join(tmpdir(), 'novastore-smoke-'));
  const dbPath = join(tempDir, 'smoke.db');
  child = spawn(
    process.execPath,
    ['node_modules/next/dist/bin/next', 'start', '-H', '127.0.0.1', '-p', String(PORT)],
    {
      cwd: process.cwd(),
      env: { ...process.env, DATABASE_PATH: dbPath, NODE_ENV: 'production', NEXT_TELEMETRY_DISABLED: '1' },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );
  let log = '';
  child.stdout.on('data', (d) => {
    log += d.toString();
  });
  child.stderr.on('data', (d) => {
    log += d.toString();
  });
  child.on('exit', (code) => {
    if (code && code !== 0) console.error(`El servidor terminó con código ${code}\n${log}`);
  });
}

function stopServer() {
  if (child && !child.killed) child.kill('SIGTERM');
  if (tempDir) {
    try {
      rmSync(tempDir, { recursive: true, force: true });
    } catch {
      /* limpieza opcional */
    }
  }
}

async function main() {
  if (!EXTERNAL_URL) startServer();
  const ready = await waitForServer();
  if (!ready) {
    record('servidor disponible', false, `sin respuesta en ${BASE}`);
    return finish();
  }
  record('servidor disponible', true, BASE);

  const home = await get('/', { redirect: 'follow' });
  record('portada responde 200', home.status === 200, `status ${home.status}`);
  record('portada muestra la marca', /NOVASTORE/i.test(home.body));

  const products = await get('/productos', { redirect: 'follow' });
  record('catálogo responde 200', products.status === 200, `status ${products.status}`);

  const login = await get('/login', { redirect: 'follow' });
  record('login responde 200', login.status === 200, `status ${login.status}`);
  record('login muestra el formulario', /Iniciar sesión/i.test(login.body));

  const register = await get('/registro', { redirect: 'follow' });
  record('registro responde 200', register.status === 200, `status ${register.status}`);
  record('registro muestra el formulario', /Crear cuenta/i.test(register.body));

  // Rutas privadas: sin sesión deben redirigir al login (nunca mostrar datos).
  for (const path of ['/admin', '/cuenta', '/checkout']) {
    const res = await get(path);
    const protectedOk =
      (res.status >= 300 && res.status < 400 && /\/login/.test(res.location)) ||
      (res.status === 200 && /Iniciar sesión/i.test(res.body));
    record(`${path} exige sesión`, protectedOk, `status ${res.status} ${res.location}`);
  }

  const proof = await get('/api/comprobante/1');
  const proofProtected = proof.status === 401 || proof.status === 403 || (proof.status >= 300 && proof.status < 400);
  record('comprobantes no son públicos', proofProtected, `status ${proof.status}`);

  finish();
}

function finish() {
  stopServer();
  const failed = results.filter((r) => !r.passed);
  console.log(`\n${results.length - failed.length}/${results.length} comprobaciones correctas`);
  process.exit(failed.length === 0 ? 0 : 1);
}

process.on('SIGINT', () => {
  stopServer();
  process.exit(130);
});

main().catch((error) => {
  console.error(error);
  stopServer();
  process.exit(1);
});
