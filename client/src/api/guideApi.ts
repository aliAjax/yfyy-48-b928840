import request from '../utils/request';
import { Matter, ApiResponse } from '../types';

export function listGuideMatters(params?: {
  department?: string;
  keyword?: string;
  page?: number;
  pageSize?: number;
}): Promise<ApiResponse<Matter[]>> {
  return request.get('/guide/matters', { params });
}

export function getGuideMatter(id: string): Promise<ApiResponse<Matter>> {
  return request.get(`/guide/matters/${id}`);
}

export function listDepartments(): Promise<ApiResponse<string[]>> {
  return request.get('/guide/departments');
}
