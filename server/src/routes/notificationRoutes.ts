import { Router } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { 
  listNotifications, 
  getUnreadCount, 
  markAsRead, 
  markAllAsRead 
} from '../dao/notificationDao';

const router = Router();

router.get('/unread-count', authMiddleware, (req: AuthRequest, res) => {
  if (!req.user) return;

  const count = getUnreadCount(req.user.id);
  res.json({ success: true, data: { count } });
});

router.get('/', authMiddleware, (req: AuthRequest, res) => {
  if (!req.user) return;

  const { page = 1, pageSize = 10, isRead, type } = req.query;

  let types: string[] | undefined;
  if (type) {
    types = Array.isArray(type) ? type.map(String) : String(type).split(',');
  }

  const result = listNotifications({
    userId: req.user.id,
    isRead: isRead !== undefined ? isRead === 'true' : undefined,
    types,
    page: Number(page),
    pageSize: Number(pageSize),
  });

  res.json({
    success: true,
    data: result.notifications,
    total: result.total,
  });
});

router.put('/:id/read', authMiddleware, (req: AuthRequest, res) => {
  if (!req.user) return;

  const success = markAsRead(req.params.id, req.user.id);
  if (success) {
    res.json({ success: true, message: '标记已读成功' });
  } else {
    res.json({ success: false, message: '通知不存在' });
  }
});

router.put('/read-all', authMiddleware, (req: AuthRequest, res) => {
  if (!req.user) return;

  const { type } = req.body || {};

  let types: string[] | undefined;
  if (type) {
    types = Array.isArray(type) ? type.map(String) : String(type).split(',');
  }

  const count = markAllAsRead(req.user.id, types);
  res.json({ success: true, data: { count }, message: `已标记 ${count} 条为已读` });
});

export default router;
