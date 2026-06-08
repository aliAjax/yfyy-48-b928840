import request from '../utils/request';
import { Application, ApiResponse, ApplicationStatus } from '../types';

export function listApplications(params?: {
  status?: ApplicationStatus;
  keyword?: string;
  matterId?: string;
  page?: number;
  pageSize?: number;
}): Promise<ApiResponse<Application[]>> {
  return request.get('/applications', { params });
}

export function getApplication(id: string): Promise<ApiResponse<Application>> {
  return request.get(`/applications/${id}`);
}

export function createApplication(data: {
  matterId: string;
  basicInfo?: Record<string, any>;
  materials?: any[];
}): Promise<ApiResponse<Application>> {
  return request.post('/applications', data);
}

export function updateApplication(id: string, data: {
  basicInfo?: Record<string, any>;
  materials?: any[];
}): Promise<ApiResponse<Application>> {
  return request.put(`/applications/${id}`, data);
}

export function submitApplication(id: string): Promise<ApiResponse<Application>> {
  return request.post(`/applications/${id}/submit`);
}

export function acceptApplication(id: string): Promise<ApiResponse<Application>> {
  return request.post(`/applications/${id}/accept`);
}

export function supplementApplication(id: string, reason: string): Promise<ApiResponse<Application>> {
  return request.post(`/applications/${id}/supplement`, { reason });
}

export function rejectApplication(id: string, reason: string): Promise<ApiResponse<Application>> {
  return request.post(`/applications/${id}/reject`, { reason });
}

export function sendReviewApplication(id: string): Promise<ApiResponse<Application>> {
  return request.post(`/applications/${id}/send-review`);
}

export function reviewApplication(id: string, data: {
  pass: boolean;
  opinion: string;
}): Promise<ApiResponse<Application>> {
  return request.post(`/applications/${id}/review`, data);
}

export function completeApplication(id: string): Promise<ApiResponse<Application>> {
  return request.post(`/applications/${id}/complete`);
}

export function getApplicationLogs(id: string): Promise<ApiResponse<any[]>> {
  return request.get(`/applications/${id}/logs`);
}
