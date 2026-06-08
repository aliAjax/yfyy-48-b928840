export type UserRole = 'applicant' | 'window' | 'reviewer' | 'admin';

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
