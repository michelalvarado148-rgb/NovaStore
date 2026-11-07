import fs from 'node:fs';
import path from 'node:path';

/**
 * Genera las imágenes SVG propias de NOVASTORE (categorías y productos).
 * Sin marcas externas ni marcas de agua: arte original con la identidad negro/morado.
 *
 * Las rutas se derivan de las referencias `/images/...` sembradas en src/lib/db.ts,
 * de modo que cada imagen que usa la tienda siempre existe en public/.
 */

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, 'public', 'images');
const SEED_FILE = path.join(ROOT, 'src', 'lib', 'db.ts');

const ICONS = {
  game: '<path d="M8 10h3M9.5 8.5v3M15 9.5h.01M17 11.5h.01M7 6h10a4 4 0 0 1 3.9 4.9l-.8 4A3 3 0 0 1 16 16l-1.2-1.4h-5.6L8 16a3 3 0 0 1-4.1-1.1l-.8-4A4 4 0 0 1 7 6Z"/>',
  play: '<path d="M8 5.5v13l10-6.5-10-6.5Z"/><rect x="3" y="3" width="18" height="18" rx="4"/>',
  app: '<rect x="4" y="4" width="7" height="7" rx="2"/><rect x="13" y="4" width="7" height="7" rx="2"/><rect x="4" y="13" width="7" height="7" rx="2"/><rect x="13" y="13" width="7" height="7" rx="2"/>',
  social: '<circle cx="12" cy="12" r="9"/><path d="M15.5 8.5 13 13l-4.5 2.5L11 11l4.5-2.5Z"/>',
  phone: '<rect x="7" y="2.5" width="10" height="19" rx="2.5"/><path d="M10.5 18.5h3"/>',
  other: '<path d="M12 3l2.6 5.6 6.1.8-4.5 4.2 1.2 6-5.4-3-5.4 3 1.2-6L3.3 9.4l6.1-.8L12 3Z"/>',
  card: '<rect x="2.5" y="5" width="19" height="14" rx="3"/><path d="M2.5 10h19"/>',
  bolt: '<path d="M13 2 5 13.5h5.5L10 22l8-11.5h-5.5L13 2Z"/>',
  gift: '<rect x="3" y="9" width="18" height="11" rx="2"/><path d="M3 13h18M12 9v11M12 9C10 9 8 7.8 8 6.2A2.2 2.2 0 0 1 12 5a2.2 2.2 0 0 1 4 1.2C16 7.8 14 9 12 9Z"/>',
};

const PALETTE = [
  ['#3b0a63', '#0a0714'],
  ['#4a0f6b', '#0a0714'],
  ['#2a0b57', '#0a0714'],
  ['#5a0f72', '#0a0714'],
  ['#340d6b', '#0a0714'],
  ['#450f63', '#0a0714'],
  ['#4c1d95', '#120a1f'],
  ['#6d28d9', '#120a1f'],
  ['#5b21b6', '#120a1f'],
  ['#7c3aed', '#120a1f'],
  ['#8b5cf6', '#120a1f'],
  ['#9333ea', '#120a1f'],
];

const ACRONYMS = new Set(['hbo', 'sms', '4k', 'pc', 'tv', 'usd', 'pen', 'v', '11']);

function titleFromSlug(slug) {
  return slug
    .split('-')
    .map((word) => (ACRONYMS.has(word) ? word.toUpperCase() : word.charAt(0).toUpperCase() + word.slice(1)))
    .join(' ');
}

