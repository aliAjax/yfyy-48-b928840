import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { findUserById } from '../dao/userDao';
import { User, UserRole } from '../types';

const JWT_SECRET = process.env.JWT_SECRET || 'approval-system-secret-key-2024';

export interface AuthRequest extends Request {
  user?: User;
}

export function signToken(userId: string): string {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '7d' });
}

export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ success: false, message: '未提供认证令牌' });
    return;
  }

  const token = authHeader.substring(7);
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
    const user = findUserById(decoded.userId);
    if (!user) {
      res.status(401).json({ success: false, message: '用户不存在' });
      return;
    }
    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({ success: false, message: '认证令牌无效或已过期' });
  }
}

export function requireRole(...roles: UserRole[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      res.status(401).json({ success: false, message: '未登录' });
      return;
    }
    if (!roles.includes(req.user.role)) {
      res.status(403).json({ success: false, message: '权限不足' });
      return;
    }
    next();
  };
}
