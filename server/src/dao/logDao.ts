import db from '../database';
import { OperationLog } from '../types';
import { generateId, now } from '../utils/helpers';

interface RawLog {
  id: string;
  application_id: string;
  user_id: string;
  action: string;
  description?: string;
  old_status?: string;
  new_status?: string;
  created_at: string;
}

function mapLog(raw: RawLog): OperationLog {
  return {
    id: raw.id,
    applicationId: raw.application_id,
    userId: raw.user_id,
    action: raw.action,
    description: raw.description || '',
    oldStatus: raw.old_status,
    newStatus: raw.new_status,
    createdAt: raw.created_at,
  };
}

export function createLog(data: {
  applicationId: string;
  userId: string;
  action: string;
  description?: string;
  oldStatus?: string;
  newStatus?: string;
}): OperationLog {
  const id = generateId();
  const createdAt = now();

  db.prepare(`
    INSERT INTO operation_logs (id, application_id, user_id, action, description, old_status, new_status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    data.applicationId,
    data.userId,
    data.action,
    data.description || null,
    data.oldStatus || null,
    data.newStatus || null,
    createdAt,
  );

  const raw = db.prepare('SELECT * FROM operation_logs WHERE id = ?').get(id) as RawLog;
  return mapLog(raw);
}

export function listLogsByApplication(applicationId: string): OperationLog[] {
  const rows = db.prepare(
    'SELECT l.*, u.name as user_name FROM operation_logs l LEFT JOIN users u ON l.user_id = u.id WHERE l.application_id = ? ORDER BY l.created_at ASC'
  ).all(applicationId) as (RawLog & { user_name?: string })[];
  
  return rows.map(raw => ({
    ...mapLog(raw),
    userName: raw.user_name,
  }));
}

export function listLogs(params?: {
  userId?: string;
  applicationId?: string;
  page?: number;
  pageSize?: number;
}): { logs: OperationLog[]; total: number } {
  const whereClauses: string[] = [];
  const paramsArr: any[] = [];

  if (params?.userId) {
    whereClauses.push('l.user_id = ?');
    paramsArr.push(params.userId);
  }
  if (params?.applicationId) {
    whereClauses.push('l.application_id = ?');
    paramsArr.push(params.applicationId);
  }

  const whereStr = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  const totalRow = db.prepare(`SELECT COUNT(*) as count FROM operation_logs l ${whereStr}`).get(...paramsArr) as { count: number };
  const total = totalRow.count;

  let sql = `SELECT l.*, u.name as user_name FROM operation_logs l LEFT JOIN users u ON l.user_id = u.id ${whereStr} ORDER BY l.created_at DESC`;
  if (params?.page && params?.pageSize) {
    sql += ' LIMIT ? OFFSET ?';
    paramsArr.push(params.pageSize, (params.page - 1) * params.pageSize);
  }

  const rows = db.prepare(sql).all(...paramsArr) as (RawLog & { user_name?: string })[];
  const logs = rows.map(raw => ({
    ...mapLog(raw),
    userName: raw.user_name,
  }));

  return { logs, total };
}
