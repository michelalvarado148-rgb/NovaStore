import { getDb, nowIso } from './db';

export const MAX_MESSAGE_LENGTH = 2000;

export type SupportThreadRow = {
  id: number;
  user_id: number;
  subject: string;
  status: 'abierto' | 'cerrado';
  last_message_at: string;
  last_message_by: string | null;
  admin_unread: number;
  user_unread: number;
  created_at: string;
};

export type SupportThreadWithUser = SupportThreadRow & {
  user_name: string;
  user_email: string;
};

export type SupportMessageRow = {
  id: number;
  thread_id: number;
  sender_id: number;
  sender_role: 'customer' | 'admin';
  body: string;
  created_at: string;
  read_at: string | null;
};

export type SendResult = { ok: true } | { ok: false; error: string };

const THREAD_COLS = `id, user_id, subject, status, last_message_at, last_message_by,
  admin_unread, user_unread, created_at`;

export function getThreadForUser(userId: number): SupportThreadRow | undefined {
  return getDb()
    .prepare(`SELECT ${THREAD_COLS} FROM support_threads WHERE user_id = ?`)
    .get(userId) as SupportThreadRow | undefined;
}

/** Crea la conversación del cliente si todavía no existe. */
export function ensureThread(userId: number): SupportThreadRow {
  const db = getDb();
  const existing = getThreadForUser(userId);
  if (existing) return existing;

  const now = nowIso();
  db.prepare(
    `INSERT INTO support_threads
      (user_id, subject, status, last_message_at, last_message_by, admin_unread, user_unread, created_at)
     VALUES (?, 'Consulta de soporte', 'abierto', ?, 'customer', 0, 0, ?)`,
  ).run(userId, now, now);

  return getThreadForUser(userId)!;
}

export function getMessages(threadId: number, limit = 200): SupportMessageRow[] {
  const rows = getDb()
    .prepare(
      `SELECT id, thread_id, sender_id, sender_role, body, created_at, read_at
         FROM support_messages WHERE thread_id = ?
        ORDER BY id DESC LIMIT ?`,
    )
    .all(threadId, limit) as SupportMessageRow[];
  return rows.reverse();
}

export function sendCustomerMessage(userId: number, body: string): SendResult {
  const text = body.trim();
  if (text.length === 0) return { ok: false, error: 'Escribe tu mensaje antes de enviarlo.' };
  if (text.length > MAX_MESSAGE_LENGTH) {
    return { ok: false, error: `El mensaje no puede superar ${MAX_MESSAGE_LENGTH} caracteres.` };
  }

  const db = getDb();
  const thread = ensureThread(userId);
  const now = nowIso();

  db.transaction(() => {
    db.prepare(
      `INSERT INTO support_messages (thread_id, sender_id, sender_role, body, created_at)
       VALUES (?, ?, 'customer', ?, ?)`,
    ).run(thread.id, userId, text, now);
    db.prepare(
      `UPDATE support_threads
          SET last_message_at = ?, last_message_by = 'customer', admin_unread = admin_unread + 1,
              status = 'abierto'
        WHERE id = ?`,
    ).run(now, thread.id);
  })();

  return { ok: true };
}

export function sendAdminMessage(adminId: number, threadId: number, body: string): SendResult {
  const text = body.trim();
  if (text.length === 0) return { ok: false, error: 'Escribe una respuesta antes de enviarla.' };
  if (text.length > MAX_MESSAGE_LENGTH) {
    return { ok: false, error: `El mensaje no puede superar ${MAX_MESSAGE_LENGTH} caracteres.` };
  }

  const db = getDb();
  const thread = db
    .prepare('SELECT id FROM support_threads WHERE id = ?')
    .get(threadId) as { id: number } | undefined;
  if (!thread) return { ok: false, error: 'Conversación no encontrada.' };

  const now = nowIso();
  db.transaction(() => {
    db.prepare(
      `INSERT INTO support_messages (thread_id, sender_id, sender_role, body, created_at)
       VALUES (?, ?, 'admin', ?, ?)`,
    ).run(thread.id, adminId, text, now);
    db.prepare(
      `UPDATE support_threads
          SET last_message_at = ?, last_message_by = 'admin', user_unread = user_unread + 1
        WHERE id = ?`,
    ).run(now, thread.id);
  })();

  return { ok: true };
}

export function listThreads(): SupportThreadWithUser[] {
  return getDb()
    .prepare(
      `SELECT t.id, t.user_id, t.subject, t.status, t.last_message_at, t.last_message_by,
              t.admin_unread, t.user_unread, t.created_at,
              u.name AS user_name, u.email AS user_email
         FROM support_threads t
         JOIN users u ON u.id = t.user_id
        ORDER BY t.last_message_at DESC
        LIMIT 200`,
    )
    .all() as SupportThreadWithUser[];
}

export function getThreadById(threadId: number): SupportThreadWithUser | undefined {
  return getDb()
    .prepare(
      `SELECT t.id, t.user_id, t.subject, t.status, t.last_message_at, t.last_message_by,
              t.admin_unread, t.user_unread, t.created_at,
              u.name AS user_name, u.email AS user_email
         FROM support_threads t
         JOIN users u ON u.id = t.user_id
        WHERE t.id = ?`,
    )
    .get(threadId) as SupportThreadWithUser | undefined;
}

export function markThreadRead(threadId: number, role: 'customer' | 'admin'): void {
  const column = role === 'admin' ? 'admin_unread' : 'user_unread';
  getDb()
    .prepare(`UPDATE support_threads SET ${column} = 0 WHERE id = ?`)
    .run(threadId);
  if (role === 'customer') {
    getDb()
      .prepare(
        "UPDATE support_messages SET read_at = ? WHERE thread_id = ? AND sender_role = 'admin' AND read_at IS NULL",
      )
      .run(nowIso(), threadId);
  }
}

export function countUnreadForUser(userId: number): number {
  const row = getDb()
    .prepare('SELECT user_unread AS total FROM support_threads WHERE user_id = ?')
    .get(userId) as { total: number } | undefined;
  return row?.total ?? 0;
}

export function countUnreadForAdmin(): number {
  const row = getDb()
    .prepare('SELECT COALESCE(SUM(admin_unread), 0) AS total FROM support_threads')
    .get() as { total: number };
  return row.total ?? 0;
}
