import { Router } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { 
  listNotifications, 
  getUnreadCount, 
  markAsRead, 
  markAllAsRead 
} from '../dao/notificationDao';
import { NotificationType } from '../types';

const router = Router();

const notificationTypes: NotificationType[] = [
  'submit',
  'accept',
  'supplement',
  'reject',
  'review_pass',
  'review_reject',
  'send_review',
  'complete',
];

function parseTypes(type?: unknown): NotificationType[] | undefined {
  if (typeof type !== 'string') return undefined;

  const types = type
    .split(',')
    .map(item => item.trim())
    .filter((item): item is NotificationType => notificationTypes.includes(item as NotificationType));

  return types.length > 0 ? types : undefined;
}

router.get('/unread-count', authMiddleware, (req: AuthRequest, res) => {
  if (!req.user) return;

  const count = getUnreadCount(req.user.id);
  res.json({ success: true, data: { count } });
});

router.get('/', authMiddleware, (req: AuthRequest, res) => {
  if (!req.user) return;

  const { page = 1, pageSize = 10, isRead, type } = req.query;

  const result = listNotifications({
    userId: req.user.id,
    types: parseTypes(type),
    isRead: isRead !== undefined ? isRead === 'true' : undefined,
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

  const count = markAllAsRead(req.user.id, parseTypes(req.body?.type));
  res.json({ success: true, data: { count }, message: `已标记 ${count} 条为已读` });
});

export default router;
