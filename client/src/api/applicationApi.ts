import request from '../utils/request';
import { Application, ApiResponse, ApplicationStatus, WarningStatus, BatchOperationResult, ReviewOpinion, ReviewOpinionFormData } from '../types';

export function listApplications(params?: {
  status?: ApplicationStatus;
  keyword?: string;
  matterId?: string;
  warningStatus?: WarningStatus;
  operatorUserId?: string;
  materialCompleteness?: string;
  hasSupplement?: boolean;
  supplementReason?: string;
  applicationIds?: string[];
  page?: number;
  pageSize?: number;
}): Promise<ApiResponse<Application[]>> {
  const reqParams: any = { ...params };
  if (params?.applicationIds && params.applicationIds.length > 0) {
    reqParams.applicationIds = params.applicationIds.join(',');
  }
  return request.get('/applications', { params: reqParams });
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
  reviewOpinions?: ReviewOpinionFormData[];
}): Promise<ApiResponse<Application>> {
  return request.post(`/applications/${id}/review`, data);
}

export function getReviewOpinions(id: string): Promise<ApiResponse<ReviewOpinion[]>> {
  return request.get(`/applications/${id}/review-opinions`);
}

export function saveReviewOpinions(id: string, opinions: ReviewOpinionFormData[]): Promise<ApiResponse<ReviewOpinion[]>> {
  return request.post(`/applications/${id}/review-opinions`, { opinions });
}

export function completeApplication(id: string): Promise<ApiResponse<Application>> {
  return request.post(`/applications/${id}/complete`);
}

export function getApplicationLogs(id: string): Promise<ApiResponse<any[]>> {
  return request.get(`/applications/${id}/logs`);
}

export function getWarningList(params?: {
  warningStatus?: WarningStatus;
  keyword?: string;
  operatorUserId?: string;
  page?: number;
  pageSize?: number;
}): Promise<ApiResponse<Application[]>> {
  return request.get('/applications/warning/list', { params });
}

export function getWarningStats(params?: {
  operatorUserId?: string;
}): Promise<ApiResponse<{
  total: number;
  normal: number;
  warning: number;
  overdue: number;
}>> {
  return request.get('/applications/warning/stats', { params });
}

export function batchAcceptApplications(ids: string[]): Promise<ApiResponse<BatchOperationResult>> {
  return request.post('/applications/batch/accept', { ids });
}

export function batchSupplementApplications(ids: string[], reason: string): Promise<ApiResponse<BatchOperationResult>> {
  return request.post('/applications/batch/supplement', { ids, reason });
}
