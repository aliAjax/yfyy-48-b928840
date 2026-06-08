import request from '../utils/request';
import { ApiResponse, OperationLog } from '../types';

export function listLogs(params?: {
  applicationId?: string;
  page?: number;
  pageSize?: number;
}): Promise<ApiResponse<OperationLog[]>> {
  return request.get('/logs', { params });
}
