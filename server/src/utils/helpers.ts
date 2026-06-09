import { v4 as uuidv4 } from 'uuid';
import { WarningStatus, ApplicationStatus, FlowStep, UserRole, MatterMaterial, ApplicationMaterial, MaterialFile } from '../types';

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

const DEFAULT_WARNING_DAYS = 3;

export function calculateSupplementDays(
  logs: Array<{ action: string; createdAt: string; newStatus?: string }>
): number {
  if (!logs || logs.length === 0) return 0;

  const sortedLogs = [...logs].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  let supplementDays = 0;
  let supplementStart: Date | null = null;

  for (const log of sortedLogs) {
    if (log.action === 'supplement' && !supplementStart) {
      supplementStart = new Date(log.createdAt);
    } else if (
      supplementStart &&
      (log.action === 'submit' ||
        (log.newStatus && log.newStatus !== 'supplement' && log.newStatus !== 'draft'))
    ) {
      const endDate = new Date(log.createdAt);
      const diff = endDate.getTime() - supplementStart.getTime();
      supplementDays += Math.ceil(diff / (1000 * 60 * 60 * 24));
      supplementStart = null;
    }
  }

  if (supplementStart) {
    const nowDate = new Date();
    const diff = nowDate.getTime() - supplementStart.getTime();
    supplementDays += Math.ceil(diff / (1000 * 60 * 60 * 24));
  }

  return supplementDays;
}

export function calculateWarningStatus(
  acceptTime: string | undefined,
  promiseDays: number | undefined,
  status: ApplicationStatus,
  warningDays?: number,
  excludeSupplementTime?: boolean,
  supplementDays?: number
): { warningStatus: WarningStatus; remainingDays: number | undefined } {
  if (!acceptTime || !promiseDays) {
    return { warningStatus: 'none', remainingDays: undefined };
  }

  const finishedStatuses: ApplicationStatus[] = ['completed', 'rejected'];
  if (finishedStatuses.includes(status)) {
    return { warningStatus: 'none', remainingDays: undefined };
  }

  const effectiveWarningDays = warningDays ?? DEFAULT_WARNING_DAYS;
  const effectiveSupplementDays = excludeSupplementTime ? (supplementDays || 0) : 0;

  const acceptDate = new Date(acceptTime);
  const nowDate = new Date();
  const deadlineDate = new Date(acceptDate);
  deadlineDate.setDate(deadlineDate.getDate() + promiseDays + effectiveSupplementDays);

  const diffTime = deadlineDate.getTime() - nowDate.getTime();
  const remainingDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (remainingDays < 0) {
    return { warningStatus: 'overdue', remainingDays };
  } else if (remainingDays <= effectiveWarningDays) {
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
  
  const statusNames: Record<ApplicationStatus, string> = {
    draft: '草稿',
    submitted: '待受理',
    accepted: '已受理',
    supplement: '待补正',
    reviewing: '审核中',
    approved: '审核通过',
    rejected: '已退回',
    completed: '已办结',
  };
  return statusNames[status] || status;
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

export interface MaterialCompletenessInfo {
  totalRequired: number;
  completedRequired: number;
  isComplete: boolean;
  missingMaterials: string[];
}

export function calculateMaterialCompleteness(
  requiredMaterialsStr: string | null | undefined,
  appMaterialsStr: string | null | undefined,
  files: MaterialFile[] = []
): MaterialCompletenessInfo {
  const requiredMaterials = parseJSON<MatterMaterial[]>(requiredMaterialsStr, []);
  const appMaterials = parseJSON<ApplicationMaterial[]>(appMaterialsStr, []);

  const requiredList = requiredMaterials.filter(m => m.required);

  if (requiredList.length === 0) {
    return {
      totalRequired: 0,
      completedRequired: 0,
      isComplete: true,
      missingMaterials: [],
    };
  }

  const appMaterialMap = new Map<string, ApplicationMaterial>();
  appMaterials.forEach(m => {
    appMaterialMap.set(m.name, m);
  });

  const fileNames = new Set(files.map(f => f.originalName));

  let completedCount = 0;
  const missingList: string[] = [];

  requiredList.forEach(req => {
    const appMat = appMaterialMap.get(req.name);
    const hasFile = fileNames.has(req.name);
    const isCompleted = (appMat && appMat.checked) || hasFile;

    if (isCompleted) {
      completedCount++;
    } else {
      missingList.push(req.name);
    }
  });

  return {
    totalRequired: requiredList.length,
    completedRequired: completedCount,
    isComplete: completedCount === requiredList.length,
    missingMaterials: missingList,
  };
}

const STATUS_LABELS: Record<ApplicationStatus, string> = {
  draft: '草稿',
  submitted: '待受理',
  accepted: '已受理',
  supplement: '待补正',
  reviewing: '审核中',
  approved: '审核通过',
  rejected: '已退回',
  completed: '已办结',
};

export const STATUS_ORDER: ApplicationStatus[] = [
  'draft', 'submitted', 'accepted', 'supplement', 'reviewing', 'approved', 'rejected', 'completed'
];

export interface FlowValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export function validateFlowConfig(steps: FlowStep[]): FlowValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!steps || steps.length === 0) {
    errors.push('流程步骤不能为空');
    return { valid: false, errors, warnings };
  }

  const statuses = steps.map(s => s.status).filter(Boolean) as ApplicationStatus[];

  const statusSet = new Set<string>();
  const duplicateStatuses: string[] = [];
  statuses.forEach(status => {
    if (statusSet.has(status)) {
      duplicateStatuses.push(STATUS_LABELS[status] || status);
    } else {
      statusSet.add(status);
    }
  });
  if (duplicateStatuses.length > 0) {
    errors.push(`存在重复状态：${duplicateStatuses.join('、')}`);
  }

  const hasCompleted = steps.some(s => s.status === 'completed');
  if (!hasCompleted) {
    errors.push('缺少办结环节（状态为"已办结"的步骤）');
  }

  let lastStatusIndex = -1;
  let orderError = false;
  for (const step of steps) {
    if (step.status) {
      const idx = STATUS_ORDER.indexOf(step.status);
      if (idx < lastStatusIndex) {
        orderError = true;
        break;
      }
      lastStatusIndex = idx;
    }
  }
  if (orderError) {
    errors.push('状态顺序不合理，请按流程先后顺序排列步骤');
  }

  steps.forEach((step, index) => {
    if (!step.role) {
      errors.push(`第 ${index + 1} 步「${step.name}」缺少可操作角色`);
    }
    if (!step.status && step.status !== undefined) {
      warnings.push(`第 ${index + 1} 步「${step.name}」未设置对应状态`);
    }
  });

  if (!steps.some(s => s.status === 'submitted')) {
    warnings.push('建议包含"窗口受理"环节（状态为"待受理"）');
  }
  if (!steps.some(s => s.status === 'reviewing')) {
    warnings.push('建议包含"业务审核"环节（状态为"审核中"）');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}
