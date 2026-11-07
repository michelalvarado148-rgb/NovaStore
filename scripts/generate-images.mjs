import fs from 'node:fs';
import path from 'node:path';

/**
 * Genera las imágenes SVG propias de NOVASTORE (categorías y productos).
 * Sin marcas externas ni marcas de agua: arte original con la identidad negro/morado.
 */

const OUT_DIR = path.join(process.cwd(), 'public', 'images');

const ICONS = {
  game: '<path d="M8 10h3M9.5 8.5v3M15 9.5h.01M17 11.5h.01M7 6h10a4 4 0 0 1 3.9 4.9l-.8 4A3 3 0 0 1 16 16l-1.2-1.4h-5.6L8 16a3 3 0 0 1-4.1-1.1l-.8-4A4 4 0 0 1 7 6Z"/>',
  play: '<path d="M8 5.5v13l10-6.5-10-6.5Z"/><rect x="3" y="3" width="18" height="18" rx="4"/>',
  app: '<rect x="4" y="4" width="7" height="7" rx="2"/><rect x="13" y="4" width="7" height="7" rx="2"/><rect x="4" y="13" width="7" height="7" rx="2"/><rect x="13" y="13" width="7" height="7" rx="2"/>',
  social: '<circle cx="12" cy="12" r="9"/><path d="M15.5 8.5 13 13l-4.5 2.5L11 11l4.5-2.5Z"/>',
  phone: '<rect x="7" y="2.5" width="10" height="19" rx="2.5"/><path d="M10.5 18.5h3"/>',
  other: '<path d="M12 3l2.6 5.6 6.1.8-4.5 4.2 1.2 6-5.4-3-5.4 3 1.2-6L3.3 9.4l6.1-.8L12 3Z"/>',
  card: '<rect x="2.5" y="5" width="19" height="14" rx="3"/><path d="M2.5 10h19"/>',
  star: '<path d="M12 3.5l2.4 5.2 5.7.7-4.2 3.9 1.1 5.6-5-2.8-5 2.8 1.1-5.6L4 7.4l5.7-.7L12 3.5Z"/>',
  bolt: '<path d="M13 2 5 13.5h5.5L10 22l8-11.5h-5.5L13 2Z"/>',
  gift: '<rect x="3" y="9" width="18" height="11" rx="2"/><path d="M3 13h18M12 9v11M12 9C10 9 8 7.8 8 6.2A2.2 2.2 0 0 1 12 5a2.2 2.2 0 0 1 4 1.2C16 7.8 14 9 12 9Z"/>',
};

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
  fs.writeFileSync(path.join(OUT_DIR, file), svg, 'utf8');
  return file;
}

const categories = [
  { file: 'cat-juegos.svg', title: 'Juegos', subtitle: 'GAME CARDS', hue: ['#3b0a63', '#0a0714'], icon: 'game' },
  { file: 'cat-streaming.svg', title: 'Streaming', subtitle: 'SUSCRIPCIONES', hue: ['#4a0f6b', '#0a0714'], icon: 'play' },
  { file: 'cat-aplicaciones.svg', title: 'Aplicaciones', subtitle: 'LICENCIAS', hue: ['#2a0b57', '#0a0714'], icon: 'app' },
  { file: 'cat-redes-sociales.svg', title: 'Redes sociales', subtitle: 'SERVICIOS', hue: ['#5a0f72', '#0a0714'], icon: 'social' },
  { file: 'cat-numeros-virtuales.svg', title: 'Números virtuales', subtitle: 'VERIFICACIÓN', hue: ['#340d6b', '#0a0714'], icon: 'phone' },
  { file: 'cat-otros.svg', title: 'Otros digitales', subtitle: 'EXTRAS', hue: ['#450f63', '#0a0714'], icon: 'other' },
];

const products = [
  { file: 'prod-giftcard-juego.svg', title: 'Gift Card Gaming', subtitle: 'NOVASTORE', hue: ['#4c1d95', '#120a1f'], icon: 'game' },
  { file: 'prod-streaming-premium.svg', title: 'Streaming Premium', subtitle: 'NOVASTORE', hue: ['#6d28d9', '#120a1f'], icon: 'play' },
  { file: 'prod-app-pro.svg', title: 'App Pro', subtitle: 'NOVASTORE', hue: ['#5b21b6', '#120a1f'], icon: 'app' },
  { file: 'prod-redes-seguidores.svg', title: 'Redes Sociales', subtitle: 'NOVASTORE', hue: ['#7c3aed', '#120a1f'], icon: 'social' },
  { file: 'prod-numero-virtual.svg', title: 'Número Virtual', subtitle: 'NOVASTORE', hue: ['#8b5cf6', '#120a1f'], icon: 'phone' },
  { file: 'prod-tarjeta-virtual.svg', title: 'Tarjeta Virtual', subtitle: 'NOVASTORE', hue: ['#9333ea', '#120a1f'], icon: 'card' },
  { file: 'prod-recarga-saldo.svg', title: 'Recarga Digital', subtitle: 'NOVASTORE', hue: ['#a855f7', '#120a1f'], icon: 'bolt' },
  { file: 'prod-combo-digital.svg', title: 'Combo Digital', subtitle: 'NOVASTORE', hue: ['#c026d3', '#120a1f'], icon: 'gift' },
];

fs.mkdirSync(OUT_DIR, { recursive: true });
const created = [...categories, ...products].map(art);
console.log(`Imágenes generadas (${created.length}):`, created.join(', '));
