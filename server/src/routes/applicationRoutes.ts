import { Router } from 'express';
import { 
  findApplicationById, 
  listApplications, 
  createApplication, 
  updateApplication,
  findApplicationByNo 
} from '../dao/applicationDao';
import { findMatterById } from '../dao/matterDao';
import { findUserById, listUsers } from '../dao/userDao';
import { createLog, listLogsByApplication } from '../dao/logDao';
import { listFilesByApplication } from '../dao/fileDao';
import { createNotification } from '../dao/notificationDao';
import { authMiddleware, requireRole, AuthRequest } from '../middleware/auth';
import { now, toJSON, calculateWarningStatus } from '../utils/helpers';
import { ApplicationStatus, WarningStatus } from '../types';

const router = Router();

function enrichApplication(app: any) {
  const matter = findMatterById(app.matterId);
  const applicant = findUserById(app.applicantId);
  const files = listFilesByApplication(app.id);
  
  const { warningStatus, remainingDays } = calculateWarningStatus(
    app.acceptTime,
    matter?.promiseDays,
    app.status
  );
  
  return {
    ...app,
    matterName: matter?.name,
    applicantName: applicant?.name,
    files,
    warningStatus,
    remainingDays,
    promiseDays: matter?.promiseDays,
  };
}

router.get('/', authMiddleware, (req: AuthRequest, res) => {
  if (!req.user) return;
  
  const { status, keyword, page = 1, pageSize = 10, matterId, warningStatus } = req.query;
  
  let applicantId: string | undefined;
  if (req.user.role === 'applicant') {
    applicantId = req.user.id;
  }

  const result = listApplications({
    applicantId,
    matterId: matterId as string,
    status: status as ApplicationStatus,
    keyword: keyword as string,
  });

  let enriched = result.applications.map(enrichApplication);

  const canFilterByWarning = req.user.role === 'window' || req.user.role === 'admin';

  if (warningStatus && canFilterByWarning) {
    const ws = warningStatus as WarningStatus;
    enriched = enriched.filter(app => app.warningStatus === ws);
  }

  const total = enriched.length;
  const pageNum = Number(page);
  const pageSizeNum = Number(pageSize);
  const start = (pageNum - 1) * pageSizeNum;
  const paged = enriched.slice(start, start + pageSizeNum);

  res.json({
    success: true,
    data: paged,
    total,
  });
});

router.get('/warning/list', authMiddleware, (req: AuthRequest, res) => {
  if (!req.user) return;

  const { warningStatus, page = 1, pageSize = 10, keyword } = req.query;

  let applicantId: string | undefined;
  if (req.user.role === 'applicant') {
    applicantId = req.user.id;
  }

  const result = listApplications({
    applicantId,
    keyword: keyword as string,
  });

  let enriched = result.applications.map(enrichApplication);

  const activeStatuses: ApplicationStatus[] = ['submitted', 'accepted', 'supplement', 'reviewing', 'approved'];
  enriched = enriched.filter(app => activeStatuses.includes(app.status));

  if (warningStatus) {
    const ws = warningStatus as WarningStatus;
    enriched = enriched.filter(app => app.warningStatus === ws);
  } else {
    enriched = enriched.filter(app => app.warningStatus === 'warning' || app.warningStatus === 'overdue');
  }

  enriched.sort((a, b) => {
    const order: Record<WarningStatus, number> = { overdue: 0, warning: 1, normal: 2, none: 3 };
    const aStatus: WarningStatus = a.warningStatus || 'none';
    const bStatus: WarningStatus = b.warningStatus || 'none';
    const aOrder = order[aStatus];
    const bOrder = order[bStatus];
    if (aOrder !== bOrder) return aOrder - bOrder;
    return (a.remainingDays || 0) - (b.remainingDays || 0);
  });

  const total = enriched.length;
  const pageNum = Number(page);
  const pageSizeNum = Number(pageSize);
  const start = (pageNum - 1) * pageSizeNum;
  const paged = enriched.slice(start, start + pageSizeNum);

  res.json({
    success: true,
    data: paged,
    total,
  });
});

