export const PERU_TZ = 'America/Lima';

export function formatPEN(cents: number): string {
  return new Intl.NumberFormat('es-PE', {
    style: 'currency',
    currency: 'PEN',
    minimumFractionDigits: 2,
  }).format(cents / 100);
}

export function centsFromInput(value: unknown): number {
  if (value === null || value === undefined || value === '') return 0;
  const raw = typeof value === 'number' ? String(value) : String(value);
  const n = Number.parseFloat(raw.replace(/[^\d.,-]/g, '').replace(',', '.'));
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

/** Convierte centavos a texto editable en soles: 2590 -> "25.90" */
export function centsToInput(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return '';
  return (cents / 100).toFixed(2);
}ormalized = String(value).replace(',', '.').replace(/[^\d.]/g, '');
  const parsed = Number.parseFloat(normalized);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return Math.round(parsed * 100);
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('es-PE', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: PERU_TZ,
  }).format(date);
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('es-PE', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: PERU_TZ,
  }).format(date);
}

export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return '';
  const date = new Date(iso).getTime();
  if (Number.isNaN(date)) return '';
  const diff = Date.now() - date;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'hace un momento';
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `hace ${days} d`;
  return formatDate(iso);
}

export const ORDER_STATUS_LABELS: Record<string, string> = {
  pendiente: 'Pendiente',
  en_proceso: 'En proceso',
  entregado: 'Entregado',
  rechazado: 'Rechazado',
  cancelado: 'Cancelado',
};

export const PAYMENT_STATUS_LABELS: Record<string, string> = {
  pendiente: 'Pago pendiente',
  verificado: 'Pago verificado',
  rechazado: 'Pago rechazado',
};

export function statusTone(status: string): string {
  switch (status) {
    case 'entregado':
      return 'badge badge-success';
    case 'en_proceso':
      return 'badge badge-info';
    case 'rechazado':
      return 'badge badge-danger';
    case 'cancelado':
      return 'badge badge-muted';
    default:
      return 'badge badge-warning';
  }
}

export function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 70);
}

export function maskName(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return 'Cliente';
  const first = parts[0];
  const last = parts.length > 1 ? ` ${parts[parts.length - 1][0]}.` : '';
  return `${first}${last}`;
}
