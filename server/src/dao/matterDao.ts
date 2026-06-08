import db from '../database';
import { Matter } from '../types';
import { generateId, now } from '../utils/helpers';

interface RawMatter {
  id: string;
  code: string;
  name: string;
  department: string;
  description?: string;
  required_materials?: string;
  promise_days: number;
  flow_config?: string;
  status: string;
  created_at: string;
  updated_at: string;
}

function mapMatter(raw: RawMatter): Matter {
  return {
    id: raw.id,
    code: raw.code,
    name: raw.name,
    department: raw.department,
    description: raw.description || '',
    requiredMaterials: raw.required_materials || '[]',
    promiseDays: raw.promise_days,
    flowConfig: raw.flow_config || '[]',
    status: raw.status as 'active' | 'inactive',
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
  };
}

export function findMatterById(id: string): Matter | null {
  const raw = db.prepare('SELECT * FROM matters WHERE id = ?').get(id) as RawMatter | undefined;
  return raw ? mapMatter(raw) : null;
}

export function findMatterByCode(code: string): Matter | null {
  const raw = db.prepare('SELECT * FROM matters WHERE code = ?').get(code) as RawMatter | undefined;
  return raw ? mapMatter(raw) : null;
}

export function listMatters(params?: {
  status?: string;
  keyword?: string;
  department?: string;
  page?: number;
  pageSize?: number;
}): { matters: Matter[]; total: number } {
  const whereClauses: string[] = [];
  const paramsArr: any[] = [];

  if (params?.status) {
    whereClauses.push('status = ?');
    paramsArr.push(params.status);
  }
  if (params?.department) {
    whereClauses.push('department = ?');
    paramsArr.push(params.department);
  }
  if (params?.keyword) {
    whereClauses.push('(name LIKE ? OR code LIKE ? OR department LIKE ?)');
    const keyword = `%${params.keyword}%`;
    paramsArr.push(keyword, keyword, keyword);
  }

  const whereStr = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  const totalRow = db.prepare(`SELECT COUNT(*) as count FROM matters ${whereStr}`).get(...paramsArr) as { count: number };
  const total = totalRow.count;

  let sql = `SELECT * FROM matters ${whereStr} ORDER BY created_at DESC`;
  if (params?.page && params?.pageSize) {
    sql += ' LIMIT ? OFFSET ?';
    paramsArr.push(params.pageSize, (params.page - 1) * params.pageSize);
  }

  const rows = db.prepare(sql).all(...paramsArr) as RawMatter[];
  return { matters: rows.map(mapMatter), total };
}

export function createMatter(data: {
  code: string;
  name: string;
  department: string;
  description?: string;
  requiredMaterials?: string;
  promiseDays: number;
  flowConfig?: string;
  status?: string;
}): Matter {
  const id = generateId();
  const createdAt = now();

  db.prepare(`
    INSERT INTO matters (id, code, name, department, description, required_materials, promise_days, flow_config, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    data.code,
    data.name,
    data.department,
    data.description || null,
    data.requiredMaterials || '[]',
    data.promiseDays,
    data.flowConfig || '[]',
    data.status || 'active',
    createdAt,
    createdAt,
  );

  return findMatterById(id)!;
}

export function updateMatter(id: string, data: Partial<{
  code: string;
  name: string;
  department: string;
  description: string;
  requiredMaterials: string;
  promiseDays: number;
  flowConfig: string;
  status: string;
}>): Matter | null {
  const matter = findMatterById(id);
  if (!matter) return null;

  const updates: string[] = [];
  const values: any[] = [];

  if (data.code !== undefined) { updates.push('code = ?'); values.push(data.code); }
  if (data.name !== undefined) { updates.push('name = ?'); values.push(data.name); }
  if (data.department !== undefined) { updates.push('department = ?'); values.push(data.department); }
  if (data.description !== undefined) { updates.push('description = ?'); values.push(data.description); }
  if (data.requiredMaterials !== undefined) { updates.push('required_materials = ?'); values.push(data.requiredMaterials); }
  if (data.promiseDays !== undefined) { updates.push('promise_days = ?'); values.push(data.promiseDays); }
  if (data.flowConfig !== undefined) { updates.push('flow_config = ?'); values.push(data.flowConfig); }
  if (data.status !== undefined) { updates.push('status = ?'); values.push(data.status); }
  
  updates.push('updated_at = ?');
  values.push(now());
  values.push(id);

  db.prepare(`UPDATE matters SET ${updates.join(', ')} WHERE id = ?`).run(...values);
  return findMatterById(id);
}

export function deleteMatter(id: string): boolean {
  const result = db.prepare('DELETE FROM matters WHERE id = ?').run(id);
  return result.changes > 0;
}

export function listDepartments(): string[] {
  const rows = db.prepare('SELECT DISTINCT department FROM matters WHERE status = ? ORDER BY department').all('active') as { department: string }[];
  return rows.map(row => row.department);
}
