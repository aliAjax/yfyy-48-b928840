import { Router } from 'express';
import { authMiddleware, requireRole, AuthRequest } from '../middleware/auth';
import { listLogs } from '../dao/logDao';

const router = Router();

router.get('/', authMiddleware, requireRole('admin', 'window', 'reviewer'), (req: AuthRequest, res) => {
  if (!req.user) return;

  const { applicationId, page = 1, pageSize = 20 } = req.query;

  const result = listLogs({
    applicationId: applicationId as string,
    page: Number(page),
    pageSize: Number(pageSize),
  });

  res.json({
    success: true,
    data: result.logs,
    total: result.total,
  });
});

export default router;
