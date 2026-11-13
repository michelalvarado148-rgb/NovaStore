'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

type DeviceSummary = { device: string; createdAt: string; lastSeenAt: string };

type Props = {
  enabled: boolean;
  devices: DeviceSummary[];
  lastSentAt: string | null;
  publicKey: string;
};

type Status = 'cargando' | 'no-soportado' | 'listo' | 'activo' | 'denegado';

function urlBase64ToArrayBuffer(base64String: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const buffer = new ArrayBuffer(raw.length);
  const view = new Uint8Array(buffer);
  for (let i = 0; i < raw.length; i += 1) view[i] = raw.charCodeAt(i);
  return buffer;
}

function formatWhen(value: string | null): string {
  if (!value) return 'Todavía no se envió ninguna';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('es-PE', { dateStyle: 'short', timeStyle: 'short' }).format(date);
}

export default function PushNotificationsManager({
  enabled,
  devices,
  lastSentAt,
  publicKey,
}: Props) {
  const router = useRouter();
  const [status, setStatus] = useState<Status>('cargando');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'ok' | 'error' | 'info'; text: string } | null>(
    null,
  );
  const [isIos, setIsIos] = useState(false);
  const [installed, setInstalled] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const ua = navigator.userAgent;
    const ios = /iPhone|iPad|iPod/i.test(ua);
    setIsIos(ios);
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as unknown as { standalone?: boolean }).standalone === true;
    setInstalled(standalone);

    if (
      !('serviceWorker' in navigator) ||
      !('PushManager' in window) ||
      !('Notification' in window)
    ) {
      setStatus('no-soportado');
      return;
    }

    (async () => {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
        const existing = await registration.pushManager.getSubscription();
        if (cancelled) return;
        setStatus(
          existing ? 'activo' : Notification.permission === 'denied' ? 'denegado' : 'listo',
        );
      } catch {
        if (!cancelled) {
          setStatus('no-soportado');
          setMessage({
            tone: 'error',
            text: 'Este navegador no pudo preparar el service worker de notificaciones.',
          });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  async function enable() {
    setBusy(true);
    setMessage(null);
    try {
      if (!('Notification' in window)) {
        throw new Error('Este navegador no admite notificaciones.');
      }
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setStatus('denegado');
        setMessage({
          tone: 'error',
          text: 'Permiso denegado. Habilita las notificaciones para este sitio en los ajustes del navegador y vuelve a intentar.',
        });
        return;
      }

      const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
      await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToArrayBuffer(publicKey),
      });

      const response = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription: subscription.toJSON() }),
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error || 'No se pudo guardar este dispositivo.');
      }

      setStatus('activo');
      setMessage({ tone: 'ok', text: 'Notificaciones activadas en este dispositivo.' });
      router.refresh();
    } catch (error) {
      setMessage({
        tone: 'error',
        text: error instanceof Error ? error.message : 'No se pudieron activar las notificaciones.',
      });
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    setMessage(null);
    try {
      const registration = await navigator.serviceWorker.getRegistration('/sw.js');
      const subscription = await registration?.pushManager.getSubscription();
      if (subscription) {
        await fetch('/api/push/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ remove: true, endpoint: subscription.endpoint }),
        });
        await subscription.unsubscribe();
      }
      setStatus(Notification.permission === 'denied' ? 'denegado' : 'listo');
      setMessage({ tone: 'info', text: 'Notificaciones desactivadas en este dispositivo.' });
      router.refresh();
    } catch {
      setMessage({ tone: 'error', text: 'No se pudieron desactivar las notificaciones.' });
    } finally {
      setBusy(false);
    }
  }

  async function sendTest() {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch('/api/push/test', { method: 'POST' });
      const data = (await response.json().catch(() => ({}))) as {
        sent?: number;
        failed?: number;
        reason?: string;
        error?: string;
      };
      if (data.sent && data.sent > 0) {
        setMessage({ tone: 'ok', text: 'Aviso de prueba enviado. Revisa tu teléfono.' });
        router.refresh();
      } else if (data.reason === 'sin-dispositivos') {
        setMessage({ tone: 'info', text: 'Primero activa las notificaciones en este dispositivo.' });
      } else {
        setMessage({
          tone: 'error',
          text: data.error || 'El servicio de push rechazó el aviso. Vuelve a activar el dispositivo.',
        });
      }
    } catch {
      setMessage({ tone: 'error', text: 'No se pudo enviar el aviso de prueba.' });
    } finally {
      setBusy(false);
    }
  }

  const active = status === 'activo';
  const unsupported = status === 'no-soportado';

  return (
    <section className="rounded-2xl border border-purple-500/25 bg-[#0e0a1a]/80 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[0.65rem] font-bold uppercase tracking-[0.2em] text-fuchsia-300">
            Notificaciones push
          </p>
          <h2 className="mt-1 text-xl font-black text-white">Tu teléfono como centro de avisos</h2>
          <p className="mt-1 max-w-xl text-sm text-slate-300">
            Recibe pedidos, recargas y comprobantes aunque NOVASTORE esté cerrada. Solo llegan a los
            dispositivos autorizados aquí; los clientes nunca reciben estos avisos.
          </p>
        </div>
        <span
          className={`rounded-full border px-3 py-1 text-xs font-bold ${
            active
              ? 'border-emerald-400/40 bg-emerald-500/10 text-emerald-200'
              : status === 'denegado'
                ? 'border-rose-400/40 bg-rose-500/10 text-rose-200'
                : 'border-amber-400/40 bg-amber-500/10 text-amber-200'
          }`}
        >
          {status === 'cargando'
            ? 'Comprobando…'
            : unsupported
              ? 'No disponible'
              : active
                ? 'Activas en este dispositivo'
                : status === 'denegado'
                  ? 'Permiso denegado'
                  : 'Inactivas en este dispositivo'}
        </span>
      </div>

      {unsupported ? (
        <p className="mt-4 rounded-xl border border-amber-400/40 bg-amber-500/10 p-3 text-sm text-amber-100">
          Este navegador no admite notificaciones push. En Android usa Chrome; en iPhone/iPad usa
          Safari (iOS 16.4 o superior) con NOVASTORE añadida a la pantalla de inicio.
        </p>
      ) : null}

      {isIos && !installed ? (
        <p className="mt-4 rounded-xl border border-fuchsia-400/40 bg-fuchsia-500/10 p-3 text-sm text-fuchsia-100">
          En iPhone/iPad: toca <strong>Compartir</strong> → <strong>Añadir a pantalla de inicio</strong>,
          abre NOVASTORE desde ese ícono y activa aquí las notificaciones (iOS 16.4 o superior).
        </p>
      ) : null}

      {message ? (
        <p
          className={`mt-4 rounded-xl border p-3 text-sm ${
            message.tone === 'ok'
              ? 'border-emerald-400/40 bg-emerald-500/10 text-emerald-100'
              : message.tone === 'info'
                ? 'border-purple-400/40 bg-purple-500/10 text-purple-100'
                : 'border-rose-400/40 bg-rose-500/10 text-rose-100'
          }`}
        >
          {message.text}
        </p>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        {active ? (
          <button type="button" onClick={disable} disabled={busy} className="btn btn-outline btn-sm">
            {busy ? 'Procesando…' : 'Desactivar en este dispositivo'}
          </button>
        ) : (
          <button
            type="button"
            onClick={enable}
            disabled={busy || unsupported}
            className="btn btn-primary btn-sm"
          >
            {busy ? 'Activando…' : 'Activar notificaciones'}
          </button>
        )}
        <button
          type="button"
          onClick={sendTest}
          disabled={busy || !active}
          className="btn btn-ghost btn-sm"
        >
          Enviar aviso de prueba
        </button>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
            Dispositivos autorizados
          </p>
          <p className="mt-1 text-2xl font-black text-white">{devices.length}</p>
          {devices.length === 0 ? (
            <p className="mt-1 text-sm text-slate-400">Ninguno todavía. Activa las notificaciones.</p>
          ) : (
            <ul className="mt-2 space-y-1 text-sm text-slate-300">
              {devices.map((device, index) => (
                <li key={`${device.device}-${device.createdAt}-${index}`}>
                  <span className="font-semibold text-white">{device.device}</span>
                  <span className="block text-xs text-slate-400">
                    Activado el {formatWhen(device.createdAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
            Último aviso enviado
          </p>
          <p className="mt-1 text-sm font-semibold text-white">{formatWhen(lastSentAt)}</p>
          <p className="mt-3 text-xs text-slate-400">
            Interruptor general:{' '}
            <span className="font-bold text-white">{enabled ? 'avisos habilitados' : 'avisos pausados'}</span>
          </p>
        </div>
      </div>
    </section>
  );
}
