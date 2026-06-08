import db from '../database';
import { User, UserRole } from '../types';
import { generateId, now } from '../utils/helpers';
import bcrypt from 'bcryptjs';

interface RawUser {
  id: string;
  username: string;
  password: string;
  name: string;
  role: string;
  phone?: string;
  id_card?: string;
  created_at: string;
  updated_at: string;
}

function mapUser(raw: RawUser): User {
  return {
    id: raw.id,
    username: raw.username,
    password: raw.password,
    name: raw.name,
    role: raw.role as UserRole,
    phone: raw.phone,
    idCard: raw.id_card,
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
  };
}

export function findUserByUsername(username: string): User | null {
  const raw = db.prepare('SELECT * FROM users WHERE username = ?').get(username) as RawUser | undefined;
  return raw ? mapUser(raw) : null;
}

export function findUserById(id: string): User | null {
  const raw = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as RawUser | undefined;
  return raw ? mapUser(raw) : null;
}

export function createUser(data: {
  username: string;
  password: string;
  name: string;
  role: UserRole;
  phone?: string;
  idCard?: string;
}): User {
  const id = generateId();
  const createdAt = now();
  const hashedPassword = bcrypt.hashSync(data.password, 10);
  
  db.prepare(`
    INSERT INTO users (id, username, password, name, role, phone, id_card, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    data.username,
    hashedPassword,
    data.name,
    data.role,
    data.phone || null,
    data.idCard || null,
    createdAt,
    createdAt,
  );

  return findUserById(id)!;
}

export function listUsers(params?: { role?: UserRole; page?: number; pageSize?: number }): { users: User[]; total: number } {
  let whereClause = '';
  const paramsArr: any[] = [];

  if (params?.role) {
    whereClause = 'WHERE role = ?';
    paramsArr.push(params.role);
  }

  const totalRow = db.prepare(`SELECT COUNT(*) as count FROM users ${whereClause}`).get(...paramsArr) as { count: number };
  const total = totalRow.count;

  let sql = `SELECT * FROM users ${whereClause} ORDER BY created_at DESC`;
  if (params?.page && params?.pageSize) {
    sql += ' LIMIT ? OFFSET ?';
    paramsArr.push(params.pageSize, (params.page - 1) * params.pageSize);
  }

  const rows = db.prepare(sql).all(...paramsArr) as RawUser[];
  return { users: rows.map(mapUser), total };
}

export function updateUser(id: string, data: Partial<{ name: string; phone: string; idCard: string; role: UserRole }>): User | null {
  const user = findUserById(id);
  if (!user) return null;

  const updates: string[] = [];
  const values: any[] = [];

  if (data.name !== undefined) {
    updates.push('name = ?');
    values.push(data.name);
  }
  if (data.phone !== undefined) {
    updates.push('phone = ?');
    values.push(data.phone);
  }
  if (data.idCard !== undefined) {
    updates.push('id_card = ?');
    values.push(data.idCard);
  }
  if (data.role !== undefined) {
    updates.push('role = ?');
    values.push(data.role);
  }
  updates.push('updated_at = ?');
  values.push(now());

  values.push(id);

  db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...values);
  return findUserById(id);
}

export function deleteUser(id: string): boolean {
  const result = db.prepare('DELETE FROM users WHERE id = ?').run(id);
  return result.changes > 0;
}

export function verifyPassword(user: User, password: string): boolean {
  return bcrypt.compareSync(password, user.password);
}
