/**
 * Metadatos de los avisos y requisitos por producto.
 *
 * Este módulo es seguro para el navegador: no importa la base de datos, así que
 * lo pueden usar tanto el panel administrativo (servidor) como los componentes
 * de cliente (formulario de producto y ventana emergente del checkout).
 */

export type NoticeType = 'inmediata' | 'demora' | 'datos' | 'personalizado';

export type NoticeField = {
  label: string;
  required: boolean;
};

/** Aviso tal como se muestra al cliente (sin datos internos). */
export type PublicProductNotice = {
  productId: number;
  productName: string;
  type: NoticeType;
  message: string;
  deliveryTime: string;
  fields: NoticeField[];
};

/** Lo que el navegador envía al servidor al confirmar el aviso. */
export type NoticeAnswerPayload = {
  productId: number;
  values: { label: string; value: string }[];
};

/** Datos y aviso que quedan guardados junto al pedido. */
export type OrderNoticeAnswer = {
  productId: number;
  productName: string;
  type: NoticeType;
  message: string;
  deliveryTime: string;
  values: { label: string; value: string; required: boolean }[];
  acknowledgedAt: string;
};

export const MAX_NOTICE_FIELDS = 5;
export const MAX_NOTICE_MESSAGE = 600;
export const MAX_FIELD_LABEL = 60;
export const MAX_FIELD_VALUE = 120;

export const NOTICE_TYPES: {
  value: NoticeType;
  label: string;
  icon: string;
  hint: string;
  message: string;
}[] = [
  {
    value: 'inmediata',
    label: 'Entrega inmediata',
    icon: '⚡',
    hint: 'Informa que el producto se entrega al instante.',
    message:
      '⚡ ¡Entrega inmediata! Tu producto será procesado automáticamente al instante después de confirmar tu compra.',
  },
  {
    value: 'demora',
    label: 'Entrega con demora',
    icon: '⏳',
    hint: 'Avisa que el pedido puede tardar un tiempo aproximado.',
    message:
      '⏳ Aviso importante: tu pedido puede demorar en ser procesado. Gracias por tu paciencia.',
  },
  {
    value: 'datos',
    label: 'Requiere información',
    icon: '🔥',
    hint: 'Solicita el ID, usuario, servidor u otro dato antes de comprar.',
    message:
      '🔥 Antes de continuar, ingresa correctamente los datos solicitados. Verifica que sean correctos.',
  },
  {
    value: 'personalizado',
    label: 'Aviso personalizado',
    icon: '📢',
    hint: 'Escribe cualquier advertencia o instrucción propia.',
    message: '',
  },
];

export function noticeMeta(type: NoticeType) {
  return NOTICE_TYPES.find((item) => item.value === type) ?? NOTICE_TYPES[3];
}

/** Mensaje sugerido según el tipo y el tiempo de entrega configurado. */
export function defaultNoticeMessage(type: NoticeType, deliveryTime = ''): string {
  const time = deliveryTime.trim();
  if (type === 'demora' && time) {
    return `⏳ Aviso importante: tu pedido puede demorar entre ${time} en ser procesado. Gracias por tu paciencia.`;
  }
  return noticeMeta(type).message;
}

/** Clave estable para guardar el valor de un campo en el formulario del cliente. */
export function fieldKey(productId: number, label: string): string {
  return `${productId}:${label}`;
}
