import db from '../database';
import { Notification, NotificationType } from '../types';
import { generateId, now } from '../utils/helpers';

interface RawNotification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  content?: string;
  application_id?: string;
  is_read: number;
  created_at: string;
  read_at?: string;
}

function mapNotification(raw: RawNotification): Notification {
  return {
    id: raw.id,
    userId: raw.user_id,
    type: raw.type as NotificationType,
    title: raw.title,
    content: raw.content || undefined,
    applicationId: raw.application_id || undefined,
    isRead: raw.is_read === 1,
    createdAt: raw.created_at,
    readAt: raw.read_at || undefined,
  };
}

export function createNotification(data: {
  userId: string;
  type: NotificationType;
  title: string;
  content?: string;
  applicationId?: string;
}): Notification {
  const id = generateId();
  const createdAt = now();

  db.prepare(`
    INSERT INTO notifications (id, user_id, type, title, content, application_id, is_read, created_at)
    VALUES (?, ?, ?, ?, ?, ?, 0, ?)
  `).run(
    id,
    data.userId,
    data.type,
    data.title,
    data.content || null,
    data.applicationId || null,
    createdAt,
  );

  const raw = db.prepare('SELECT * FROM notifications WHERE id = ?').get(id) as RawNotification;
  return mapNotification(raw);
}

export function getUnreadCount(userId: string): number {
  const row = db.prepare(
    'SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0'
  ).get(userId) as { count: number };
  return row.count;
}

export function listNotifications(params: {
  userId: string;
  isRead?: boolean;
  types?: string[];
  page?: number;
  pageSize?: number;
}): { notifications: Notification[]; total: number } {
  const whereClauses: string[] = ['user_id = ?'];
  const paramsArr: any[] = [params.userId];

  if (params.isRead !== undefined) {
    whereClauses.push('is_read = ?');
    paramsArr.push(params.isRead ? 1 : 0);
  }

  if (params.types && params.types.length > 0) {
    const placeholders = params.types.map(() => '?').join(', ');
    whereClauses.push(`type IN (${placeholders})`);
    paramsArr.push(...params.types);
  }

  const whereStr = whereClauses.join(' AND ');

  const totalRow = db.prepare(`SELECT COUNT(*) as count FROM notifications WHERE ${whereStr}`).get(...paramsArr) as { count: number };
  const total = totalRow.count;

  let sql = `SELECT * FROM notifications WHERE ${whereStr} ORDER BY created_at DESC`;
  if (params.page && params.pageSize) {
    sql += ' LIMIT ? OFFSET ?';
    paramsArr.push(params.pageSize, (params.page - 1) * params.pageSize);
  }

  const rows = db.prepare(sql).all(...paramsArr) as RawNotification[];
  return { notifications: rows.map(mapNotification), total };
}

export function markAsRead(id: string, userId: string): boolean {
  const result = db.prepare(
    'UPDATE notifications SET is_read = 1, read_at = ? WHERE id = ? AND user_id = ?'
  ).run(now(), id, userId);
  return result.changes > 0;
}

export function markAllAsRead(userId: string, types?: string[]): number {
  const whereClauses: string[] = ['user_id = ?', 'is_read = 0'];
  const paramsArr: any[] = [userId];

  if (types && types.length > 0) {
    const placeholders = types.map(() => '?').join(', ');
    whereClauses.push(`type IN (${placeholders})`);
    paramsArr.push(...types);
  }

  const whereStr = whereClauses.join(' AND ');
  const result = db.prepare(
    `UPDATE notifications SET is_read = 1, read_at = ? WHERE ${whereStr}`
  ).run(now(), ...paramsArr);
  return result.changes;
}
