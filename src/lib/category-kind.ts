import type { Category, Product } from './catalog';

export type CategoryKind = 'recharge' | 'passes' | 'streaming' | 'numbers' | 'apps' | 'catalog';

export type KindMeta = {
  label: string;
  blurb: string;
  /** Texto corto para el chip del encabezado. */
  chip: string;
  steps: string[];
};

export const KIND_META: Record<CategoryKind, KindMeta> = {
  recharge: {
    label: 'Recargas y monedas',
    blurb: 'Elige tu paquete, indica tu ID de jugador y recibe tu recarga al instante.',
    chip: 'Entrega inmediata',
    steps: [
      'Elige el paquete que necesitas.',
      'Ingresa tu ID de jugador o usuario.',
      'Paga con tu saldo o con Yape / Plin.',
      'Recibe tu recarga en minutos.',
    ],
  },
  passes: {
    label: 'Pases y membresías',
    blurb: 'Pases, membresías y beneficios con activación rápida en tu cuenta.',
    chip: 'Activación rápida',
    steps: [
      'Selecciona el pase o membresía.',
      'Confirma los datos de tu cuenta.',
      'Completa el pago y espera la activación.',
    ],
  },
  streaming: {
    label: 'Streaming',
    blurb: 'Cuentas y suscripciones de streaming con garantía y soporte incluido.',
    chip: 'Cuentas verificadas',
    steps: [
      'Elige la plataforma y la duración.',
      'Indica el correo o perfil de tu preferencia.',
      'Recibe tus accesos por el chat de soporte.',
    ],
  },
  numbers: {
    label: 'Números virtuales',
    blurb: 'Números virtuales por país y servicio, listos para verificación.',
    chip: 'Cobertura internacional',
    steps: [
      'Elige el país y el servicio.',
      'Confirma la cantidad de números.',
      'Recibe tu número y el código de verificación.',
    ],
  },
  apps: {
    label: 'Apps y software',
    blurb: 'Licencias y aplicaciones originales con instalación guiada.',
    chip: 'Licencias originales',
    steps: [
      'Selecciona la aplicación o licencia.',
      'Indica el dispositivo donde la usarás.',
      'Recibe tu licencia y la guía de instalación.',
    ],
  },
  catalog: {
    label: 'Catálogo digital',
    blurb: 'Productos digitales seleccionados con entrega y soporte garantizado.',
    chip: 'Compra segura',
    steps: [
      'Elige el producto que necesitas.',
      'Revisa el aviso y completa los datos.',
      'Paga y recibe tu producto digital.',
    ],
  },
};

const norm = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

const RULES: Array<{ kind: CategoryKind; words: string[] }> = [
  {
    kind: 'recharge',
    words: [
      'diamante',
      'diamantes',
      'recarga',
      'recargas',
      'top up',
      'topup',
      'robux',
      'pavos',
      'monedas',
      'gemas',
      'gems',
      'uc pubg',
      'cp',
    ],
  },
  {
    kind: 'passes',
    words: ['pase', 'pases', 'membresia', 'membresias', 'booyah', 'elite pass', 'royale pass', 'suscripcion'],
  },
  {
    kind: 'streaming',
    words: [
      'streaming',
      'netflix',
      'disney',
      'hbo',
      'prime video',
      'spotify',
      'crunchyroll',
      'paramount',
      'apple tv',
      'vix',
      'flujo tv',
      'iptv',
    ],
  },
  {
    kind: 'numbers',
    words: ['numero', 'numeros', 'virtual', 'virtuales', 'sim', 'sms', 'otp', 'whatsapp virtual'],
  },
  {
    kind: 'apps',
    words: ['app', 'apps', 'aplicacion', 'aplicaciones', 'software', 'programa', 'licencia', 'licencias', 'windows', 'office', 'antivirus'],
  },
];

function match(words: string[], haystack: string): boolean {
  return words.some((word) => haystack.includes(word));
}

/**
 * Detecta el tipo de experiencia de compra de una categoría usando su nombre y
 * descripción (editables desde el panel) y, como respaldo, sus productos.
 * No guarda nada en la base de datos: siempre se recalcula.
 */
export function detectCategoryKind(category: Category, products: Product[] = []): CategoryKind {
  const haystack = norm(`${category.name} ${category.description}`);
  for (const rule of RULES) {
    if (match(rule.words, haystack)) return rule.kind;
  }

  const productText = norm(
    products
      .slice(0, 15)
      .map((product) => `${product.name} ${product.description}`)
      .join(' '),
  );
  for (const rule of RULES) {
    if (match(rule.words, productText)) return rule.kind;
  }

  return 'catalog';
}

/** Divide la descripción en beneficios cortos para las tarjetas de pases/apps. */
export function splitBenefits(description: string, limit = 4): string[] {
  return description
    .split(/\r?\n|·|\||;|,/)
    .map((line) => line.trim())
    .filter((line) => line.length > 2)
    .slice(0, limit);
}
