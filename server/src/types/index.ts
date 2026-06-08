export type UserRole = 'applicant' | 'window' | 'reviewer' | 'admin';

export interface FlowStep {
  step: number;
  name: string;
  role: UserRole;
  description?: string;
  status?: ApplicationStatus;
}

export interface User {
  id: string;
  username: string;
  password: string;
  name: string;
  role: UserRole;
  phone?: string;
  idCard?: string;
  createdAt: string;
  updatedAt: string;
}

export interface MatterMaterial {
  name: string;
  required: boolean;
  description?: string;
}

export interface ApplicationMaterial extends MatterMaterial {
  checked: boolean;
  remark?: string;
}

export interface Matter {
  id: string;
  code: string;
  name: string;
  department: string;
  description: string;
  requiredMaterials: string;
  promiseDays: number;
  flowConfig: string;
  status: 'active' | 'inactive';
  createdAt: string;
  updatedAt: string;
}

export type ApplicationStatus = 
  | 'draft' 
  | 'submitted' 
  | 'accepted' 
  | 'supplement' 
  | 'reviewing' 
  | 'approved' 
  | 'rejected' 
  | 'completed';

export type WarningStatus = 'normal' | 'warning' | 'overdue' | 'none';

export interface Application {
  id: string;
  applicationNo: string;
  matterId: string;
  matterName?: string;
  applicantId: string;
  applicantName?: string;
  basicInfo: string;
  materials: string;
  status: ApplicationStatus;
  supplementReason?: string;
  rejectReason?: string;
  reviewOpinion?: string;
  currentStep?: string;
  windowUserId?: string;
  reviewerUserId?: string;
  submitTime?: string;
  acceptTime?: string;
  completeTime?: string;
  createdAt: string;
  updatedAt: string;
  warningStatus?: WarningStatus;
  remainingDays?: number;
  promiseDays?: number;
}

export interface MaterialFile {
  id: string;
  applicationId: string;
  fileName: string;
  originalName: string;
  filePath: string;
  fileSize: number;
  mimeType?: string;
  uploadedBy: string;
  uploadedByName?: string;
  version: number;
  isCurrent: boolean;
  versionNote?: string;
  createdAt: string;
}

export interface OperationLog {
  id: string;
  applicationId: string;
  userId: string;
  userName?: string;
  action: string;
  description: string;
  oldStatus?: string;
  newStatus?: string;
  createdAt: string;
}

export type NotificationType = 
  | 'submit' 
  | 'accept' 
  | 'supplement' 
  | 'reject' 
  | 'review_pass'
  | 'review_reject'
  | 'send_review'
  | 'complete';

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  content?: string;
  applicationId?: string;
  isRead: boolean;
  createdAt: string;
  readAt?: string;
}

export interface ApplicationTemplate {
  id: string;
  name: string;
  matterId: string;
  matterName?: string;
  userId: string;
  userName?: string;
  basicInfo: string;
  materials: string;
  createdAt: string;
  updatedAt: string;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  total?: number;
}

export interface BatchOperationItem {
  id: string;
  applicationNo?: string;
  success: boolean;
  reason?: string;
}

export interface BatchOperationResult {
  successCount: number;
  failureCount: number;
  results: BatchOperationItem[];
}

export interface StatsFilterParams {
  startDate?: string;
  endDate?: string;
  department?: string;
  matterId?: string;
  status?: string;
}

export interface StatsOverview {
  totalCount: number;
  approvedCount: number;
  rejectedCount: number;
  avgDuration: number;
  approvalRate: number;
  rejectionRate: number;
}

export interface DailyTrendItem {
  date: string;
  totalCount: number;
  approvedCount: number;
  rejectedCount: number;
}

export interface MatterRankItem {
  matterId: string;
  matterName: string;
  department: string;
  totalCount: number;
  approvedCount: number;
  rejectedCount: number;
  approvalRate: number;
  avgDuration: number;
}

export interface DepartmentStatsItem {
  department: string;
  totalCount: number;
  approvedCount: number;
  rejectedCount: number;
  approvalRate: number;
  rejectionRate: number;
  avgDuration: number;
}

export interface StatusStatsItem {
  status: string;
  count: number;
  totalCount: number;
  approvedCount: number;
  rejectedCount: number;
  approvalRate: number;
  rejectionRate: number;
  avgDuration: number;
}

export interface UserStatsItem {
  userId: string;
  userName: string;
  role: string;
  totalCount: number;
  approvedCount: number;
  rejectedCount: number;
  avgDuration: number;
}

export interface WarningStats {
  totalCount: number;
  normalCount: number;
  warningCount: number;
  overdueCount: number;
  warningRate: number;
  overdueRate: number;
}

export interface MonthlyTrendItem {
  month: string;
  totalCount: number;
  approvedCount: number;
  rejectedCount: number;
  avgDuration: number;
}

export interface SupplementStats {
  supplementCount: number;
  supplementRate: number;
  avgSupplementCount: number;
}

export interface FullStatsOverview extends StatsOverview {
  inProgressCount: number;
  supplementCount: number;
  warningCount: number;
  overdueCount: number;
  supplementRate: number;
  warningRate: number;
  overdueRate: number;
}
