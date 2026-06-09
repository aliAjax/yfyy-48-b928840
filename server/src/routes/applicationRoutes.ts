import { Router } from 'express';
import { findApplicationById, listApplications, createApplication, updateApplication, findApplicationByNo } from '../dao/applicationDao';
import { findMatterById } from '../dao/matterDao';
import { findUserById, listUsers } from '../dao/userDao';
import { createLog, listLogsByApplication } from '../dao/logDao';
import { listCurrentFilesByApplication, listAllFilesByApplication, getVersionCount } from '../dao/fileDao';
import { createNotification } from '../dao/notificationDao';
import { listReviewOpinionsByApplication, batchCreateReviewOpinions, getMaxReviewRound, getLatestProblemOpinions, countSupplementRounds, listReviewOpinionsByRound } from '../dao/reviewOpinionDao';
import { authMiddleware, requireRole, AuthRequest } from '../middleware/auth';
import { now, toJSON, calculateWarningStatus, calculateSupplementDays, parseFlowConfig, getCurrentStepName, getStepByStatus, canOperateStep, parseJSON } from '../utils/helpers';
import { ApplicationStatus, WarningStatus, ReviewOpinionStatus, SupplementReviewContext, MaterialSupplementStatus, ApplicationMaterial, MatterMaterial } from '../types';

const router = Router();

function buildSupplementReviewContext(app: any, matter: any): SupplementReviewContext | undefined {
  const maxRound = getMaxReviewRound(app.id);
  if (maxRound === 0) return undefined;

  const supplementCount = countSupplementRounds(app.id);
  if (supplementCount === 0) return undefined;

  const isSupplementReview = ['submitted', 'accepted', 'reviewing', 'supplement'].includes(app.status);
  if (!isSupplementReview) return undefined;

  const previousRoundOpinions = listReviewOpinionsByRound(app.id, maxRound);
  if (previousRoundOpinions.length === 0) return undefined;

  const appMaterials = parseJSON<ApplicationMaterial[]>(app.materials, []);
  const matterMaterials = parseJSON<MatterMaterial[]>(matter?.requiredMaterials, []);
  const allFiles = listAllFilesByApplication(app.id);
  const currentFiles = listCurrentFilesByApplication(app.id);

  const materialStatuses: MaterialSupplementStatus[] = previousRoundOpinions.map(opinion => {
    const appMat = appMaterials.find(m => m.name === opinion.materialName);
    const relatedFiles = currentFiles.filter(f =>
      f.originalName.includes(opinion.materialName) || opinion.materialName.includes(f.originalName.replace(/\.[^/.]+$/, ''))
    );
    const allRelatedFiles = allFiles.filter(f =>
      f.originalName.includes(opinion.materialName) || opinion.materialName.includes(f.originalName.replace(/\.[^/.]+$/, ''))
    );

    const hasNewVersion = relatedFiles.some(f => {
      const vCount = getVersionCount(app.id, f.originalName);
      return vCount > 1;
    }) || allRelatedFiles.length > 0;

    return {
      materialName: opinion.materialName,
      previousStatus: opinion.status,
      previousOpinion: opinion.opinion,
      isCorrected: opinion.status === 'pass',
      currentRemark: appMat?.remark,
      hasNewVersion: hasNewVersion || (appMat?.checked ?? false),
    };
  });

  return {
    isSupplementReview: true,
    previousRound: maxRound,
    supplementCount,
    materialStatuses,
  };
}

function enrichApplication(app: any) {
  const matter = findMatterById(app.matterId);
  const applicant = findUserById(app.applicantId);
  const files = listCurrentFilesByApplication(app.id);
  const reviewOpinions = listReviewOpinionsByApplication(app.id);
  const logs = listLogsByApplication(app.id);
  
  const supplementDays = calculateSupplementDays(logs);
  
  const { warningStatus, remainingDays } = calculateWarningStatus(
    app.acceptTime,
    matter?.promiseDays,
    app.status,
    matter?.warningDays,
    matter?.excludeSupplementTime,
    supplementDays
  );
  
  const flowSteps = parseFlowConfig(matter?.flowConfig);
  const currentStepName = app.currentStep || getCurrentStepName(flowSteps, app.status);
  const supplementReviewContext = buildSupplementReviewContext(app, matter);
  const supplementCount = countSupplementRounds(app.id);
  
  return {
    ...app,
    matterName: matter?.name,
    applicantName: applicant?.name,
    files,
    reviewOpinions,
    warningStatus,
    remainingDays,
    promiseDays: matter?.promiseDays,
    matterWarningDays: matter?.warningDays,
    matterExcludeSupplementTime: matter?.excludeSupplementTime,
    flowSteps,
    currentStep: currentStepName,
    supplementReviewContext,
    supplementCount,
  };
}

