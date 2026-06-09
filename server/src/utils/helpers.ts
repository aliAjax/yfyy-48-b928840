import { v4 as uuidv4 } from 'uuid';
import { WarningStatus, ApplicationStatus, FlowStep, UserRole } from '../types';

export function generateId(): string {
  return uuidv4();
}

export function now(): string {
  return new Date().toISOString();
}

export function generateApplicationNo(): string {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `SQ${year}${month}${day}${random}`;
}

export function parseJSON<T>(str: string | null | undefined, defaultValue: T): T {
  if (!str) return defaultValue;
  try {
    return JSON.parse(str) as T;
  } catch {
    return defaultValue;
  }
}

export function toJSON(obj: any): string {
  return JSON.stringify(obj);
}

const WARNING_THRESHOLD_DAYS = 3;

export function calculateWarningStatus(
  acceptTime: string | undefined,
  promiseDays: number | undefined,
  status: ApplicationStatus
): { warningStatus: WarningStatus; remainingDays: number | undefined } {
  if (!acceptTime || !promiseDays) {
    return { warningStatus: 'none', remainingDays: undefined };
  }

  const finishedStatuses: ApplicationStatus[] = ['completed', 'rejected'];
  if (finishedStatuses.includes(status)) {
    return { warningStatus: 'none', remainingDays: undefined };
  }

  const acceptDate = new Date(acceptTime);
  const nowDate = new Date();
  const deadlineDate = new Date(acceptDate);
  deadlineDate.setDate(deadlineDate.getDate() + promiseDays);

  const diffTime = deadlineDate.getTime() - nowDate.getTime();
  const remainingDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (remainingDays < 0) {
    return { warningStatus: 'overdue', remainingDays };
  } else if (remainingDays <= WARNING_THRESHOLD_DAYS) {
    return { warningStatus: 'warning', remainingDays };
  } else {
    return { warningStatus: 'normal', remainingDays };
  }
}

export const DEFAULT_FLOW_STEPS: FlowStep[] = [
  { step: 1, name: '窗口受理', role: 'window', description: '窗口人员受理申请', status: 'submitted' },
  { step: 2, name: '材料审核', role: 'window', description: '窗口人员审核材料', status: 'accepted' },
  { step: 3, name: '业务审核', role: 'reviewer', description: '审核人员业务审核', status: 'reviewing' },
  { step: 4, name: '办结出证', role: 'window', description: '窗口人员办结发证', status: 'approved' },
  { step: 5, name: '已办结', role: 'window', description: '申请已办结', status: 'completed' },
];

const LEGACY_STATUS_ORDER: ApplicationStatus[] = ['submitted', 'accepted', 'reviewing', 'approved'];
const CONFIG_STATUS_ORDER: ApplicationStatus[] = ['submitted', 'accepted', 'reviewing', 'approved', 'completed'];
const OPERABLE_STATUSES = new Set<ApplicationStatus>(CONFIG_STATUS_ORDER);
const OPERABLE_ROLES = new Set<UserRole>(['window', 'reviewer', 'admin']);
const STATUS_NAMES: Record<ApplicationStatus, string> = {
  draft: '草稿',
  submitted: '待受理',
  accepted: '已受理',
  supplement: '待补正',
  reviewing: '审核中',
  approved: '审核通过',
  rejected: '已退回',
  completed: '已办结',
};

export interface FlowValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  steps: FlowStep[];
}

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

