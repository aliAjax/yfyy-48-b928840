import { Router } from 'express';
import {
  findTemplateById,
  listTemplates,
  createTemplate,
  updateTemplate,
  deleteTemplate,
} from '../dao/templateDao';
import { findMatterById } from '../dao/matterDao';
import { findUserById } from '../dao/userDao';
import { createApplication } from '../dao/applicationDao';
import { createLog } from '../dao/logDao';
import { authMiddleware, requireRole, AuthRequest } from '../middleware/auth';
import { toJSON } from '../utils/helpers';

const router = Router();

function enrichTemplate(template: any) {
  const matter = findMatterById(template.matterId);
  const user = findUserById(template.userId);

  return {
    ...template,
    matterName: matter?.name,
    userName: user?.name,
  };
}

router.get('/', authMiddleware, requireRole('applicant'), (req: AuthRequest, res) => {
  if (!req.user) return;

  const { matterId, keyword, page = 1, pageSize = 10 } = req.query;

  const result = listTemplates({
    userId: req.user.id,
    matterId: matterId as string,
    keyword: keyword as string,
    page: Number(page),
    pageSize: Number(pageSize),
  });

  const enriched = result.templates.map(enrichTemplate);

  res.json({
    success: true,
    data: enriched,
    total: result.total,
  });
});

router.get('/:id', authMiddleware, requireRole('applicant'), (req: AuthRequest, res) => {
  if (!req.user) return;

  const template = findTemplateById(req.params.id);
  if (!template) {
    res.json({ success: false, message: '模板不存在' });
    return;
  }

  if (template.userId !== req.user.id) {
    res.status(403).json({ success: false, message: '无权查看此模板' });
    return;
  }

  res.json({ success: true, data: enrichTemplate(template) });
});

router.post('/', authMiddleware, requireRole('applicant'), (req: AuthRequest, res) => {
  if (!req.user) return;

  const { name, matterId, basicInfo, materials } = req.body;

  if (!name || !matterId) {
    res.json({ success: false, message: '模板名称和事项不能为空' });
    return;
  }

  const matter = findMatterById(matterId);
  if (!matter || matter.status !== 'active') {
    res.json({ success: false, message: '事项不存在或未启用' });
    return;
  }

  const template = createTemplate({
    name,
    matterId,
    userId: req.user.id,
    basicInfo: basicInfo ? toJSON(basicInfo) : undefined,
    materials: materials ? toJSON(materials) : undefined,
  });

  res.json({ success: true, data: enrichTemplate(template), message: '模板创建成功' });
});

router.put('/:id', authMiddleware, requireRole('applicant'), (req: AuthRequest, res) => {
  if (!req.user) return;

  const { id } = req.params;
  const { name, basicInfo, materials } = req.body;

  let template = findTemplateById(id);
  if (!template) {
    res.json({ success: false, message: '模板不存在' });
    return;
  }

  if (template.userId !== req.user.id) {
    res.status(403).json({ success: false, message: '无权操作此模板' });
    return;
  }

  template = updateTemplate(id, {
    name,
    basicInfo: basicInfo ? toJSON(basicInfo) : undefined,
    materials: materials ? toJSON(materials) : undefined,
  })!;

  res.json({ success: true, data: enrichTemplate(template), message: '模板更新成功' });
});

router.delete('/:id', authMiddleware, requireRole('applicant'), (req: AuthRequest, res) => {
  if (!req.user) return;

  const template = findTemplateById(req.params.id);
  if (!template) {
    res.json({ success: false, message: '模板不存在' });
    return;
  }

  if (template.userId !== req.user.id) {
    res.status(403).json({ success: false, message: '无权操作此模板' });
    return;
  }

  const success = deleteTemplate(req.params.id);
  res.json({ success, message: success ? '删除成功' : '删除失败' });
});

router.post('/:id/copy', authMiddleware, requireRole('applicant'), (req: AuthRequest, res) => {
  if (!req.user) return;

  const template = findTemplateById(req.params.id);
  if (!template) {
    res.json({ success: false, message: '模板不存在' });
    return;
  }

  if (template.userId !== req.user.id) {
    res.status(403).json({ success: false, message: '无权操作此模板' });
    return;
  }

  const matter = findMatterById(template.matterId);
  if (!matter || matter.status !== 'active') {
    res.json({ success: false, message: '事项不存在或未启用' });
    return;
  }

  const newTemplate = createTemplate({
    name: `${template.name} - 副本`,
    matterId: template.matterId,
    userId: req.user.id,
    basicInfo: template.basicInfo,
    materials: template.materials,
  });

  res.json({ success: true, data: enrichTemplate(newTemplate), message: '模板复制成功' });
});

router.post('/:id/apply', authMiddleware, requireRole('applicant'), (req: AuthRequest, res) => {
  if (!req.user) return;

  const template = findTemplateById(req.params.id);
  if (!template) {
    res.json({ success: false, message: '模板不存在' });
    return;
  }

  if (template.userId !== req.user.id) {
    res.status(403).json({ success: false, message: '无权使用此模板' });
    return;
  }

  const matter = findMatterById(template.matterId);
  if (!matter || matter.status !== 'active') {
    res.json({ success: false, message: '事项不存在或未启用' });
    return;
  }

  const app = createApplication({
    matterId: template.matterId,
    applicantId: req.user.id,
    basicInfo: template.basicInfo,
    materials: template.materials,
    status: 'draft',
  });

  createLog({
    applicationId: app.id,
    userId: req.user.id,
    action: 'create_from_template',
    description: `从模板「${template.name}」创建申请`,
  });

  const enrichedApp = {
    ...app,
    matterName: matter?.name,
    applicantName: req.user.name,
    files: [],
  };

  res.json({ success: true, data: enrichedApp, message: '已从模板创建申请草稿' });
});

export default router;
