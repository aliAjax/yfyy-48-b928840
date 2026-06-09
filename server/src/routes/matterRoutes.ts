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
  const { code, name, department, description, requiredMaterials, promiseDays, warningDays, excludeSupplementTime, flowConfig, status } = req.body;

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
    warningDays: warningDays !== undefined && warningDays !== null ? Number(warningDays) : undefined,
    excludeSupplementTime: excludeSupplementTime === true || excludeSupplementTime === 1 || excludeSupplementTime === '1',
    flowConfig,
    status,
  });

  res.json({ success: true, data: matter, message: '创建成功' });
});

router.put('/:id', authMiddleware, requireRole('admin'), (req, res) => {
  const { id } = req.params;
  const { code, name, department, description, requiredMaterials, promiseDays, warningDays, excludeSupplementTime, flowConfig, status } = req.body;

  const updateData: Partial<{
    code: string;
    name: string;
    department: string;
    description: string;
    requiredMaterials: string;
    promiseDays: number;
    warningDays: number;
    excludeSupplementTime: boolean;
    flowConfig: string;
    status: string;
  }> = {
    code,
    name,
    department,
    description,
    requiredMaterials,
    flowConfig,
    status,
  };

  if (promiseDays !== undefined && promiseDays !== null) {
    updateData.promiseDays = Number(promiseDays);
  }
  if (warningDays !== undefined) {
    updateData.warningDays = warningDays === null ? null as any : Number(warningDays);
  }
  if (excludeSupplementTime !== undefined) {
    updateData.excludeSupplementTime = excludeSupplementTime === true || excludeSupplementTime === 1 || excludeSupplementTime === '1';
  }

  const matter = updateMatter(id, updateData);

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
