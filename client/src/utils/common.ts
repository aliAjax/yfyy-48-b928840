import { ApplicationStatus, User, UserRole, WarningStatus, FlowStep } from '../types';

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

export const warningLabels: Record<WarningStatus, string> = {
  normal: '正常',
  warning: '即将超期',
  overdue: '已超期',
  none: '-',
};

export const warningColors: Record<WarningStatus, string> = {
  normal: 'success',
  warning: 'warning',
  overdue: 'error',
  none: 'default',
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

export const DEFAULT_FLOW_STEPS: FlowStep[] = [
  { step: 1, name: '窗口受理', role: 'window', description: '窗口人员受理申请', status: 'accepted' },
  { step: 2, name: '材料审核', role: 'window', description: '窗口人员审核材料', status: 'accepted' },
  { step: 3, name: '业务审核', role: 'reviewer', description: '审核人员业务审核', status: 'reviewing' },
  { step: 4, name: '审核通过', role: 'reviewer', description: '审核通过，待办结', status: 'approved' },
  { step: 5, name: '办结出证', role: 'window', description: '窗口人员办结发证', status: 'completed' },
];

export function parseFlowConfig(flowConfigStr: string | null | undefined): FlowStep[] {
  if (!flowConfigStr) return [...DEFAULT_FLOW_STEPS];
  try {
    const parsed = JSON.parse(flowConfigStr);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return [...DEFAULT_FLOW_STEPS];
    }
    const steps = parsed.map((s: any, idx: number) => ({
      step: s.step || idx + 1,
      name: s.name || `步骤${idx + 1}`,
      role: s.role || 'window',
      description: s.description || '',
      status: s.status,
    }));
    return steps.sort((a, b) => a.step - b.step);
  } catch {
    return [...DEFAULT_FLOW_STEPS];
  }
}

export function getStepByStatus(flowSteps: FlowStep[], status: ApplicationStatus): FlowStep | null {
  const matchingSteps = flowSteps.filter(s => s.status === status);
  if (matchingSteps.length > 0) return matchingSteps[0];
  
  const hasStatusField = flowSteps.some(s => s.status);
  if (!hasStatusField) {
    const statusOrder: ApplicationStatus[] = ['submitted', 'accepted', 'reviewing', 'approved', 'completed'];
    const statusIdx = statusOrder.indexOf(status);
    if (statusIdx >= 0 && statusIdx < flowSteps.length) {
      return flowSteps[statusIdx];
    }
    if (status === 'submitted' && flowSteps.length > 0) {
      return flowSteps[0];
    }
    if (statusIdx >= flowSteps.length && flowSteps.length > 0) {
      return flowSteps[flowSteps.length - 1];
    }
  }
  
  if (status === 'submitted' && flowSteps.length > 0) {
    return { ...flowSteps[0], name: '待' + flowSteps[0].name };
  }
  
  return null;
}

export function getCurrentStepName(flowSteps: FlowStep[], status: ApplicationStatus): string {
  const step = getStepByStatus(flowSteps, status);
  if (step) return step.name;
  return statusLabels[status] || status;
}
