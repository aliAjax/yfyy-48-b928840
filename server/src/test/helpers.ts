import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import db from '../database';
import { generateId, now, toJSON } from '../utils/helpers';
import { UserRole, User, Matter, Application, OperationLog, Notification } from '../types';

const JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key-for-unit-testing-2024';

export function signToken(userId: string): string {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '7d' });
}

export interface TestUser extends User {
  token: string;
}

export function createTestUser(
  username: string,
  role: UserRole,
  name?: string
): TestUser {
  const id = generateId();
  const createdAt = now();
  const hashedPassword = bcrypt.hashSync('123456', 10);
  const displayName = name || `${role}_${username}`;

  db.prepare(`
    INSERT INTO users (id, username, password, name, role, phone, id_card, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    username,
    hashedPassword,
    displayName,
    role,
    `138${Math.random().toString().slice(2, 10)}`,
    role === 'applicant' ? `110101199${Math.random().toString().slice(2, 10)}` : null,
    createdAt,
    createdAt,
  );

  const token = signToken(id);
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as any;

  return {
    id: user.id,
    username: user.username,
    password: user.password,
    name: user.name,
    role: user.role as UserRole,
    phone: user.phone,
    idCard: user.id_card,
    createdAt: user.created_at,
    updatedAt: user.updated_at,
    token,
  };
}

export function createTestMatter(
  code: string,
  name: string,
  department: string = '测试部门',
  flowConfigOverride?: any[]
): Matter {
  const id = generateId();
  const createdAt = now();

  const materials = toJSON([
    { name: '身份证复印件', required: true, description: '申请人身份证正反面复印件' },
    { name: '申请表', required: true, description: '填写完整的申请表' },
  ]);

  const flowConfig = toJSON(flowConfigOverride || [
    { step: 1, name: '窗口受理', role: 'window', description: '窗口人员受理申请', status: 'submitted' },
    { step: 2, name: '材料审核', role: 'window', description: '窗口人员审核材料', status: 'accepted' },
    { step: 3, name: '业务审核', role: 'reviewer', description: '审核人员业务审核', status: 'reviewing' },
    { step: 4, name: '办结出证', role: 'window', description: '窗口人员办结发证', status: 'approved' },
  ]);

  db.prepare(`
    INSERT INTO matters (id, code, name, department, description, required_materials, promise_days, flow_config, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    code,
    name,
    department,
    `${name}业务描述`,
    materials,
    5,
    flowConfig,
    'active',
    createdAt,
    createdAt,
  );

  const matter = db.prepare('SELECT * FROM matters WHERE id = ?').get(id) as any;
  return {
    id: matter.id,
    code: matter.code,
    name: matter.name,
    department: matter.department,
    description: matter.description || '',
    requiredMaterials: matter.required_materials || '[]',
    promiseDays: matter.promise_days,
    warningDays: matter.warning_days ?? undefined,
    excludeSupplementTime: matter.exclude_supplement_time === 1,
    flowConfig: matter.flow_config || '[]',
    status: matter.status as 'active' | 'inactive',
    createdAt: matter.created_at,
    updatedAt: matter.updated_at,
  };
}

export function getApplicationById(id: string): Application | null {
  const raw = db.prepare('SELECT * FROM applications WHERE id = ?').get(id) as any;
  if (!raw) return null;
  return {
    id: raw.id,
    applicationNo: raw.application_no,
    matterId: raw.matter_id,
    applicantId: raw.applicant_id,
    basicInfo: raw.basic_info || '{}',
    materials: raw.materials || '[]',
    status: raw.status,
    supplementReason: raw.supplement_reason,
    rejectReason: raw.reject_reason,
    reviewOpinion: raw.review_opinion,
    currentStep: raw.current_step,
    windowUserId: raw.window_user_id,
    reviewerUserId: raw.reviewer_user_id,
    submitTime: raw.submit_time,
    acceptTime: raw.accept_time,
    completeTime: raw.complete_time,
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
  };
}

export function getLogsByApplication(applicationId: string): OperationLog[] {
  const rows = db.prepare(
    'SELECT * FROM operation_logs WHERE application_id = ? ORDER BY created_at ASC'
  ).all(applicationId) as any[];
  return rows.map(raw => ({
    id: raw.id,
    applicationId: raw.application_id,
    userId: raw.user_id,
    action: raw.action,
    description: raw.description || '',
    oldStatus: raw.old_status,
    newStatus: raw.new_status,
    createdAt: raw.created_at,
  }));
}

export function getNotificationsByUser(userId: string): Notification[] {
  const rows = db.prepare(
    'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at ASC'
  ).all(userId) as any[];
  return rows.map(raw => ({
    id: raw.id,
    userId: raw.user_id,
    type: raw.type,
    title: raw.title,
    content: raw.content || undefined,
    applicationId: raw.application_id || undefined,
    isRead: raw.is_read === 1,
    createdAt: raw.created_at,
    readAt: raw.read_at || undefined,
  }));
}

export function getNotificationsByApplication(applicationId: string): Notification[] {
  const rows = db.prepare(
    'SELECT * FROM notifications WHERE application_id = ? ORDER BY created_at ASC'
  ).all(applicationId) as any[];
  return rows.map(raw => ({
    id: raw.id,
    userId: raw.user_id,
    type: raw.type,
    title: raw.title,
    content: raw.content || undefined,
    applicationId: raw.application_id || undefined,
    isRead: raw.is_read === 1,
    createdAt: raw.created_at,
    readAt: raw.read_at || undefined,
  }));
}
