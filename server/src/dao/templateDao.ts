import db from '../database';
import { ApplicationTemplate } from '../types';
import { generateId, now } from '../utils/helpers';

interface RawTemplate {
  id: string;
  name: string;
  matter_id: string;
  user_id: string;
  basic_info?: string;
  materials?: string;
  created_at: string;
  updated_at: string;
}

function mapTemplate(raw: RawTemplate): ApplicationTemplate {
  return {
    id: raw.id,
    name: raw.name,
    matterId: raw.matter_id,
    userId: raw.user_id,
    basicInfo: raw.basic_info || '{}',
    materials: raw.materials || '[]',
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
  };
}

export function findTemplateById(id: string): ApplicationTemplate | null {
  const raw = db.prepare('SELECT * FROM application_templates WHERE id = ?').get(id) as RawTemplate | undefined;
  return raw ? mapTemplate(raw) : null;
}

export function listTemplates(params?: {
  userId?: string;
  matterId?: string;
  keyword?: string;
  page?: number;
  pageSize?: number;
}): { templates: ApplicationTemplate[]; total: number } {
  const whereClauses: string[] = [];
  const paramsArr: any[] = [];

  if (params?.userId) {
    whereClauses.push('user_id = ?');
    paramsArr.push(params.userId);
  }
  if (params?.matterId) {
    whereClauses.push('matter_id = ?');
    paramsArr.push(params.matterId);
  }
  if (params?.keyword) {
    whereClauses.push('name LIKE ?');
    paramsArr.push(`%${params.keyword}%`);
  }

  const whereStr = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  const totalRow = db.prepare(`SELECT COUNT(*) as count FROM application_templates ${whereStr}`).get(...paramsArr) as { count: number };
  const total = totalRow.count;

  let sql = `SELECT * FROM application_templates ${whereStr} ORDER BY created_at DESC`;
  if (params?.page && params?.pageSize) {
    sql += ' LIMIT ? OFFSET ?';
    paramsArr.push(params.pageSize, (params.page - 1) * params.pageSize);
  }

  const rows = db.prepare(sql).all(...paramsArr) as RawTemplate[];
  return { templates: rows.map(mapTemplate), total };
}

export function createTemplate(data: {
  name: string;
  matterId: string;
  userId: string;
  basicInfo?: string;
  materials?: string;
}): ApplicationTemplate {
  const id = generateId();
  const createdAt = now();

  db.prepare(`
    INSERT INTO application_templates (id, name, matter_id, user_id, basic_info, materials, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    data.name,
    data.matterId,
    data.userId,
    data.basicInfo || '{}',
    data.materials || '[]',
    createdAt,
    createdAt,
  );

  return findTemplateById(id)!;
}

export function updateTemplate(id: string, data: Partial<{
  name: string;
  basicInfo: string;
  materials: string;
}>): ApplicationTemplate | null {
  const template = findTemplateById(id);
  if (!template) return null;

  const updates: string[] = [];
  const values: any[] = [];

  const keyMap: Record<string, string> = {
    name: 'name',
    basicInfo: 'basic_info',
    materials: 'materials',
  };

  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined && keyMap[key]) {
      updates.push(`${keyMap[key]} = ?`);
      values.push(value);
    }
  }

  updates.push('updated_at = ?');
  values.push(now());
  values.push(id);

  db.prepare(`UPDATE application_templates SET ${updates.join(', ')} WHERE id = ?`).run(...values);
  return findTemplateById(id);
}

export function deleteTemplate(id: string): boolean {
  const result = db.prepare('DELETE FROM application_templates WHERE id = ?').run(id);
  return result.changes > 0;
}
