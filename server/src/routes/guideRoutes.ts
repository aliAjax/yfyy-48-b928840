import { Router } from 'express';
import { findMatterById, listMatters, listDepartments } from '../dao/matterDao';
import { authMiddleware } from '../middleware/auth';

const router = Router();

router.get('/matters', authMiddleware, (req, res) => {
  const { department, keyword, page = 1, pageSize = 10 } = req.query;

  const result = listMatters({
    status: 'active',
    department: department as string,
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

router.get('/matters/:id', authMiddleware, (req, res) => {
  const matter = findMatterById(req.params.id);
  if (!matter || matter.status !== 'active') {
    res.json({ success: false, message: '事项不存在或未启用' });
    return;
  }
  res.json({ success: true, data: matter });
});

router.get('/departments', authMiddleware, (req, res) => {
  const departments = listDepartments();
  res.json({ success: true, data: departments });
});

export default router;
