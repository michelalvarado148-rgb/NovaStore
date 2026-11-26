import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { formatDateTime, formatPEN } from '@/lib/format';
import {
  getMyWalletRequests,
  getWalletAccount,
  getWalletConfig,
  listWalletMovements,
} from '@/lib/wallet';
import {
  createWalletRechargeAction,
  createWalletWithdrawalAction,
} from '@/app/actions/wallet';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'NovaWallet' };

const STATUS: Record<string, { label: string; className: string }> = {
  pendiente: { label: 'Pendiente', className: 'nw-pill nw-pill-warn' },
  aprobado: { label: 'Aprobado', className: 'nw-pill nw-pill-ok' },
  rechazado: { label: 'Rechazado', className: 'nw-pill nw-pill-danger' },
};

const KIND_LABEL: Record<string, string> = {
  recarga: 'Recarga',
  retiro: 'Retiro',
};

/* Iconos en línea con tamaño fijo: nunca se estiran dentro de un flex. */

type IconProps = { className?: string; size?: number };

function WalletIcon({ className, size = 18 }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H18a2 2 0 0 1 2 2v1.5" />
      <path d="M3 7.5V17a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5.5a2 2 0 0 0-2-2H5.5A2.5 2.5 0 0 1 3 7.5Z" />
      <path d="M17.5 13.5h.01" />
    </svg>
  );
}

function PlusIcon({ className = 'nw-ico', size = 16 }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      className={className}
      aria-hidden
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function ArrowUpIcon({ className = 'nw-ico', size = 16 }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M12 19V5M6 11l6-6 6 6" />
    </svg>
  );
}

function ArrowDownIcon({ className = 'nw-ico', size = 16 }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M12 5v14M6 13l6 6 6-6" />
    </svg>
  );
}

function QrIcon({ className = 'nw-ico', size = 16 }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M4 9V5.5A1.5 1.5 0 0 1 5.5 4H9M15 4h3.5A1.5 1.5 0 0 1 20 5.5V9M20 15v3.5a1.5 1.5 0 0 1-1.5 1.5H15M9 20H5.5A1.5 1.5 0 0 1 4 18.5V15" />
      <path d="M8.5 8.5h1.5v1.5H8.5zM14 8.5h1.5V10H14zM8.5 14H10v1.5H8.5zM14 14h1.5v1.5H14z" />
    </svg>
  );
}

function ClockIcon({ className = 'nw-ico', size = 16 }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 8v4.5l3 1.8" />
    </svg>
  );
}

function ShieldIcon({ className = 'nw-ico-sm', size = 12 }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M12 3.5 5 6.5v5c0 4 3 7.4 7 9 4-1.6 7-5 7-9v-5l-7-3Z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

function InfoIcon({ className = 'nw-note-ico', size = 14 }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 11v5M12 8h.01" />
    </svg>
  );
}

