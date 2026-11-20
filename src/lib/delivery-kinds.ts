/**
 * Tipos de dato que el administrador puede entregar al cliente.
 * Vive en un módulo sin dependencias de servidor para poder usarse también
 * en componentes de cliente (el formulario del panel).
 */
export type DeliveryKind = 'texto' | 'correo' | 'password' | 'pin' | 'usuario' | 'fecha';

export interface DeliveryField {
  label: string;
  value: string;
  kind: DeliveryKind;
}

export const DELIVERY_KINDS: { value: DeliveryKind; label: string; icon: string }[] = [
  { value: 'texto', label: 'Dato / otro', icon: '📄' },
  { value: 'correo', label: 'Correo', icon: '✉️' },
  { value: 'password', label: 'Contraseña', icon: '🔑' },
  { value: 'pin', label: 'PIN o código', icon: '🔢' },
  { value: 'usuario', label: 'Usuario o perfil', icon: '👤' },
  { value: 'fecha', label: 'Fecha de vencimiento', icon: '📅' },
];

export function isDeliveryKind(value: unknown): value is DeliveryKind {
  return typeof value === 'string' && DELIVERY_KINDS.some((kind) => kind.value === value);
}

export function deliveryKindMeta(kind: DeliveryKind) {
  return DELIVERY_KINDS.find((item) => item.value === kind) ?? DELIVERY_KINDS[0];
}