function getApplicationFlow(app: any) {
  const matter = findMatterById(app.matterId);
  const flowSteps = parseFlowConfig(matter?.flowConfig);
  return { matter, flowSteps };
}

function getStepName(flowSteps: any[], status: ApplicationStatus): string {
  return getCurrentStepName(flowSteps, status);
}

function ensureStepOperator(req: AuthRequest, res: any, flowSteps: any[], status: ApplicationStatus): boolean {
  if (!req.user) return false;
  if (canOperateStep(flowSteps, status, req.user.role)) return true;

  const step = getStepByStatus(flowSteps, status);
  res.status(403).json({
    success: false,
    message: step ? `当前环节需由「${step.role}」角色操作` : '当前环节无可操作角色配置',
  });
  return false;
}

function notifyStepUsers(
  flowSteps: any[],
  status: ApplicationStatus,
  notification: {
    type: any;
    title: string;
    content: string;
    applicationId: string;
  }
) {
  const step = getStepByStatus(flowSteps, status);
  if (!step) return;

  listUsers({ role: step.role }).users.forEach(u => {
    createNotification({
      userId: u.id,
      ...notification,
    });
  });
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

  if (!['window', 'reviewer', 'admin'].includes(req.user.role)) {
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

    const { matter, flowSteps } = getApplicationFlow(app);
    if (!canOperateStep(flowSteps, 'submitted', req.user!.role)) {
      resultItem.success = false;
      resultItem.reason = '当前角色无权操作受理环节';
      failureCount++;
      results.push(resultItem);
      return;
    }
    const currentStepName = getStepName(flowSteps, 'accepted');

    const oldStatus = app.status;
    app = updateApplication(app.id, {
      status: 'accepted',
      windowUserId: req.user!.id,
      acceptTime: now(),
      currentStep: currentStepName,
    })!;

    createLog({
      applicationId: app.id,
      userId: req.user!.id,
      action: 'accept',
      description: `窗口批量受理申请，进入【${currentStepName}】环节`,
      oldStatus,
      newStatus: 'accepted',
    });

    createNotification({
      userId: app.applicantId,
      type: 'accept',
      title: '申请已受理',
      content: `您的「${matter?.name || ''}」申请已被窗口受理，当前环节：${currentStepName}。`,
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

  if (!['window', 'reviewer', 'admin'].includes(req.user.role)) {
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
    const { matter, flowSteps } = getApplicationFlow(app);
    if (!canOperateStep(flowSteps, app.status, req.user!.role)) {
      resultItem.success = false;
      resultItem.reason = '当前角色无权操作该流程环节';
      failureCount++;
      results.push(resultItem);
      return;
    }
    const currentStepName = getStepName(flowSteps, 'supplement');
    
    app = updateApplication(app.id, {
      status: 'supplement',
      supplementReason: reason,
      currentStep: currentStepName,
    })!;

    createLog({
      applicationId: app.id,
      userId: req.user!.id,
      action: 'supplement',
      description: `批量要求补正材料，进入【${currentStepName}】环节：${reason || ''}`,
      oldStatus,
      newStatus: 'supplement',
    });

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

  const flowSteps = parseFlowConfig(matter.flowConfig);
  const initialStepName = getCurrentStepName(flowSteps, 'draft');
  const app = createApplication({
    matterId,
    applicantId: req.user.id,
    basicInfo: basicInfo ? toJSON(basicInfo) : undefined,
    materials: materials ? toJSON(materials) : undefined,
    status: 'draft',
    currentStep: initialStepName,
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
  const matter = findMatterById(app.matterId);
  const flowSteps = parseFlowConfig(matter?.flowConfig);
  const currentStepName = getCurrentStepName(flowSteps, 'submitted');
  const isResubmit = oldStatus === 'supplement';
  const supplementRound = countSupplementRounds(app.id);
  
  app = updateApplication(app.id, {
    status: 'submitted',
    submitTime: now(),
    currentStep: currentStepName,
  })!;

  const currentUser = req.user;

  createLog({
    applicationId: app.id,
    userId: currentUser.id,
    action: isResubmit ? 'resubmit' : 'submit',
    description: isResubmit 
      ? `补正后第 ${supplementRound + 1} 次重新提交申请，进入【${currentStepName}】环节`
      : `提交申请，进入【${currentStepName}】环节`,
    oldStatus,
    newStatus: 'submitted',
  });

  if (isResubmit) {
    createNotification({
      userId: app.applicantId,
      type: 'resubmit',
      title: '补正材料已重新提交',
      content: `您的「${matter?.name || ''}」申请已完成第 ${supplementRound + 1} 次补正并重新提交，请等待审核。`,
      applicationId: app.id,
    });
    notifyStepUsers(flowSteps, 'submitted', {
      type: 'resubmit',
      title: '补正材料待复审',
      content: `申请人 ${currentUser.name} 对「${matter?.name || ''}」申请完成补正（第 ${supplementRound + 1} 次），请及时受理并复审。`,
      applicationId: app.id,
    });
  } else {
    notifyStepUsers(flowSteps, 'submitted', {
      type: 'submit',
      title: '新申请待受理',
      content: `申请人 ${currentUser.name} 提交了「${matter?.name || ''}」申请，请及时受理。`,
      applicationId: app.id,
    });
  }

  res.json({ success: true, data: enrichApplication(app), message: '提交成功' });
});

router.post('/:id/accept', authMiddleware, (req: AuthRequest, res) => {
  if (!req.user) return;

  if (!['window', 'reviewer', 'admin'].includes(req.user.role)) {
    res.status(403).json({ success: false, message: '权限不足' });
    return;
  }

  let app = findApplicationById(req.params.id);
  if (!app) {
    res.json({ success: false, message: '申请不存在' });
    return;
  }

  if (app.status !== 'submitted') {
    res.json({ success: false, message: '当前状态不能受理' });
    return;
  }

  const { matter, flowSteps } = getApplicationFlow(app);
  if (!ensureStepOperator(req, res, flowSteps, 'submitted')) return;
  const currentStepName = getStepName(flowSteps, 'accepted');

  const oldStatus = app.status;
  app = updateApplication(app.id, {
    status: 'accepted',
    windowUserId: req.user.id,
    acceptTime: now(),
    currentStep: currentStepName,
  })!;

  createLog({
    applicationId: app.id,
    userId: req.user.id,
    action: 'accept',
    description: `窗口受理申请，进入【${currentStepName}】环节`,
    oldStatus,
    newStatus: 'accepted',
  });

  createNotification({
    userId: app.applicantId,
    type: 'accept',
    title: '申请已受理',
    content: `您的「${matter?.name || ''}」申请已被窗口受理，当前环节：${currentStepName}。`,
    applicationId: app.id,
  });

  res.json({ success: true, data: enrichApplication(app), message: '受理成功' });
});

router.post('/:id/supplement', authMiddleware, (req: AuthRequest, res) => {
  if (!req.user) return;

  if (!['window', 'reviewer', 'admin'].includes(req.user.role)) {
    res.status(403).json({ success: false, message: '权限不足' });
    return;
  }

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
  const { matter, flowSteps } = getApplicationFlow(app);
  if (!ensureStepOperator(req, res, flowSteps, app.status)) return;
  const currentStepName = getStepName(flowSteps, 'supplement');
  
  app = updateApplication(app.id, {
    status: 'supplement',
    supplementReason: reason,
    currentStep: currentStepName,
  })!;

  createLog({
    applicationId: app.id,
    userId: req.user.id,
    action: 'supplement',
    description: `要求补正材料，进入【${currentStepName}】环节：${reason || ''}`,
    oldStatus,
    newStatus: 'supplement',
  });

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
  const { matter, flowSteps } = getApplicationFlow(app);
  if (!ensureStepOperator(req, res, flowSteps, app.status)) return;
  const currentStepName = getStepName(flowSteps, 'rejected');
  
  app = updateApplication(app.id, {
    status: 'rejected',
    rejectReason: reason,
    completeTime: now(),
    currentStep: currentStepName,
  })!;

  createLog({
    applicationId: app.id,
    userId: req.user.id,
    action: 'reject',
    description: `申请被退回，进入【${currentStepName}】环节：${reason || ''}`,
    oldStatus,
    newStatus: 'rejected',
  });

  createNotification({
    userId: app.applicantId,
    type: 'reject',
    title: '申请被退回',
    content: `您的「${matter?.name || ''}」申请被退回，原因：${reason || ''}`,
    applicationId: app.id,
  });

  res.json({ success: true, data: enrichApplication(app), message: '已退回申请' });
});

router.post('/:id/send-review', authMiddleware, (req: AuthRequest, res) => {
  if (!req.user) return;

  if (!['window', 'reviewer', 'admin'].includes(req.user.role)) {
    res.status(403).json({ success: false, message: '权限不足' });
    return;
  }

  let app = findApplicationById(req.params.id);
  if (!app) {
    res.json({ success: false, message: '申请不存在' });
    return;
  }

  if (app.status !== 'accepted') {
    res.json({ success: false, message: '当前状态不能送审' });
    return;
  }

  const { matter, flowSteps } = getApplicationFlow(app);
  if (!ensureStepOperator(req, res, flowSteps, 'accepted')) return;
  const currentStepName = getStepName(flowSteps, 'reviewing');

  const oldStatus = app.status;
  app = updateApplication(app.id, {
    status: 'reviewing',
    currentStep: currentStepName,
  })!;

  createLog({
    applicationId: app.id,
    userId: req.user.id,
    action: 'send_review',
    description: `材料审核通过，送交审核人员，进入【${currentStepName}】环节`,
    oldStatus,
    newStatus: 'reviewing',
  });

  notifyStepUsers(flowSteps, 'reviewing', {
    type: 'send_review',
    title: '新申请待审核',
    content: `「${matter?.name || ''}」申请已进入【${currentStepName}】环节，请及时处理。`,
    applicationId: app.id,
  });

  res.json({ success: true, data: enrichApplication(app), message: '已送审' });
});

router.post('/:id/complete', authMiddleware, (req: AuthRequest, res) => {
  if (!req.user) return;

  if (!['window', 'reviewer', 'admin'].includes(req.user.role)) {
    res.status(403).json({ success: false, message: '权限不足' });
    return;
  }

  let app = findApplicationById(req.params.id);
  if (!app) {
    res.json({ success: false, message: '申请不存在' });
    return;
  }

  if (app.status !== 'approved') {
    res.json({ success: false, message: '当前状态不能办结' });
    return;
  }

  const { matter, flowSteps } = getApplicationFlow(app);
  if (!ensureStepOperator(req, res, flowSteps, 'approved')) return;
  const currentStepName = getStepName(flowSteps, 'completed');

  const oldStatus = app.status;
  app = updateApplication(app.id, {
    status: 'completed',
    completeTime: now(),
    currentStep: currentStepName,
  })!;

  createLog({
    applicationId: app.id,
    userId: req.user.id,
    action: 'complete',
    description: `申请已办结，进入【${currentStepName}】环节`,
    oldStatus,
    newStatus: 'completed',
  });

  createNotification({
    userId: app.applicantId,
    type: 'complete',
    title: '申请已办结',
    content: `您的「${matter?.name || ''}」申请已办结，当前环节：${currentStepName}。`,
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

router.get('/:id/review-opinions', authMiddleware, (req: AuthRequest, res) => {
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

  const opinions = listReviewOpinionsByApplication(req.params.id);
  res.json({ success: true, data: opinions });
});

router.post('/:id/review-opinions', authMiddleware, (req: AuthRequest, res) => {
  if (!req.user) return;

  if (!['window', 'reviewer', 'admin'].includes(req.user.role)) {
    res.status(403).json({ success: false, message: '权限不足' });
    return;
  }

  const app = findApplicationById(req.params.id);
  if (!app) {
    res.json({ success: false, message: '申请不存在' });
    return;
  }

  if (!['submitted', 'accepted', 'reviewing'].includes(app.status)) {
    res.json({ success: false, message: '当前状态不能添加审查意见' });
    return;
  }

  const { opinions } = req.body;
  if (!opinions || !Array.isArray(opinions) || opinions.length === 0) {
    res.json({ success: false, message: '请提供审查意见' });
    return;
  }

  for (const op of opinions) {
    if (!op.materialName || !op.status) {
      res.json({ success: false, message: '材料名称和状态不能为空' });
      return;
    }
    if (op.status !== 'pass' && op.status !== 'problem') {
      res.json({ success: false, message: '状态值不正确' });
      return;
    }
  }

  const { matter, flowSteps } = getApplicationFlow(app);
  if (!ensureStepOperator(req, res, flowSteps, app.status)) return;

  const created = batchCreateReviewOpinions(
    app.id,
    opinions,
    req.user.id,
    req.user.name
  );

  createLog({
    applicationId: app.id,
    userId: req.user.id,
    action: 'review_opinion_save',
    description: `保存材料审查意见，共 ${opinions.length} 项，其中通过 ${opinions.filter((o: any) => o.status === 'pass').length} 项，存在问题 ${opinions.filter((o: any) => o.status === 'problem').length} 项`,
  });

  res.json({ success: true, data: created, message: '审查意见已保存' });
});

function generateSummaryOpinion(opinions: Array<{ materialName: string; status: string; opinion: string }>): string {
  const passItems = opinions.filter(o => o.status === 'pass');
  const problemItems = opinions.filter(o => o.status === 'problem');

  let summary = '';

  if (problemItems.length > 0) {
    summary += '存在问题的材料：\n';
    problemItems.forEach((item, idx) => {
      summary += `${idx + 1}. ${item.materialName}`;
      if (item.opinion && item.opinion.trim()) {
        summary += `：${item.opinion}`;
      }
      summary += '\n';
    });
  }

  if (passItems.length > 0) {
    if (summary) summary += '\n';
    summary += '审核通过的材料：\n';
    passItems.forEach((item, idx) => {
      summary += `${idx + 1}. ${item.materialName}`;
      if (item.opinion && item.opinion.trim()) {
        summary += `：${item.opinion}`;
      }
      summary += '\n';
    });
  }

  return summary.trim();
}

router.post('/:id/review', authMiddleware, (req: AuthRequest, res) => {
  if (!req.user) return;

  if (!['window', 'reviewer', 'admin'].includes(req.user.role)) {
    res.status(403).json({ success: false, message: '权限不足' });
    return;
  }

  const { opinion, reviewOpinions } = req.body;
  let { result, pass } = req.body;
  
  if (!result && pass !== undefined) {
    result = pass ? 'pass' : 'reject';
  }
  if (!result) {
    result = 'pass';
  }

  if (!['pass', 'supplement', 'reject'].includes(result)) {
    res.json({ success: false, message: '审核结果参数无效' });
    return;
  }

  let app = findApplicationById(req.params.id);
  if (!app) {
    res.json({ success: false, message: '申请不存在' });
    return;
  }

  if (app.status !== 'reviewing') {
    res.json({ success: false, message: '当前状态不能审核' });
    return;
  }

  const { matter, flowSteps } = getApplicationFlow(app);
  if (!ensureStepOperator(req, res, flowSteps, 'reviewing')) return;
  
  const oldStatus = app.status;
  const appId = app.id;
  const applicantId = app.applicantId;
  
  let finalOpinion = opinion || '';
  
  if (reviewOpinions && Array.isArray(reviewOpinions) && reviewOpinions.length > 0) {
    batchCreateReviewOpinions(
      appId,
      reviewOpinions,
      req.user.id,
      req.user.name
    );
    
    const summary = generateSummaryOpinion(reviewOpinions);
    if (summary) {
      finalOpinion = finalOpinion ? `${finalOpinion}\n\n${summary}` : summary;
    }
  }
  
  if (result === 'pass') {
    const currentStepName = getStepName(flowSteps, 'approved');
    const finalRound = getMaxReviewRound(appId);
    const supplementCnt = countSupplementRounds(appId);
    
    app = updateApplication(appId, {
      status: 'approved',
      reviewOpinion: finalOpinion,
      reviewerUserId: req.user.id,
      currentStep: currentStepName,
    })!;

    const passDesc = supplementCnt > 0 
      ? `经第 ${finalRound} 轮审查（共 ${supplementCnt} 次补正）后审核通过，进入【${currentStepName}】环节：${finalOpinion || ''}`
      : `审核通过，进入【${currentStepName}】环节：${finalOpinion || ''}`;

    createLog({
      applicationId: appId,
      userId: req.user.id,
      action: 'review',
      description: passDesc,
      oldStatus,
      newStatus: 'approved',
    });

    const applicantNotifyContent = supplementCnt > 0
      ? `您的「${matter?.name || ''}」申请经第 ${finalRound} 轮审查（共 ${supplementCnt} 次补正）后已审核通过，当前环节：${currentStepName}。`
      : `您的「${matter?.name || ''}」申请已审核通过，当前环节：${currentStepName}。`;

    createNotification({
      userId: applicantId,
      type: 'review_pass',
      title: supplementCnt > 0 ? '补正复审通过' : '审核通过',
      content: applicantNotifyContent,
      applicationId: appId,
    });
    notifyStepUsers(flowSteps, 'approved', {
      type: 'review_pass',
      title: supplementCnt > 0 ? '补正复审通过待办结' : '申请审核通过待办结',
      content: supplementCnt > 0
        ? `「${matter?.name || ''}」申请经第 ${finalRound} 轮审查（${supplementCnt} 次补正）后通过，已进入【${currentStepName}】环节，请及时办结。`
        : `「${matter?.name || ''}」申请已进入【${currentStepName}】环节，请及时办结。`,
      applicationId: appId,
    });
  } else if (result === 'supplement') {
    const currentStepName = getStepName(flowSteps, 'supplement');
    const finalRound = getMaxReviewRound(appId);
    const supplementCnt = countSupplementRounds(appId);

    app = updateApplication(appId, {
      status: 'supplement',
      reviewOpinion: finalOpinion,
      reviewerUserId: req.user.id,
      supplementReason: finalOpinion,
      currentStep: currentStepName,
    })!;

    createLog({
      applicationId: appId,
      userId: req.user.id,
      action: 'review_supplement',
      description: `第 ${finalRound} 轮审查后要求继续补正（第 ${supplementCnt} 次补正），进入【${currentStepName}】环节：${finalOpinion || ''}`,
      oldStatus,
      newStatus: 'supplement',
    });

    createNotification({
      userId: applicantId,
      type: 'review_supplement',
      title: `第 ${supplementCnt} 次补正要求`,
      content: `您的「${matter?.name || ''}」申请经第 ${finalRound} 轮审查后需要继续补正材料（第 ${supplementCnt} 次补正）：${finalOpinion || ''}，请按要求修改后重新提交。`,
      applicationId: appId,
    });
  } else {
    const currentStepName = getStepName(flowSteps, 'rejected');
    const finalRound = getMaxReviewRound(appId);
    const supplementCnt = countSupplementRounds(appId);

    app = updateApplication(appId, {
      status: 'rejected',
      reviewOpinion: finalOpinion,
      reviewerUserId: req.user.id,
      rejectReason: finalOpinion,
      completeTime: now(),
      currentStep: currentStepName,
    })!;

    const rejectDesc = supplementCnt > 0
      ? `经第 ${finalRound} 轮审查（共 ${supplementCnt} 次补正）后审核不通过，进入【${currentStepName}】环节：${finalOpinion || ''}`
      : `审核不通过，进入【${currentStepName}】环节：${finalOpinion || ''}`;

    createLog({
      applicationId: appId,
      userId: req.user.id,
      action: 'review',
      description: rejectDesc,
      oldStatus,
      newStatus: 'rejected',
    });

    const rejectNotifyContent = supplementCnt > 0
      ? `您的「${matter?.name || ''}」申请经第 ${finalRound} 轮审查（共 ${supplementCnt} 次补正）后审核不通过，原因：${finalOpinion || ''}`
      : `您的「${matter?.name || ''}」申请审核不通过，原因：${finalOpinion || ''}`;

    createNotification({
      userId: applicantId,
      type: 'review_reject',
      title: supplementCnt > 0 ? '补正复审不通过' : '审核不通过',
      content: rejectNotifyContent,
      applicationId: appId,
    });
  }

  res.json({ success: true, data: enrichApplication(app), message: '审核完成' });
});

export default router;