function iconFor(section, slug) {
  if (section === 'categories') {
    if (slug.includes('juego')) return 'game';
    if (slug.includes('streaming')) return 'play';
    if (slug.includes('aplicacion')) return 'app';
    if (slug.includes('redes')) return 'social';
    if (slug.includes('numero')) return 'phone';
    return 'other';
  }
  if (/numero/.test(slug)) return 'phone';
  if (/seguidores|instagram|tiktok/.test(slug)) return 'social';
  if (/netflix|disney|hbo|spotify|streaming/.test(slug)) return 'play';
  if (/steam|roblox|fortnite|gift|juego|gaming|playstation|robux|bucks/.test(slug)) return 'game';
  if (/canva|microsoft|capcut|chatgpt|windows|licencia|365/.test(slug)) return 'app';
  if (/combo|recarga|saldo|tarjeta/.test(slug)) return 'gift';
  return 'other';
}

function art({ file, title, subtitle, hue, icon }) {
  const [c1, c2] = hue;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 400" width="640" height="400" role="img" aria-label="${title}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${c1}"/>
      <stop offset="55%" stop-color="#140d24"/>
      <stop offset="100%" stop-color="${c2}"/>
    </linearGradient>
    <radialGradient id="glow" cx="50%" cy="35%" r="55%">
      <stop offset="0%" stop-color="#c084fc" stop-opacity="0.55"/>
      <stop offset="100%" stop-color="#c084fc" stop-opacity="0"/>
    </radialGradient>
    <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
      <path d="M40 0H0v40" fill="none" stroke="#a855f7" stroke-opacity="0.10" stroke-width="1"/>
    </pattern>
    <linearGradient id="stroke" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#f0e9ff"/>
      <stop offset="100%" stop-color="#c084fc"/>
    </linearGradient>
  </defs>
  <rect width="640" height="400" fill="url(#bg)"/>
  <rect width="640" height="400" fill="url(#grid)"/>
  <ellipse cx="320" cy="150" rx="230" ry="150" fill="url(#glow)"/>
  <circle cx="320" cy="170" r="96" fill="#0b0813" fill-opacity="0.55" stroke="#a855f7" stroke-opacity="0.55" stroke-width="2"/>
  <g transform="translate(268 118) scale(4.3)" fill="none" stroke="url(#stroke)" stroke-width="1.15" stroke-linecap="round" stroke-linejoin="round">
    ${ICONS[icon] ?? ICONS.other}
  </g>
  <text x="320" y="316" text-anchor="middle" font-family="Inter, Segoe UI, Arial, sans-serif" font-size="34" font-weight="800" fill="#f6f2ff">${title}</text>
  <text x="320" y="348" text-anchor="middle" font-family="Inter, Segoe UI, Arial, sans-serif" font-size="15" letter-spacing="4" fill="#c084fc">${subtitle}</text>
  <rect x="16" y="16" width="608" height="368" rx="22" fill="none" stroke="#a855f7" stroke-opacity="0.28" stroke-width="2"/>
</svg>`;
  const target = path.join(OUT_DIR, file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, svg, 'utf8');
  return file;
}

/** Rutas /images/... referenciadas por la base de datos (categorías y productos). */
function seedRefs() {
  const source = fs.readFileSync(SEED_FILE, 'utf8');
  const refs = new Set();
  for (const match of source.matchAll(/\/images\/(categories|products)\/([a-z0-9-]+)\.svg/g)) {
    refs.add(`${match[1]}/${match[2]}.svg`);
  }
  return [...refs];
}

const files = seedRefs();
if (files.length === 0) {
  console.error('No se encontraron referencias de imágenes en src/lib/db.ts');
  process.exit(1);
}

const created = files.map((file, index) => {
  const [section, name] = file.split('/');
  const slug = name.replace(/\.svg$/, '');
  return art({
    file,
    title: titleFromSlug(slug),
    subtitle: section === 'categories' ? 'CATEGORÍA' : 'NOVASTORE',
    hue: PALETTE[index % PALETTE.length],
    icon: iconFor(section, slug),
  });
});

const missing = created.filter((file) => !fs.existsSync(path.join(OUT_DIR, file)));
if (missing.length > 0) {
  console.error('No se pudieron generar:', missing.join(', '));
  process.exit(1);
}

console.log(`Imágenes generadas (${created.length}):`, created.join(', '));
