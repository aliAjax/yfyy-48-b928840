import request from '../utils/request';
import { Notification, NotificationType, ApiResponse } from '../types';

export const getUnreadCount = async (): Promise<{ count: number }> => {
  const res = await request.get<any, ApiResponse<{ count: number }>>('/notifications/unread-count');
  return res.data || { count: 0 };
};

export const getNotifications = async (params?: {
  page?: number;
  pageSize?: number;
  type?: NotificationType[];
  isRead?: boolean;
}): Promise<{ data: Notification[]; total: number }> => {
  const queryParams = params
    ? {
        ...params,
        type: params.type && params.type.length > 0 ? params.type.join(',') : undefined,
      }
    : undefined;
  const res = await request.get<any, ApiResponse<Notification[]>>('/notifications', { params: queryParams });
  return {
    data: res.data || [],
    total: res.total || 0,
  };
};

export const markAsRead = async (id: string): Promise<void> => {
  await request.put(`/notifications/${id}/read`);
};

export const markAllAsRead = async (type?: NotificationType[]): Promise<{ count: number }> => {
  const res = await request.put<any, ApiResponse<{ count: number }>>('/notifications/read-all', {
    type: type && type.length > 0 ? type.join(',') : undefined,
  });
  return res.data || { count: 0 };
};