export function validateFlowConfig(flowConfigStr: string | null | undefined): FlowValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!flowConfigStr) {
    errors.push('请配置审批流程');
    return { valid: false, errors, warnings, steps: [] };
  }

  let parsed: any;
  try {
    parsed = JSON.parse(flowConfigStr);
  } catch {
    errors.push('办理流程JSON格式错误');
    return { valid: false, errors, warnings, steps: [] };
  }

  if (!Array.isArray(parsed) || parsed.length === 0) {
    errors.push('审批流程至少需要一个步骤');
    return { valid: false, errors, warnings, steps: [] };
  }

  const steps = parsed
    .map((s: any, idx: number) => ({
      step: Number(s.step || idx + 1),
      name: String(s.name || '').trim(),
      role: s.role as UserRole,
      description: s.description || '',
      status: s.status as ApplicationStatus | undefined,
    }))
    .sort((a, b) => a.step - b.step);

  const seenStatuses = new Map<ApplicationStatus, number>();
  let lastStatusIndex = -1;

  steps.forEach((step, index) => {
    const label = step.name || `第${index + 1}步`;
    if (!step.name) {
      errors.push(`${label}缺少步骤名称`);
    }
    if (!step.status) {
      errors.push(`${label}缺少对应状态`);
      return;
    }
    if (!OPERABLE_STATUSES.has(step.status)) {
      errors.push(`${label}使用了非标准流程状态：${STATUS_NAMES[step.status] || step.status}`);
    }
    if (seenStatuses.has(step.status)) {
      errors.push(`状态「${STATUS_NAMES[step.status]}」重复配置在第${seenStatuses.get(step.status)}步和第${index + 1}步`);
    } else {
      seenStatuses.set(step.status, index + 1);
    }
    if (!step.role) {
      errors.push(`${label}缺少可操作角色`);
    } else if (!OPERABLE_ROLES.has(step.role)) {
      errors.push(`${label}配置了无效可操作角色：${step.role}`);
    }
    const statusIndex = CONFIG_STATUS_ORDER.indexOf(step.status);
    if (statusIndex >= 0) {
      if (statusIndex < lastStatusIndex) {
        errors.push(`${label}的状态顺序不合理，应按窗口受理、材料审核、业务审核、办结、已办结排列`);
      }
      lastStatusIndex = Math.max(lastStatusIndex, statusIndex);
    }
  });

  if (!seenStatuses.has('completed')) {
    errors.push('审批流程缺少已办结环节');
  }
  if (!seenStatuses.has('approved')) {
    errors.push('审批流程缺少办结出证环节');
  }
  if (!seenStatuses.has('submitted')) {
    warnings.push('建议配置窗口受理环节，方便新申请进入流程');
  }
  if (!seenStatuses.has('reviewing')) {
    warnings.push('建议配置业务审核环节，方便审核人员处理申请');
  }

  return { valid: errors.length === 0, errors, warnings, steps };
}

export function getStepByStatus(flowSteps: FlowStep[], status: ApplicationStatus): FlowStep | null {
  const matchingSteps = flowSteps.filter(s => s.status === status);
  if (matchingSteps.length > 0) return matchingSteps[0];
  
  const hasStatusField = flowSteps.some(s => s.status);
  if (!hasStatusField) {
    const statusIdx = LEGACY_STATUS_ORDER.indexOf(status);
    if (statusIdx >= 0 && statusIdx < flowSteps.length) {
      return flowSteps[statusIdx];
    }
    return null;
  }
  
  if (status === 'submitted' && flowSteps.length > 0) {
    return flowSteps[0];
  }
  
  return null;
}

export function getCurrentStepName(flowSteps: FlowStep[], status: ApplicationStatus): string {
  const step = getStepByStatus(flowSteps, status);
  if (step) return step.name;
  return STATUS_NAMES[status] || status;
}

export function canOperateStep(
  flowSteps: FlowStep[],
  status: ApplicationStatus,
  role: UserRole
): boolean {
  if (role === 'admin') return true;
  const step = getStepByStatus(flowSteps, status);
  return !!step && step.role === role;
}

export function getNextStep(flowSteps: FlowStep[], currentStatus: ApplicationStatus): FlowStep | null {
  const statusOrder: ApplicationStatus[] = ['draft', 'submitted', 'accepted', 'reviewing', 'approved', 'completed'];
  const currentIdx = statusOrder.indexOf(currentStatus);
  if (currentIdx === -1 || currentIdx >= statusOrder.length - 1) return null;
  
  for (let i = currentIdx + 1; i < statusOrder.length; i++) {
    const step = getStepByStatus(flowSteps, statusOrder[i]);
    if (step) return step;
  }
  return null;
}
