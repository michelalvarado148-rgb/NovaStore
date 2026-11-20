/**
 * Presets y utilidades de la duración del producto (Streaming).
 *
 * Este módulo no importa nada del servidor, así que puede usarse tanto en el
 * panel (componentes cliente) como en la tienda.
 */
export const MAX_CUSTOM_DURATION = 40;

export type DurationPresetValue = '7d' | '15d' | '1m' | '2m' | '3m' | '6m' | '1y' | 'custom';

export type DurationPreset = {
  value: DurationPresetValue;
  /** Texto del selector del panel. */
  label: string;
  /** Texto corto que ve el cliente. */
  short: string;
};

export const DURATION_PRESETS: DurationPreset[] = [
  { value: '7d', label: '7 días', short: '7 DÍAS' },
  { value: '15d', label: '15 días', short: '15 DÍAS' },
  { value: '1m', label: '1 mes', short: '1 MES' },
  { value: '2m', label: '2 meses', short: '2 MESES' },
  { value: '3m', label: '3 meses', short: '3 MESES' },
  { value: '6m', label: '6 meses', short: '6 MESES' },
  { value: '1y', label: '1 año', short: '1 AÑO' },
  { value: 'custom', label: 'Duración personalizada…', short: '' },
];

export type ProductDuration = {
  preset: DurationPresetValue;
  /** Texto libre cuando `preset === 'custom'`. */
  custom: string;
  /** Etiqueta lista para mostrar: «1 MES», «3 MESES», «45 DÍAS». */
  label: string;
};

export const PRESET_BY_VALUE = new Map(DURATION_PRESETS.map((preset) => [preset.value, preset]));

export function isDurationPreset(value: unknown): value is DurationPresetValue {
  return typeof value === 'string' && PRESET_BY_VALUE.has(value as DurationPresetValue);
}

/**
 * Normaliza el texto libre de una duración personalizada: «1 mes» → «1 MES»,
 * «2 meses» → «2 MESES», «45» → «45 DÍAS», «10 dias» → «10 DÍAS».
 */
export function normalizeCustomDuration(raw: string): string {
  const text = String(raw ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_CUSTOM_DURATION);
  if (!text) return '';

  const match = text.match(/^(\d{1,3})\s*([a-záéíóúñ.]*)$/i);
  if (match) {
    const amount = Number(match[1]);
    const unit = match[2].toLowerCase().replace(/\.$/, '');
    if (!unit) return `${amount} DÍA${amount === 1 ? '' : 'S'}`;
    if (/^(d|dia|dias|día|días)$/.test(unit)) return `${amount} DÍA${amount === 1 ? '' : 'S'}`;
    if (/^(sem|semana|semanas)$/.test(unit)) return `${amount} SEMANA${amount === 1 ? '' : 'S'}`;
    if (/^(m|mes|meses)$/.test(unit)) return `${amount} ${amount === 1 ? 'MES' : 'MESES'}`;
    if (/^(a|ano|anos|año|años)$/.test(unit)) return `${amount} AÑO${amount === 1 ? '' : 'S'}`;
  }

  return text.toUpperCase();
}

/** Etiqueta visible para un preset (o el texto normalizado si es personalizado). */
export function durationLabelFor(preset: string, custom: string): string {
  if (!isDurationPreset(preset)) return '';
  if (preset === 'custom') return normalizeCustomDuration(custom);
  return PRESET_BY_VALUE.get(preset)?.short ?? '';
}
