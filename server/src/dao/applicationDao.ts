import db from '../database';
import { Application, ApplicationStatus } from '../types';
import { generateId, now, generateApplicationNo } from '../utils/helpers';

interface RawApplication {
  id: string;
  application_no: string;
  matter_id: string;
  applicant_id: string;
  basic_info?: string;
  materials?: string;
  status: string;
  supplement_reason?: string;
  reject_reason?: string;
  review_opinion?: string;
  current_step?: string;
  window_user_id?: string;
  reviewer_user_id?: string;
  submit_time?: string;
  accept_time?: string;
  complete_time?: string;
  created_at: string;
  updated_at: string;
}

function mapApplication(raw: RawApplication): Application {
  return {
    id: raw.id,
    applicationNo: raw.application_no,
    matterId: raw.matter_id,
    applicantId: raw.applicant_id,
    basicInfo: raw.basic_info || '{}',
    materials: raw.materials || '[]',
    status: raw.status as ApplicationStatus,
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

export function findApplicationById(id: string): Application | null {
  const raw = db.prepare('SELECT * FROM applications WHERE id = ?').get(id) as RawApplication | undefined;
  return raw ? mapApplication(raw) : null;
}

export function findApplicationByNo(applicationNo: string): Application | null {
  const raw = db.prepare('SELECT * FROM applications WHERE application_no = ?').get(applicationNo) as RawApplication | undefined;
  return raw ? mapApplication(raw) : null;
}

export function listApplications(params?: {
  applicantId?: string;
  matterId?: string;
  status?: ApplicationStatus;
  keyword?: string;
  page?: number;
  pageSize?: number;
}): { applications: Application[]; total: number } {
  const whereClauses: string[] = [];
  const paramsArr: any[] = [];

  if (params?.applicantId) {
    whereClauses.push('applicant_id = ?');
    paramsArr.push(params.applicantId);
  }
  if (params?.matterId) {
    whereClauses.push('matter_id = ?');
    paramsArr.push(params.matterId);
  }
  if (params?.status) {
    whereClauses.push('status = ?');
    paramsArr.push(params.status);
  }
  if (params?.keyword) {
    whereClauses.push('application_no LIKE ?');
    paramsArr.push(`%${params.keyword}%`);
  }

  const whereStr = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  const totalRow = db.prepare(`SELECT COUNT(*) as count FROM applications ${whereStr}`).get(...paramsArr) as { count: number };
  const total = totalRow.count;

  let sql = `SELECT * FROM applications ${whereStr} ORDER BY created_at DESC`;
  if (params?.page && params?.pageSize) {
    sql += ' LIMIT ? OFFSET ?';
    paramsArr.push(params.pageSize, (params.page - 1) * params.pageSize);
  }

  const rows = db.prepare(sql).all(...paramsArr) as RawApplication[];
  return { applications: rows.map(mapApplication), total };
}

export function createApplication(data: {
  matterId: string;
  applicantId: string;
  basicInfo?: string;
  materials?: string;
  status?: ApplicationStatus;
  currentStep?: string;
}): Application {
  const id = generateId();
  const createdAt = now();
  const applicationNo = generateApplicationNo();

  db.prepare(`
    INSERT INTO applications (id, application_no, matter_id, applicant_id, basic_info, materials, status, current_step, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    applicationNo,
    data.matterId,
    data.applicantId,
    data.basicInfo || '{}',
    data.materials || '[]',
    data.status || 'draft',
    data.currentStep || null,
    createdAt,
    createdAt,
  );

  return findApplicationById(id)!;
}

export function updateApplication(id: string, data: Partial<{
  basicInfo: string;
  materials: string;
  status: ApplicationStatus;
  supplementReason: string;
  rejectReason: string;
  reviewOpinion: string;
  currentStep: string;
  windowUserId: string;
  reviewerUserId: string;
  submitTime: string;
  acceptTime: string;
  completeTime: string;
}>): Application | null {
  const app = findApplicationById(id);
  if (!app) return null;

  const updates: string[] = [];
  const values: any[] = [];

  const keyMap: Record<string, string> = {
    basicInfo: 'basic_info',
    materials: 'materials',
    status: 'status',
    supplementReason: 'supplement_reason',
    rejectReason: 'reject_reason',
    reviewOpinion: 'review_opinion',
    currentStep: 'current_step',
    windowUserId: 'window_user_id',
    reviewerUserId: 'reviewer_user_id',
    submitTime: 'submit_time',
    acceptTime: 'accept_time',
    completeTime: 'complete_time',
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

  db.prepare(`UPDATE applications SET ${updates.join(', ')} WHERE id = ?`).run(...values);
  return findApplicationById(id);
}

export function deleteApplication(id: string): boolean {
  const result = db.prepare('DELETE FROM applications WHERE id = ?').run(id);
  return result.changes > 0;
}
