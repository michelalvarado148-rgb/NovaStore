/**
 * Reglas puras de la cantidad personalizada por producto.
 *
 * Vive separado del acceso a datos (`custom-quantity.ts`) para que el selector
 * del cliente pueda importar los mismos cálculos sin arrastrar la base de datos.
 */

/** Bases de precio admitidas: por unidad, por 100 o por 1000. */
export const QTY_BASES = [1, 100, 1000] as const;

/** Tope técnico para evitar cantidades absurdas o desbordes. */
export const MAX_CUSTOM_QTY = 1_000_000;

export type QtyConfig = {
  /** Si el producto usa cantidad personalizada. */
  enabled: boolean;
  /** 1 = precio por unidad, 100 = por 100 unidades, 1000 = por 1000. */
  basis: number;
  /** Cantidad mínima de compra. */
  min: number;
  /** Cantidad máxima (null = sin máximo configurado). */
  max: number | null;
  /** Intervalo permitido a partir del mínimo. */
  step: number;
};

export const DEFAULT_QTY_CONFIG: QtyConfig = {
  enabled: false,
  basis: 1,
  min: 1,
  max: null,
  step: 1,
};

export type QtyValidation = { ok: true; quantity: number } | { ok: false; error: string };

function intOr(value: unknown, fallback: number): number {
  const n = Math.trunc(Number(value));
  return Number.isFinite(n) ? n : fallback;
}

/** Normaliza y valida la configuración recibida desde el panel. */
export function normalizeQtyConfig(input: Partial<QtyConfig> | null | undefined): QtyConfig {
  const enabled =
    input?.enabled === true || (input?.enabled as unknown) === 1 || (input?.enabled as unknown) === 'on';
  const rawBasis = intOr(input?.basis, 1);
  const basis = (QTY_BASES as readonly number[]).includes(rawBasis) ? rawBasis : 1;

  let min = intOr(input?.min, 1);
  if (min < 1) min = 1;
  if (min > MAX_CUSTOM_QTY) min = MAX_CUSTOM_QTY;

  const rawMax = input?.max;
  let max: number | null =
    rawMax === null || rawMax === undefined || String(rawMax).trim() === '' ? null : intOr(rawMax, 0);
  if (max !== null) {
    if (max < 1) max = null;
    if (max > MAX_CUSTOM_QTY) max = MAX_CUSTOM_QTY;
    if (max < min) max = min;
  }

  let step = intOr(input?.step, 1);
  if (step < 1) step = 1;
  if (step > MAX_CUSTOM_QTY) step = MAX_CUSTOM_QTY;

  return { enabled, basis, min, max, step };
}

/** Texto de la base de precio: "por unidad", "por cada 100 unidades"... */
export function basisLabel(basis: number): string {
  if (basis === 1000) return 'por cada 1000 unidades';
  if (basis === 100) return 'por cada 100 unidades';
  return 'por unidad';
}

export function basisShortLabel(basis: number): string {
  if (basis === 1000) return 'por 1000';
  if (basis === 100) return 'por 100';
  return 'por unidad';
}

/**
 * Precio unitario en centavos. Puede ser fraccionario (S/ 2.00 por 100 = 0.02
 * por unidad), por eso se devuelve sin redondear y se formatea al mostrarlo.
 */
export function unitPriceCents(priceCents: number, config: QtyConfig): number {
  const basis = config.basis > 0 ? config.basis : 1;
  return priceCents / basis;
}

/** Total en centavos para una cantidad, redondeado al centavo. */
export function totalCentsFor(priceCents: number, quantity: number, config: QtyConfig): number {
  const basis = config.basis > 0 ? config.basis : 1;
  const qty = Math.max(0, Math.trunc(quantity));
  return Math.round((priceCents * qty) / basis);
}

/** Importe por unidad con los decimales necesarios (S/ 0.02). */
export function formatUnitPrice(cents: number): string {
  const value = cents / 100;
  const decimals = Number.isInteger(Number(value.toFixed(2))) ? 2 : 4;
  return new Intl.NumberFormat('es-PE', {
    style: 'currency',
    currency: 'PEN',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

function fmtQty(value: number): string {
  return new Intl.NumberFormat('es-PE').format(value);
}

/** Valida una cantidad contra la configuración del producto. */
export function validateQuantity(config: QtyConfig, rawQuantity: unknown): QtyValidation {
  if (!config.enabled) {
    const qty = intOr(rawQuantity, 1);
    if (qty < 1) return { ok: false, error: 'La cantidad mínima es 1 unidad.' };
    return { ok: true, quantity: qty };
  }

  const qty = Number(rawQuantity);
  if (!Number.isFinite(qty) || !Number.isInteger(qty) || qty < 1) {
    return { ok: false, error: 'Escribe una cantidad válida en números enteros.' };
  }
  if (qty > MAX_CUSTOM_QTY) {
    return { ok: false, error: `La cantidad no puede superar ${fmtQty(MAX_CUSTOM_QTY)} unidades.` };
  }
  if (qty < config.min) {
    return {
      ok: false,
      error: `La cantidad mínima para este producto es ${fmtQty(config.min)} unidades.`,
    };
  }
  if (config.max !== null && qty > config.max) {
    return {
      ok: false,
      error: `La cantidad máxima para este producto es ${fmtQty(config.max)} unidades.`,
    };
  }
  if (config.step > 1 && (qty - config.min) % config.step !== 0) {
    const examples = [config.min, config.min + config.step, config.min + config.step * 2]
      .filter((value) => config.max === null || value <= config.max)
      .map(fmtQty)
      .join(', ');
    return {
      ok: false,
      error: `Este producto se compra de ${fmtQty(config.step)} en ${fmtQty(
        config.step,
      )} a partir de ${fmtQty(config.min)} unidades (por ejemplo: ${examples}).`,
    };
  }
  return { ok: true, quantity: qty };
}

/** Cantidades sugeridas para el cliente (10, 20, 50, 100, 500, 1000...). */
export function quantityPresets(config: QtyConfig): number[] {
  const candidates = [10, 20, 50, 100, 500, 1000, config.min, config.min + config.step];
  const valid = new Set<number>();
  for (const candidate of candidates) {
    if (validateQuantity(config, candidate).ok) valid.add(candidate);
  }
  const list = [...valid].sort((a, b) => a - b).slice(0, 6);
  return list.length > 0 ? list : [config.min];
}

/** Descripción legible de los límites: "Desde 100 hasta 10 000 · de 100 en 100". */
export function describeQtyRange(config: QtyConfig): string {
  const parts = [`Desde ${fmtQty(config.min)}`];
  if (config.max !== null) parts[0] += ` hasta ${fmtQty(config.max)}`;
  if (config.step > 1) parts.push(`de ${fmtQty(config.step)} en ${fmtQty(config.step)}`);
  return parts.join(' · ');
}
