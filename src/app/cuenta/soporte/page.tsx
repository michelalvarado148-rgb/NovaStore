import type { Metadata } from 'next';
import { requireUser } from '@/lib/auth';
import { formatDateTime } from '@/lib/format';
import {
  MAX_MESSAGE_LENGTH,
  getMessages,
  getThreadForUser,
  markThreadRead,
} from '@/lib/support';
import { sendSupportMessageAction } from '@/app/actions/support';
import AutoRefresh from '@/components/AutoRefresh';
import { Card, EmptyState, PageHeader } from '@/components/ui';

export const metadata: Metadata = { title: 'Soporte | NOVASTORE' };
export const dynamic = 'force-dynamic';

export default async function SupportPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const user = await requireUser('/cuenta/soporte');
  const sp = await searchParams;

  const thread = getThreadForUser(user.id);
  const messages = thread ? getMessages(thread.id) : [];
  if (thread) markThreadRead(thread.id, 'customer');

  return (
    <div className="space-y-6">
      <PageHeader
        title="Soporte"
        description="Conversación privada con el administrador de NOVASTORE. Solo tú y el administrador pueden leer estos mensajes."
      />

      {sp.ok ? (
        <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
          {sp.ok}
        </p>
      ) : null}
      {sp.error ? (
        <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {sp.error}
        </p>
      ) : null}

      <AutoRefresh intervalMs={10000} />

      <Card>
        <div id="conversacion" className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold text-white">Tu conversación</h2>
            <span className="badge badge-info">Privada</span>
          </div>

          {messages.length === 0 ? (
            <EmptyState
              title="Aún no hay mensajes"
              description="Escribe tu primera consulta y el administrador te responderá por este mismo chat."
            />
          ) : (
            <ul className="space-y-3">
              {messages.map((m) => {
                const mine = m.sender_role === 'customer';
                return (
                  <li key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm sm:max-w-[75%] ${
                        mine
                          ? 'bg-fuchsia-600/90 text-white'
                          : 'border border-purple-500/20 bg-slate-900/80 text-slate-200'
                      }`}
                    >
                      <p className="mb-1 text-[0.65rem] uppercase tracking-wide opacity-70">
                        {mine ? 'Tú' : 'Administrador'} · {formatDateTime(m.created_at)}
                      </p>
                      <p className="whitespace-pre-wrap break-words">{m.body}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          <form action={sendSupportMessageAction} className="space-y-3 border-t border-purple-500/15 pt-4">
            <label className="block text-sm text-slate-300">
              Escribe tu mensaje
              <textarea
                name="body"
                rows={3}
                required
                maxLength={MAX_MESSAGE_LENGTH}
                placeholder="Hola, necesito ayuda con mi pedido…"
                className="input mt-1.5 w-full resize-y"
              />
            </label>
            <button type="submit" className="btn btn-primary w-full sm:w-auto">
              Enviar mensaje
            </button>
          </form>
        </div>
      </Card>
    </div>
  );
}
