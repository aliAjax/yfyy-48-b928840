import request from '../utils/request';
import { Notification, ApiResponse } from '../types';

export const getUnreadCount = async (): Promise<{ count: number }> => {
  const res = await request.get<any, ApiResponse<{ count: number }>>('/notifications/unread-count');
  return res.data || { count: 0 };
};

export const getNotifications = async (params?: {
  page?: number;
  pageSize?: number;
  isRead?: boolean;
}): Promise<{ data: Notification[]; total: number }> => {
  const res = await request.get<any, ApiResponse<Notification[]>>('/notifications', {
    params,
  });
  return {
    data: res.data || [],
    total: res.total || 0,
  };
};

export const markAsRead = async (id: string): Promise<void> => {
  await request.put(`/notifications/${id}/read`);
};

export const markAllAsRead = async (): Promise<{ count: number }> => {
  const res = await request.put<any, ApiResponse<{ count: number }>>('/notifications/read-all');
  return res.data || { count: 0 };
};