router.post('/batch/accept', authMiddleware, (req: AuthRequest, res) => {
  if (!req.user) return;

  if (!['window', 'admin'].includes(req.user.role)) {
    res.status(403).json({ success: false, message: '权限不足' });
    return;
  }

  const { ids } = req.body;
  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    res.json({ success: false, message: '请选择要受理的申请' });
    return;
  }

  const results: any[] = [];
  let successCount = 0;
  let failureCount = 0;

  ids.forEach(id => {
    let app = findApplicationById(id);
    const resultItem: any = { id };

    if (!app) {
      resultItem.success = false;
      resultItem.reason = '申请不存在';
      failureCount++;
      results.push(resultItem);
      return;
    }

    resultItem.applicationNo = app.applicationNo;

    if (app.status !== 'submitted') {
      resultItem.success = false;
      resultItem.reason = `当前状态「${app.status}」不能受理，仅待受理状态可操作`;
      failureCount++;
      results.push(resultItem);
      return;
    }

    const oldStatus = app.status;
    app = updateApplication(app.id, {
      status: 'accepted',
      windowUserId: req.user!.id,
      acceptTime: now(),
      currentStep: '材料审核中',
    })!;

    createLog({
      applicationId: app.id,
      userId: req.user!.id,
      action: 'accept',
      description: '窗口批量受理申请',
      oldStatus,
      newStatus: 'accepted',
    });

    const matter = findMatterById(app.matterId);
    createNotification({
      userId: app.applicantId,
      type: 'accept',
      title: '申请已受理',
      content: `您的「${matter?.name || ''}」申请已被窗口受理，正在处理中。`,
      applicationId: app.id,
    });

    resultItem.success = true;
    successCount++;
    results.push(resultItem);
  });

  res.json({
    success: true,
    data: {
      successCount,
      failureCount,
      results,
    },
    message: `批量受理完成：成功 ${successCount} 条，失败 ${failureCount} 条`,
  });
});

router.post('/batch/supplement', authMiddleware, (req: AuthRequest, res) => {
  if (!req.user) return;

  if (!['window', 'admin'].includes(req.user.role)) {
    res.status(403).json({ success: false, message: '权限不足' });
    return;
  }

  const { ids, reason } = req.body;
  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    res.json({ success: false, message: '请选择要补正的申请' });
    return;
  }
  if (!reason || !reason.trim()) {
    res.json({ success: false, message: '请输入补正原因' });
    return;
  }

  const results: any[] = [];
  let successCount = 0;
  let failureCount = 0;

  ids.forEach(id => {
    let app = findApplicationById(id);
    const resultItem: any = { id };

    if (!app) {
      resultItem.success = false;
      resultItem.reason = '申请不存在';
      failureCount++;
      results.push(resultItem);
      return;
    }

    resultItem.applicationNo = app.applicationNo;

    if (app.status !== 'submitted' && app.status !== 'accepted') {
      resultItem.success = false;
      resultItem.reason = `当前状态「${app.status}」不能要求补正，仅待受理或已受理状态可操作`;
      failureCount++;
      results.push(resultItem);
      return;
    }

    const oldStatus = app.status;
    app = updateApplication(app.id, {
      status: 'supplement',
      supplementReason: reason,
    })!;

    createLog({
      applicationId: app.id,
      userId: req.user!.id,
      action: 'supplement',
      description: `批量要求补正材料：${reason || ''}`,
      oldStatus,
      newStatus: 'supplement',
    });

    const matter = findMatterById(app.matterId);
    createNotification({
      userId: app.applicantId,
      type: 'supplement',
      title: '申请需补正材料',
      content: `您的「${matter?.name || ''}」申请需要补正材料：${reason || ''}`,
      applicationId: app.id,
    });

    resultItem.success = true;
    successCount++;
    results.push(resultItem);
  });

  res.json({
    success: true,
    data: {
      successCount,
      failureCount,
      results,
    },
    message: `批量补正完成：成功 ${successCount} 条，失败 ${failureCount} 条`,
  });
});

