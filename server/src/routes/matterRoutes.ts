import { Router } from 'express';
import { findMatterById, listMatters, createMatter, updateMatter, deleteMatter } from '../dao/matterDao';
import { authMiddleware, requireRole, AuthRequest } from '../middleware/auth';

const router = Router();

router.get('/', authMiddleware, (req, res) => {
  const { status, keyword, page = 1, pageSize = 10 } = req.query;
  
  const result = listMatters({
    status: status as string,
    keyword: keyword as string,
    page: Number(page),
    pageSize: Number(pageSize),
  });

  res.json({
    success: true,
    data: result.matters,
    total: result.total,
  });
});

router.get('/:id', authMiddleware, (req, res) => {
  const matter = findMatterById(req.params.id);
  if (!matter) {
    res.json({ success: false, message: '事项不存在' });
    return;
  }
  res.json({ success: true, data: matter });
});

router.post('/', authMiddleware, requireRole('admin'), (req, res) => {
  const { code, name, department, description, requiredMaterials, promiseDays, flowConfig, status } = req.body;

  if (!code || !name || !department || !promiseDays) {
    res.json({ success: false, message: '请填写必填项' });
    return;
  }

  const matter = createMatter({
    code,
    name,
    department,
    description,
    requiredMaterials,
    promiseDays: Number(promiseDays),
    flowConfig,
    status,
  });

  res.json({ success: true, data: matter, message: '创建成功' });
});

router.put('/:id', authMiddleware, requireRole('admin'), (req, res) => {
  const { id } = req.params;
  const { code, name, department, description, requiredMaterials, promiseDays, flowConfig, status } = req.body;

  const matter = updateMatter(id, {
    code,
    name,
    department,
    description,
    requiredMaterials,
    promiseDays: promiseDays ? Number(promiseDays) : undefined,
    flowConfig,
    status,
  });

  if (!matter) {
    res.json({ success: false, message: '事项不存在' });
    return;
  }

  res.json({ success: true, data: matter, message: '更新成功' });
});

router.delete('/:id', authMiddleware, requireRole('admin'), (req, res) => {
  const { id } = req.params;
  const success = deleteMatter(id);
  res.json({ success, message: success ? '删除成功' : '删除失败' });
});

export default router;
