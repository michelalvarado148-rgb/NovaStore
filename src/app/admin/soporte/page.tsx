import type { Metadata } from 'next';
import Link from 'next/link';
import { requireAdmin } from '@/lib/auth';
import { formatDateTime } from '@/lib/format';
import {
  MAX_MESSAGE_LENGTH,
  countUnreadForAdmin,
  getMessages,
  getThreadById,
  listThreads,
  markThreadRead,
} from '@/lib/support';
import { adminSupportReplyAction } from '@/app/actions/support';
import AutoRefresh from '@/components/AutoRefresh';
import { Card, EmptyState, PageHeader } from '@/components/ui';

export const metadata: Metadata = { title: 'Soporte | Panel NOVASTORE' };
export const dynamic = 'force-dynamic';

export default async function AdminSupportPage({
  searchParams,
}: {
  searchParams: Promise<{ thread?: string; ok?: string; error?: string }>;
}) {
  await requireAdmin('/admin/soporte');
  const sp = await searchParams;

  const threads = listThreads();
  const requested = Number(sp.thread ?? 0);
  const selectedId = Number.isInteger(requested) && requested > 0 ? requested : threads[0]?.id ?? 0;
  const thread = selectedId ? getThreadById(selectedId) : undefined;
  const messages = thread ? getMessages(thread.id) : [];
  if (thread) markThreadRead(thread.id, 'admin');

  const unread = countUnreadForAdmin();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Soporte"
        description={`Conversaciones privadas con los clientes. ${unread > 0 ? `${unread} mensaje(s) sin leer.` : 'Todo leído.'}`}
      />

      {sp.error ? (
        <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {sp.error}
        </p>
      ) : null}

      <AutoRefresh intervalMs={12000} />

      <div className="grid gap-4 lg:grid-cols-[20rem_1fr]">
        <Card>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">
            Clientes ({threads.length})
          </h2>
          {threads.length === 0 ? (
            <EmptyState title="Sin conversaciones" description="Los mensajes de los clientes aparecerán aquí." />
          ) : (
            <ul className="space-y-1.5">
              {threads.map((t) => {
                const active = t.id === selectedId;
                return (
                  <li key={t.id}>
                    <Link
                      href={`/admin/soporte?thread=${t.id}`}
                      className={`block rounded-xl px-3 py-2 transition ${
                        active
                          ? 'border border-fuchsia-500/40 bg-fuchsia-500/10'
                          : 'border border-transparent hover:bg-purple-500/10'
                      }`}
                    >
                      <span className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-semibold text-white">{t.user_name}</span>
                        {t.admin_unread > 0 ? (
                          <span className="grid h-5 min-w-5 place-items-center rounded-full bg-fuchsia-500 px-1 text-[0.65rem] font-bold text-white">
                            {t.admin_unread}
                          </span>
                        ) : null}
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-slate-400">{t.user_email}</span>
                      <span className="mt-0.5 block text-[0.65rem] text-slate-500">
                        {formatDateTime(t.last_message_at)}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card>
          {thread ? (
            <div id="conversacion" className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-purple-500/15 pb-3">
                <div>
                  <h2 className="text-lg font-semibold text-white">{thread.user_name}</h2>
                  <p className="text-xs text-slate-400">{thread.user_email}</p>
                </div>
                <Link href={`/admin/clientes?q=${encodeURIComponent(thread.user_email)}`} className="btn btn-ghost text-xs">
                  Ver cliente
                </Link>
              </div>

              {messages.length === 0 ? (
                <EmptyState title="Sin mensajes" description="Escribe la primera respuesta a este cliente." />
              ) : (
                <ul className="space-y-3">
                  {messages.map((m) => {
                    const mine = m.sender_role === 'admin';
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
                            {mine ? 'Administrador' : thread.user_name} · {formatDateTime(m.created_at)}
                          </p>
                          <p className="whitespace-pre-wrap break-words">{m.body}</p>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}

              <form action={adminSupportReplyAction} className="space-y-3 border-t border-purple-500/15 pt-4">
                <input type="hidden" name="thread_id" value={thread.id} />
                <label className="block text-sm text-slate-300">
                  Responder
                  <textarea
                    name="body"
                    rows={3}
                    required
                    maxLength={MAX_MESSAGE_LENGTH}
                    placeholder="Escribe la respuesta al cliente…"
                    className="input mt-1.5 w-full resize-y"
                  />
                </label>
                <button type="submit" className="btn btn-primary w-full sm:w-auto">
                  Enviar respuesta
                </button>
              </form>
            </div>
          ) : (
            <EmptyState
              title="Selecciona una conversación"
              description="Elige un cliente de la lista para ver y responder sus mensajes."
            />
          )}
        </Card>
      </div>
    </div>
  );
}
