import { ApplicationStatus, User, UserRole } from '../types';

export const statusLabels: Record<ApplicationStatus, string> = {
  draft: '草稿',
  submitted: '待受理',
  accepted: '已受理',
  supplement: '待补正',
  reviewing: '审核中',
  approved: '审核通过',
  rejected: '已退回',
  completed: '已办结',
};

export const statusColors: Record<ApplicationStatus, string> = {
  draft: 'default',
  submitted: 'processing',
  accepted: 'processing',
  supplement: 'warning',
  reviewing: 'processing',
  approved: 'success',
  rejected: 'error',
  completed: 'success',
};

export const roleLabels: Record<UserRole, string> = {
  applicant: '申请人',
  window: '窗口人员',
  reviewer: '审核人员',
  admin: '管理员',
};

export const actionLabels: Record<string, string> = {
  create: '创建申请',
  update: '修改申请',
  submit: '提交申请',
  accept: '受理申请',
  supplement: '要求补正',
  reject: '退回申请',
  send_review: '送审',
  review: '审核',
  complete: '办结',
};

export function getUserFromStorage(): User | null {
  const userStr = localStorage.getItem('user');
  if (!userStr) return null;
  try {
    return JSON.parse(userStr);
  } catch {
    return null;
  }
}

export function setUserToStorage(user: User, token: string) {
  localStorage.setItem('user', JSON.stringify(user));
  localStorage.setItem('token', token);
}

export function clearStorage() {
  localStorage.removeItem('user');
  localStorage.removeItem('token');
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

export function safeJSONParse<T>(str: string | undefined | null, defaultValue: T): T {
  if (!str) return defaultValue;
  try {
    return JSON.parse(str) as T;
  } catch {
    return defaultValue;
  }
}
