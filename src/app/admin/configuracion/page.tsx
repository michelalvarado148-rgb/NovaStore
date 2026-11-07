import { getSettings } from '@/lib/catalog';
import { saveSettingsAction } from '@/app/actions/admin';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Configuración de la tienda' };

export default async function AdminSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const params = await searchParams;
  const settings = getSettings();

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-black text-white">Configuración general</h1>

      {params.ok ? <p className="alert alert-ok">{params.ok}</p> : null}
      {params.error ? <p className="alert alert-error">{params.error}</p> : null}

      <form action={saveSettingsAction} className="panel grid gap-3 p-5 md:grid-cols-2">
        <label className="field">
          <span>Nombre de la tienda</span>
          <input name="store_name" defaultValue={settings.store_name ?? 'NOVASTORE'} />
        </label>
        <label className="field">
          <span>Frase corta</span>
          <input name="store_tagline" defaultValue={settings.store_tagline ?? ''} />
        </label>
        <label className="field md:col-span-2">
          <span>Descripción de la tienda</span>
          <textarea name="store_description" rows={2} defaultValue={settings.store_description ?? ''} />
        </label>
        <label className="field md:col-span-2">
          <span>Enlace del canal de Telegram</span>
          <input
            name="telegram_url"
            defaultValue={settings.telegram_url ?? ''}
            placeholder="https://t.me/tu_canal"
          />
        </label>
        <label className="field">
          <span>Correo de contacto</span>
          <input name="contact_email" defaultValue={settings.contact_email ?? ''} type="email" />
        </label>
        <label className="field">
          <span>Teléfono / WhatsApp de soporte</span>
          <input name="contact_phone" defaultValue={settings.contact_phone ?? ''} />
        </label>
        <label className="field">
          <span>Horario de atención</span>
          <input name="support_hours" defaultValue={settings.support_hours ?? ''} />
        </label>
        <label className="field">
          <span>Prefijo de número de pedido</span>
          <input name="order_prefix" defaultValue={settings.order_prefix ?? 'NV'} maxLength={6} />
        </label>
        <label className="field md:col-span-2">
          <span>Título del banner principal</span>
          <input name="hero_title" defaultValue={settings.hero_title ?? ''} />
        </label>
        <label className="field md:col-span-2">
          <span>Subtítulo del banner</span>
          <input name="hero_subtitle" defaultValue={settings.hero_subtitle ?? ''} />
        </label>
        <label className="field md:col-span-2">
          <span>Aviso superior (vacío para ocultar)</span>
          <input name="announcement" defaultValue={settings.announcement ?? ''} />
        </label>

        <div className="md:col-span-2">
          <button type="submit" className="btn btn-primary">Guardar configuración</button>
        </div>
      </form>
    </div>
  );
}