router.get('/warning/stats', authMiddleware, (req: AuthRequest, res) => {
  if (!req.user) return;

  let applicantId: string | undefined;
  if (req.user.role === 'applicant') {
    applicantId = req.user.id;
  }

  const result = listApplications({
    applicantId,
  });

  const enriched = result.applications.map(enrichApplication);

  const activeStatuses: ApplicationStatus[] = ['submitted', 'accepted', 'supplement', 'reviewing', 'approved'];
  const activeApps = enriched.filter(app => activeStatuses.includes(app.status));

  const stats = {
    total: activeApps.length,
    normal: activeApps.filter(a => a.warningStatus === 'normal').length,
    warning: activeApps.filter(a => a.warningStatus === 'warning').length,
    overdue: activeApps.filter(a => a.warningStatus === 'overdue').length,
  };

  res.json({ success: true, data: stats });
});

router.get('/:id', authMiddleware, (req: AuthRequest, res) => {
  if (!req.user) return;

  const app = findApplicationById(req.params.id);
  if (!app) {
    res.json({ success: false, message: '申请不存在' });
    return;
  }

  if (req.user.role === 'applicant' && app.applicantId !== req.user.id) {
    res.status(403).json({ success: false, message: '无权查看此申请' });
    return;
  }

  res.json({ success: true, data: enrichApplication(app) });
});

router.post('/', authMiddleware, requireRole('applicant'), (req: AuthRequest, res) => {
  if (!req.user) return;

  const { matterId, basicInfo, materials } = req.body;

  if (!matterId) {
    res.json({ success: false, message: '请选择事项' });
    return;
  }

  const matter = findMatterById(matterId);
  if (!matter || matter.status !== 'active') {
    res.json({ success: false, message: '事项不存在或未启用' });
    return;
  }

  const app = createApplication({
    matterId,
    applicantId: req.user.id,
    basicInfo: basicInfo ? toJSON(basicInfo) : undefined,
    materials: materials ? toJSON(materials) : undefined,
    status: 'draft',
  });

  createLog({
    applicationId: app.id,
    userId: req.user.id,
    action: 'create',
    description: '创建申请草稿',
  });

  res.json({ success: true, data: enrichApplication(app), message: '创建成功' });
});

router.post('/:id/submit', authMiddleware, requireRole('applicant'), (req: AuthRequest, res) => {
  if (!req.user) return;

  let app = findApplicationById(req.params.id);
  if (!app) {
    res.json({ success: false, message: '申请不存在' });
    return;
  }

  if (app.applicantId !== req.user.id) {
    res.status(403).json({ success: false, message: '无权操作此申请' });
    return;
  }

  if (app.status !== 'draft' && app.status !== 'supplement') {
    res.json({ success: false, message: '当前状态不能提交' });
    return;
  }

  const oldStatus = app.status;
  app = updateApplication(app.id, {
    status: 'submitted',
    submitTime: now(),
  })!;

  const currentUser = req.user;

  createLog({
    applicationId: app.id,
    userId: currentUser.id,
    action: 'submit',
    description: '提交申请，等待窗口受理',
    oldStatus,
    newStatus: 'submitted',
  });

  const matter = findMatterById(app.matterId);
  const windowUsers = listUsers({ role: 'window' }).users;
  windowUsers.forEach(u => {
    createNotification({
      userId: u.id,
      type: 'submit',
      title: '新申请待受理',
      content: `申请人 ${currentUser.name} 提交了「${matter?.name || ''}」申请，请及时受理。`,
      applicationId: app.id,
    });
  });

  res.json({ success: true, data: enrichApplication(app), message: '提交成功' });
});

router.post('/:id/accept', authMiddleware, requireRole('window'), (req: AuthRequest, res) => {
  if (!req.user) return;

  let app = findApplicationById(req.params.id);
  if (!app) {
    res.json({ success: false, message: '申请不存在' });
    return;
  }

  if (app.status !== 'submitted') {
    res.json({ success: false, message: '当前状态不能受理' });
    return;
  }

  const oldStatus = app.status;
  app = updateApplication(app.id, {
    status: 'accepted',
    windowUserId: req.user.id,
    acceptTime: now(),
    currentStep: '材料审核中',
  })!;

  createLog({
    applicationId: app.id,
    userId: req.user.id,
    action: 'accept',
    description: '窗口受理申请',
    oldStatus,
    newStatus: 'accepted',
  });

  const matter = findMatterById(app.matterId);
  createNotification({
    userId: app.applicantId,
    type: 'accept',
    title: '申请已受理',
    content: `您的「${matter?.name || ''}」申请已被窗口受理，正在处理中。`,
    applicationId: app.id,
  });

  res.json({ success: true, data: enrichApplication(app), message: '受理成功' });
});

