import { Router } from 'express';
import { findUserByUsername, createUser, verifyPassword, findUserById, listUsers, updateUser, deleteUser } from '../dao/userDao';
import { authMiddleware, signToken, AuthRequest, requireRole } from '../middleware/auth';

const router = Router();

router.post('/login', (req, res) => {
  const { username, password } = req.body;
  
  if (!username || !password) {
    res.json({ success: false, message: '用户名和密码不能为空' });
    return;
  }

  const user = findUserByUsername(username);
  if (!user) {
    res.json({ success: false, message: '用户名或密码错误' });
    return;
  }

  if (!verifyPassword(user, password)) {
    res.json({ success: false, message: '用户名或密码错误' });
    return;
  }

  const token = signToken(user.id);
  const { password: _, ...userWithoutPassword } = user;
  
  res.json({
    success: true,
    data: {
      token,
      user: userWithoutPassword,
    },
    message: '登录成功',
  });
});

router.get('/me', authMiddleware, (req: AuthRequest, res) => {
  if (!req.user) {
    res.status(401).json({ success: false, message: '未登录' });
    return;
  }
  const { password: _, ...userWithoutPassword } = req.user;
  res.json({ success: true, data: userWithoutPassword });
});

router.post('/register', (req, res) => {
  const { username, password, name, phone, idCard } = req.body;

  if (!username || !password || !name) {
    res.json({ success: false, message: '用户名、密码和姓名不能为空' });
    return;
  }

  const existing = findUserByUsername(username);
  if (existing) {
    res.json({ success: false, message: '用户名已存在' });
    return;
  }

  const user = createUser({
    username,
    password,
    name,
    role: 'applicant',
    phone,
    idCard,
  });

  const token = signToken(user.id);
  const { password: _, ...userWithoutPassword } = user;

  res.json({
    success: true,
    data: { token, user: userWithoutPassword },
    message: '注册成功',
  });
});

router.get('/', authMiddleware, requireRole('admin'), (req, res) => {
  const { role, page = 1, pageSize = 10 } = req.query;
  const result = listUsers({
    role: role as any,
    page: Number(page),
    pageSize: Number(pageSize),
  });

  const usersWithoutPassword = result.users.map(u => {
    const { password: _, ...rest } = u;
    return rest;
  });

  res.json({
    success: true,
    data: usersWithoutPassword,
    total: result.total,
  });
});

router.put('/:id', authMiddleware, requireRole('admin'), (req, res) => {
  const { id } = req.params;
  const { name, phone, idCard, role } = req.body;

  const user = updateUser(id, { name, phone, idCard, role });
  if (!user) {
    res.json({ success: false, message: '用户不存在' });
    return;
  }

  const { password: _, ...userWithoutPassword } = user;
  res.json({ success: true, data: userWithoutPassword, message: '更新成功' });
});

router.delete('/:id', authMiddleware, requireRole('admin'), (req, res) => {
  const { id } = req.params;
  const success = deleteUser(id);
  res.json({ success, message: success ? '删除成功' : '删除失败' });
});

export default router;
