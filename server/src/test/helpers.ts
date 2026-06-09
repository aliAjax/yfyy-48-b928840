import { createApplication } from '../dao/applicationDao';
import { createMatter } from '../dao/matterDao';
import { createNotification } from '../dao/notificationDao';
import { createUser } from '../dao/userDao';
import { signToken } from '../middleware/auth';
import { ApplicationStatus, NotificationType, User, UserRole } from '../types';
import { toJSON } from '../utils/helpers';

let sequence = 0;

function nextSuffix() {
  sequence += 1;
  return `${Date.now()}-${sequence}`;
}

export function createTestUser(role: UserRole = 'applicant', overrides: Partial<{
  username: string;
  password: string;
  name: string;
  phone: string;
  idCard: string;
}> = {}): User {
  const suffix = nextSuffix();
  return createUser({
    username: overrides.username || `${role}-${suffix}`,
    password: overrides.password || '123456',
    name: overrides.name || `${role}用户`,
    role,
    phone: overrides.phone,
    idCard: overrides.idCard,
  });
}

export function authHeader(user: User) {
  return { Authorization: `Bearer ${signToken(user.id)}` };
}

export function createTestMatter(overrides: Partial<{
  code: string;
  name: string;
  department: string;
  description: string;
  requiredMaterials: string;
  promiseDays: number;
  flowConfig: string;
  status: string;
}> = {}) {
  const suffix = nextSuffix();
  return createMatter({
    code: overrides.code || `MAT-${suffix}`,
    name: overrides.name || '测试事项',
    department: overrides.department || '测试部门',
    description: overrides.description || '用于接口测试',
    requiredMaterials: overrides.requiredMaterials || toJSON([
      { name: '申请表', required: true, description: '填写完整' },
    ]),
    promiseDays: overrides.promiseDays || 5,
    flowConfig: overrides.flowConfig || toJSON([
      { step: 1, name: '窗口受理', role: 'window', status: 'submitted' },
      { step: 2, name: '业务审核', role: 'reviewer', status: 'reviewing' },
      { step: 3, name: '办结出证', role: 'window', status: 'approved' },
    ]),
    status: overrides.status || 'active',
  });
}

export function createTestApplication(overrides: Partial<{
  applicant: User;
  matter: ReturnType<typeof createTestMatter>;
  status: ApplicationStatus;
}> = {}) {
  const applicant = overrides.applicant || createTestUser('applicant');
  const matter = overrides.matter || createTestMatter();
  const status = overrides.status || 'draft';

  return createApplication({
    applicantId: applicant.id,
    matterId: matter.id,
    basicInfo: toJSON({ name: applicant.name, phone: applicant.phone || '13800000000' }),
    materials: toJSON([{ name: '申请表', checked: true }]),
    status,
  });
}

export function createTestNotification(user: User, overrides: Partial<{
  type: NotificationType;
  title: string;
  content: string;
  applicationId: string;
}> = {}) {
  return createNotification({
    userId: user.id,
    type: overrides.type || 'submit',
    title: overrides.title || '测试通知',
    content: overrides.content || '测试通知内容',
    applicationId: overrides.applicationId,
  });
}