router.post('/:id/supplement', authMiddleware, requireRole('window'), (req: AuthRequest, res) => {
  if (!req.user) return;

  const { reason } = req.body;
  let app = findApplicationById(req.params.id);
  if (!app) {
    res.json({ success: false, message: '申请不存在' });
    return;
  }

  if (app.status !== 'submitted' && app.status !== 'accepted') {
    res.json({ success: false, message: '当前状态不能补正' });
    return;
  }

  const oldStatus = app.status;
  app = updateApplication(app.id, {
    status: 'supplement',
    supplementReason: reason,
  })!;

  createLog({
    applicationId: app.id,
    userId: req.user.id,
    action: 'supplement',
    description: `要求补正材料：${reason || ''}`,
    oldStatus,
    newStatus: 'supplement',
  });

  const matter = findMatterById(app.matterId);
  createNotification({
    userId: app.applicantId,
    type: 'supplement',
    title: '申请需补正材料',
    content: `您的「${matter?.name || ''}」申请需要补正材料：${reason || ''}`,
    applicationId: app.id,
  });

  res.json({ success: true, data: enrichApplication(app), message: '已发送补正通知' });
});

router.post('/:id/reject', authMiddleware, (req: AuthRequest, res) => {
  if (!req.user) return;
  
  const { reason } = req.body;
  
  if (!['window', 'reviewer', 'admin'].includes(req.user.role)) {
    res.status(403).json({ success: false, message: '权限不足' });
    return;
  }

  let app = findApplicationById(req.params.id);
  if (!app) {
    res.json({ success: false, message: '申请不存在' });
    return;
  }

  if (!['submitted', 'accepted', 'reviewing'].includes(app.status)) {
    res.json({ success: false, message: '当前状态不能退回' });
    return;
  }

  const oldStatus = app.status;
  app = updateApplication(app.id, {
    status: 'rejected',
    rejectReason: reason,
    completeTime: now(),
  })!;

  createLog({
    applicationId: app.id,
    userId: req.user.id,
    action: 'reject',
    description: `申请被退回：${reason || ''}`,
    oldStatus,
    newStatus: 'rejected',
  });

  const matter = findMatterById(app.matterId);
  createNotification({
    userId: app.applicantId,
    type: 'reject',
    title: '申请被退回',
    content: `您的「${matter?.name || ''}」申请被退回，原因：${reason || ''}`,
    applicationId: app.id,
  });

  res.json({ success: true, data: enrichApplication(app), message: '已退回申请' });
});

router.post('/:id/send-review', authMiddleware, requireRole('window'), (req: AuthRequest, res) => {
  if (!req.user) return;

  let app = findApplicationById(req.params.id);
  if (!app) {
    res.json({ success: false, message: '申请不存在' });
    return;
  }

  if (app.status !== 'accepted') {
    res.json({ success: false, message: '当前状态不能送审' });
    return;
  }

  const oldStatus = app.status;
  app = updateApplication(app.id, {
    status: 'reviewing',
    currentStep: '审核中',
  })!;

  createLog({
    applicationId: app.id,
    userId: req.user.id,
    action: 'send_review',
    description: '材料审核通过，送交审核人员',
    oldStatus,
    newStatus: 'reviewing',
  });

  const matter = findMatterById(app.matterId);
  const reviewerUsers = listUsers({ role: 'reviewer' }).users;
  reviewerUsers.forEach(u => {
    createNotification({
      userId: u.id,
      type: 'send_review',
      title: '新申请待审核',
      content: `窗口已将「${matter?.name || ''}」申请送交审核，请及时处理。`,
      applicationId: app.id,
    });
  });

  res.json({ success: true, data: enrichApplication(app), message: '已送审' });
});

