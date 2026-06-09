import request from '../utils/request';
import { ApplicationTemplate, ApiResponse, Application } from '../types';

export function listTemplates(params?: {
  matterId?: string;
  keyword?: string;
  page?: number;
  pageSize?: number;
}): Promise<ApiResponse<ApplicationTemplate[]>> {
  return request.get('/templates', { params });
}

export function getTemplate(id: string): Promise<ApiResponse<ApplicationTemplate>> {
  return request.get(`/templates/${id}`);
}

export function createTemplate(data: {
  name: string;
  matterId: string;
  basicInfo?: Record<string, any>;
  materials?: any[];
}): Promise<ApiResponse<ApplicationTemplate>> {
  return request.post('/templates', data);
}

export function updateTemplate(id: string, data: {
  name?: string;
  basicInfo?: Record<string, any>;
  materials?: any[];
}): Promise<ApiResponse<ApplicationTemplate>> {
  return request.put(`/templates/${id}`, data);
}

export function deleteTemplate(id: string): Promise<ApiResponse<boolean>> {
  return request.delete(`/templates/${id}`);
}

export function applyTemplate(id: string): Promise<ApiResponse<Application>> {
  return request.post(`/templates/${id}/apply`);
}
