import request from '../utils/request';
import { Matter, ApiResponse } from '../types';

export function listMatters(params?: {
  status?: string;
  keyword?: string;
  page?: number;
  pageSize?: number;
}): Promise<ApiResponse<Matter[]>> {
  return request.get('/matters', { params });
}

export function getMatter(id: string): Promise<ApiResponse<Matter>> {
  return request.get(`/matters/${id}`);
}

export function createMatter(data: Partial<Matter>): Promise<ApiResponse<Matter>> {
  return request.post('/matters', data);
}

export function updateMatter(id: string, data: Partial<Matter>): Promise<ApiResponse<Matter>> {
  return request.put(`/matters/${id}`, data);
}

export function deleteMatter(id: string): Promise<ApiResponse> {
  return request.delete(`/matters/${id}`);
}