router.post('/:id/review', authMiddleware, requireRole('reviewer'), (req: AuthRequest, res) => {
  if (!req.user) return;

  const { opinion, pass } = req.body;
  let app = findApplicationById(req.params.id);
  if (!app) {
    res.json({ success: false, message: '申请不存在' });
    return;
  }

  if (app.status !== 'reviewing') {
    res.json({ success: false, message: '当前状态不能审核' });
    return;
  }

  const oldStatus = app.status;
  if (pass) {
    app = updateApplication(app.id, {
      status: 'approved',
      reviewOpinion: opinion,
      reviewerUserId: req.user.id,
      currentStep: '审核通过，待办结',
    })!;
  } else {
    app = updateApplication(app.id, {
      status: 'rejected',
      reviewOpinion: opinion,
      reviewerUserId: req.user.id,
      rejectReason: opinion,
      completeTime: now(),
    })!;
  }

  createLog({
    applicationId: app.id,
    userId: req.user.id,
    action: 'review',
    description: `审核${pass ? '通过' : '不通过'}：${opinion || ''}`,
    oldStatus,
    newStatus: pass ? 'approved' : 'rejected',
  });

  const matter = findMatterById(app.matterId);
  if (pass) {
    createNotification({
      userId: app.applicantId,
      type: 'review_pass',
      title: '审核通过',
      content: `您的「${matter?.name || ''}」申请已审核通过，等待办结。`,
      applicationId: app.id,
    });
    const windowUsers = listUsers({ role: 'window' }).users;
    windowUsers.forEach(u => {
      createNotification({
        userId: u.id,
        type: 'review_pass',
        title: '申请审核通过待办结',
        content: `「${matter?.name || ''}」申请已审核通过，请及时办结。`,
        applicationId: app.id,
      });
    });
  } else {
    createNotification({
      userId: app.applicantId,
      type: 'review_reject',
      title: '审核不通过',
      content: `您的「${matter?.name || ''}」申请审核不通过，原因：${opinion || ''}`,
      applicationId: app.id,
    });
  }

  res.json({ success: true, data: enrichApplication(app), message: '审核完成' });
});

router.post('/:id/complete', authMiddleware, requireRole('window'), (req: AuthRequest, res) => {
  if (!req.user) return;

  let app = findApplicationById(req.params.id);
  if (!app) {
    res.json({ success: false, message: '申请不存在' });
    return;
  }

  if (app.status !== 'approved') {
    res.json({ success: false, message: '当前状态不能办结' });
    return;
  }

  const oldStatus = app.status;
  app = updateApplication(app.id, {
    status: 'completed',
    completeTime: now(),
    currentStep: '已办结',
  })!;

  createLog({
    applicationId: app.id,
    userId: req.user.id,
    action: 'complete',
    description: '申请已办结',
    oldStatus,
    newStatus: 'completed',
  });

  const matter = findMatterById(app.matterId);
  createNotification({
    userId: app.applicantId,
    type: 'complete',
    title: '申请已办结',
    content: `您的「${matter?.name || ''}」申请已办结，请前往办理结果。`,
    applicationId: app.id,
  });

  res.json({ success: true, data: enrichApplication(app), message: '办结成功' });
});

router.put('/:id', authMiddleware, requireRole('applicant'), (req: AuthRequest, res) => {
  if (!req.user) return;

  const { id } = req.params;
  const { basicInfo, materials } = req.body;

  let app = findApplicationById(id);
  if (!app) {
    res.json({ success: false, message: '申请不存在' });
    return;
  }

  if (app.applicantId !== req.user.id) {
    res.status(403).json({ success: false, message: '无权操作此申请' });
    return;
  }

  if (app.status !== 'draft' && app.status !== 'supplement') {
    res.json({ success: false, message: '当前状态不能修改' });
    return;
  }

  app = updateApplication(id, {
    basicInfo: basicInfo ? toJSON(basicInfo) : undefined,
    materials: materials ? toJSON(materials) : undefined,
  })!;

  createLog({
    applicationId: app.id,
    userId: req.user.id,
    action: 'update',
    description: '修改申请信息',
  });

  res.json({ success: true, data: enrichApplication(app), message: '更新成功' });
});

router.get('/:id/logs', authMiddleware, (req: AuthRequest, res) => {
  if (!req.user) return;

  const app = findApplicationById(req.params.id);
  if (!app) {
    res.json({ success: false, message: '申请不存在' });
    return;
  }

  if (req.user.role === 'applicant' && app.applicantId !== req.user.id) {
    res.status(403).json({ success: false, message: '无权查看' });
    return;
  }

  const logs = listLogsByApplication(req.params.id);
  res.json({ success: true, data: logs });
});

export default router;
