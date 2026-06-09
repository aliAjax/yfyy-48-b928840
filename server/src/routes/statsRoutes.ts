import { Router } from 'express';
import { authMiddleware, requireRole, AuthRequest } from '../middleware/auth';
import {
  getStatsOverview,
  getDailyTrend,
  getMatterRank,
  getDepartmentStats,
  getStatusStats,
  getDepartmentList,
  getUserStats,
  getWarningStats,
  getMonthlyTrend,
  getSupplementStats,
  getFullOverview,
  getSupplementAnalysis,
} from '../dao/statsDao';
import { StatsFilterParams } from '../types';

const router = Router();

function getFilterParams(req: AuthRequest): StatsFilterParams {
  return {
    startDate: req.query.startDate as string,
    endDate: req.query.endDate as string,
    department: req.query.department as string,
    matterId: req.query.matterId as string,
    status: req.query.status as string,
  };
}

router.get('/overview', authMiddleware, requireRole('admin'), (req: AuthRequest, res) => {
  const data = getStatsOverview(getFilterParams(req));
  res.json({ success: true, data });
});

router.get('/full-overview', authMiddleware, requireRole('admin'), (req: AuthRequest, res) => {
  const data = getFullOverview(getFilterParams(req));
  res.json({ success: true, data });
});

router.get('/daily-trend', authMiddleware, requireRole('admin'), (req: AuthRequest, res) => {
  const data = getDailyTrend(getFilterParams(req));
  res.json({ success: true, data });
});

router.get('/monthly-trend', authMiddleware, requireRole('admin'), (req: AuthRequest, res) => {
  const data = getMonthlyTrend(getFilterParams(req));
  res.json({ success: true, data });
});

router.get('/matter-rank', authMiddleware, requireRole('admin'), (req: AuthRequest, res) => {
  const params = getFilterParams(req);
  const limit = req.query.limit ? Number(req.query.limit) : undefined;
  const data = getMatterRank(params, limit);
  res.json({ success: true, data });
});

router.get('/department-stats', authMiddleware, requireRole('admin'), (req: AuthRequest, res) => {
  const data = getDepartmentStats(getFilterParams(req));
  res.json({ success: true, data });
});

router.get('/status-stats', authMiddleware, requireRole('admin'), (req: AuthRequest, res) => {
  const data = getStatusStats(getFilterParams(req));
  res.json({ success: true, data });
});

router.get('/user-stats', authMiddleware, requireRole('admin'), (req: AuthRequest, res) => {
  const role = req.query.role as string | undefined;
  const data = getUserStats(getFilterParams(req), role);
  res.json({ success: true, data });
});

router.get('/warning-stats', authMiddleware, requireRole('admin'), (req: AuthRequest, res) => {
  const data = getWarningStats(getFilterParams(req));
  res.json({ success: true, data });
});

router.get('/supplement-stats', authMiddleware, requireRole('admin'), (req: AuthRequest, res) => {
  const data = getSupplementStats(getFilterParams(req));
  res.json({ success: true, data });
});

router.get('/departments', authMiddleware, requireRole('admin'), (req: AuthRequest, res) => {
  const data = getDepartmentList();
  res.json({ success: true, data });
});

router.get('/supplement-analysis', authMiddleware, requireRole('admin'), (req: AuthRequest, res) => {
  const data = getSupplementAnalysis(getFilterParams(req));
  res.json({ success: true, data });
});

export default router;