export default async function NovaWalletPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const user = await requireUser('/extra/novawallet');
  const sp = await searchParams;

  const config = getWalletConfig();
  const account = getWalletAccount(user.id);
  const requests = getMyWalletRequests(user.id, 50);
  const movements = listWalletMovements(user.id, 200);

  const credited = movements
    .filter((m) => m.amount_cents > 0)
    .reduce((sum, m) => sum + m.amount_cents, 0);
  const withdrawn = movements
    .filter((m) => m.amount_cents < 0)
    .reduce((sum, m) => sum + m.amount_cents, 0);
  const pending = requests.filter((r) => r.status === 'pendiente').length;

  const feeParts: string[] = [];
  if (config.fee_enabled) {
    if (config.fee_percent > 0) feeParts.push(`${config.fee_percent}%`);
    if (config.fee_fixed_cents > 0) feeParts.push(formatPEN(config.fee_fixed_cents));
  }
  const feeText = feeParts.length > 0 ? feeParts.join(' + ') : '';

  return (
    <div className="nw-page">
      {/* 1. Encabezado compacto con el estado de la billetera */}
      <header className="nw-head">
        <span className="nw-head-mark">
          <WalletIcon />
        </span>
        <div className="nw-head-text">
          <p className="nw-eyebrow">Billetera digital</p>
          <h1 className="nw-title">NovaWallet</h1>
        </div>
        <div className="nw-head-actions">
          <span className={pending > 0 ? 'nw-pill nw-pill-warn' : 'nw-pill nw-pill-ok'}>
            {pending > 0 ? `${pending} pendiente${pending === 1 ? '' : 's'}` : 'Activa'}
          </span>
          <Link href="/extra" className="nw-back" aria-label="Volver a EXTRA">
            ←
          </Link>
        </div>
      </header>

      {sp.ok ? <p className="nw-alert nw-alert-ok">{sp.ok}</p> : null}
      {sp.error ? <p className="nw-alert nw-alert-err">{sp.error}</p> : null}

      {/* 2. Tarjeta principal del saldo */}
      <section className="nw-hero">
        <span aria-hidden className="nw-hero-glow" />
        <div className="nw-hero-top">
          <p className="nw-label">Saldo disponible</p>
          <span className="nw-chip">
            <ShieldIcon /> Independiente
          </span>
        </div>
        <p className="nw-balance">{formatPEN(account.balance_cents)}</p>
        <p className="nw-hero-note">
          Solo para NovaWallet: no se usa para comprar en la tienda ni se mezcla con tu saldo de
          compras.
        </p>
      </section>

      {/* 3. Dos acciones principales */}
      <div className="nw-actions">
        <a href="#recarga" className="nw-btn nw-btn-add">
          <PlusIcon /> Agregar dinero
        </a>
        <a href="#retiro" className="nw-btn nw-btn-out">
          <ArrowUpIcon /> Retirar dinero
        </a>
      </div>

      {/* 4. Totales de la alcancía */}
      <div className="nw-totals">
        <div className="nw-total">
          <p className="nw-total-label nw-total-in">
            <ArrowDownIcon className="nw-ico-sm" size={13} /> Total ingresado
          </p>
          <p className="nw-total-value nw-total-in">{formatPEN(credited)}</p>
        </div>
        <div className="nw-total">
          <p className="nw-total-label nw-total-out">
            <ArrowUpIcon className="nw-ico-sm" size={13} /> Total retirado
          </p>
          <p className="nw-total-value nw-total-out">{formatPEN(Math.abs(withdrawn))}</p>
        </div>
      </div>

      {/* 5. Comisiones y condiciones, en un aviso pequeño */}
      <p className="nw-note">
        <InfoIcon />
        <span>
          Recarga mínima {formatPEN(config.min_recharge_cents)} · Retiro mínimo{' '}
          {formatPEN(config.min_withdraw_cents)} ·{' '}
          {config.fee_enabled && feeText
            ? `comisión de retiro ${feeText}`
            : 'sin comisión de retiro'}
          . Tu saldo cambia solo cuando el administrador aprueba la operación.
        </span>
      </p>

      {config.notice ? <p className="nw-alert nw-alert-notice">{config.notice}</p> : null}

      {/* 6. Últimos movimientos */}
      <section id="movimientos" className="nw-card">
        <div className="nw-card-head">
          <ClockIcon />
          <div className="nw-card-head-text">
            <h2 className="nw-card-title">Últimos movimientos</h2>
          </div>
          <span className="nw-card-count">
            {movements.length} registro{movements.length === 1 ? '' : 's'}
          </span>
        </div>
        {movements.length === 0 ? (
          <p className="nw-empty">
            Aún no tienes movimientos. Cuando el administrador apruebe una recarga o un retiro,
            aparecerá aquí.
          </p>
        ) : (
          <ul className="nw-list">
            {movements.map((movement) => {
              const isIncome = movement.amount_cents >= 0;
              return (
                <li key={movement.id} className="nw-item">
                  <span className={`nw-item-ico ${isIncome ? 'nw-in' : 'nw-out'}`}>
                    {isIncome ? (
                      <ArrowDownIcon className="nw-ico-sm" size={14} />
                    ) : (
                      <ArrowUpIcon className="nw-ico-sm" size={14} />
                    )}
                  </span>
                  <div className="nw-item-main">
                    <p className="nw-item-desc">{movement.description}</p>
                    <p className="nw-item-meta">
                      {formatDateTime(movement.created_at)} ·{' '}
                      {movement.kind === 'ingreso' ? 'Ingreso' : 'Retiro'}
                    </p>
                  </div>
                  <p className={`nw-item-amount ${isIncome ? 'nw-amount-in' : 'nw-amount-out'}`}>
                    {isIncome ? '+' : ''}
                    {formatPEN(movement.amount_cents)}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* 7. Agregar dinero con el QR del administrador */}
      <section id="recarga" className="nw-card">
        <div className="nw-card-head">
          <QrIcon />
          <div className="nw-card-head-text">
            <h2 className="nw-card-title">Agregar dinero con QR</h2>
            <p className="nw-card-sub">Escanea el QR, paga y sube la foto de tu comprobante.</p>
          </div>
        </div>

        <div className="nw-card-body">
          <div className="nw-qr-box">
            {config.qr_url ? (
              <div className="nw-qr-grid">
                <div className="nw-qr-frame">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={config.qr_url}
                    alt="QR de pago de NovaWallet"
                    className="nw-qr-img"
                    width={176}
                    height={176}
                  />
                </div>
                <ol className="nw-steps">
                  <li>Abre Yape o Plin y escanea el QR.</li>
                  <li>
                    Paga el monto que quieres agregar
                    {config.yape_holder ? ` a nombre de ${config.yape_holder}` : ''}.
                  </li>
                  <li>Registra el monto y sube tu comprobante aquí abajo.</li>
                </ol>
              </div>
            ) : config.yape_number ? (
              <div>
                <p className="nw-phone-label">Yape · el QR todavía no está configurado</p>
                <p className="nw-phone">{config.yape_number}</p>
                {config.yape_holder ? <p className="nw-phone-holder">{config.yape_holder}</p> : null}
              </div>
            ) : (
              <p className="nw-alert nw-alert-notice">
                El administrador todavía no configuró su QR de pago. Escríbenos por Soporte.
              </p>
            )}
          </div>

          <form action={createWalletRechargeAction} className="nw-form" style={{ marginTop: '0.6rem' }}>
            <label className="nw-field">
              <span className="nw-field-label">Monto pagado (S/)</span>
              <input
                type="number"
                name="amount"
                min={config.min_recharge_cents / 100}
                step="0.01"
                required
                inputMode="decimal"
                placeholder="20.00"
              />
            </label>
            <label className="nw-field">
              <span className="nw-field-label">N° de operación (opcional)</span>
              <input
                type="text"
                name="reference"
                maxLength={60}
                placeholder="Ej. 0123456"
              />
            </label>
            <label className="nw-field nw-field-full">
              <span className="nw-field-label">Comprobante (JPG, PNG o WEBP)</span>
              <input
                type="file"
                name="proof"
                required
                accept="image/jpeg,image/png,image/webp"
              />
            </label>
            <label className="nw-field nw-field-full">
              <span className="nw-field-label">Nota para el administrador (opcional)</span>
              <textarea
                name="note"
                rows={2}
                maxLength={300}
                placeholder="Ej. Pagué con el QR a nombre de…"
              />
            </label>
            <button type="submit" className="nw-submit nw-submit-primary nw-field-full">
              Enviar comprobante
            </button>
          </form>
        </div>
      </section>

      {/* 8. Retirar dinero */}
      <section id="retiro" className="nw-card">
        <div className="nw-card-head">
          <ArrowUpIcon />
          <div className="nw-card-head-text">
            <h2 className="nw-card-title">Retirar dinero</h2>
            <p className="nw-card-sub">
              Se descuenta de tu saldo cuando el administrador aprueba la solicitud.
            </p>
          </div>
        </div>

        <div className="nw-card-body">
          <form action={createWalletWithdrawalAction} className="nw-form">
            <label className="nw-field">
              <span className="nw-field-label">Monto a retirar (S/)</span>
              <input
                type="number"
                name="amount"
                min={config.min_withdraw_cents / 100}
                max={account.balance_cents / 100}
                step="0.01"
                required
                inputMode="decimal"
                placeholder="10.00"
              />
            </label>
            <label className="nw-field">
              <span className="nw-field-label">¿Cómo quieres recibirlo?</span>
              <select name="method" required>
                <option value="Yape">Yape</option>
                <option value="Plin">Plin</option>
                <option value="Transferencia">Transferencia bancaria</option>
              </select>
            </label>
            <label className="nw-field nw-field-full">
              <span className="nw-field-label">Número o cuenta de destino</span>
              <textarea
                name="note"
                rows={2}
                maxLength={300}
                required
                placeholder="Ej. Yape 987 654 321 a nombre de…"
              />
            </label>
            <button type="submit" className="nw-submit nw-submit-outline nw-field-full">
              Solicitar retiro
            </button>
          </form>
        </div>
      </section>

      {/* 9. Estado de las solicitudes */}
      <section id="solicitudes" className="nw-card">
        <div className="nw-card-head">
          <div className="nw-card-head-text">
            <h2 className="nw-card-title">Mis solicitudes</h2>
          </div>
          <span className="nw-card-count">{requests.length} en total</span>
        </div>
        {requests.length === 0 ? (
          <p className="nw-empty">Aún no tienes solicitudes en NovaWallet.</p>
        ) : (
          <ul className="nw-list">
            {requests.map((request) => {
              const status = STATUS[request.status];
              return (
                <li key={request.id} className="nw-req">
                  <div className="nw-req-top">
                    <p className="nw-req-title">
                      {KIND_LABEL[request.kind]} · {formatPEN(request.amount_cents)}
                    </p>
                    <span className={status.className}>{status.label}</span>
                  </div>
                  <p className="nw-req-meta">
                    {formatDateTime(request.created_at)}
                    {request.kind === 'retiro' && request.fee_cents > 0
                      ? ` · comisión ${formatPEN(request.fee_cents)} · recibes ${formatPEN(
                          request.net_cents,
                        )}`
                      : ''}
                  </p>
                  {request.admin_note ? (
                    <p className="nw-req-answer">Respuesta: {request.admin_note}</p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
