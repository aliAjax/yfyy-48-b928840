import request from '../utils/request';
import { MaterialFile, ApiResponse } from '../types';

export function uploadFile(applicationId: string, file: File, onProgress?: (percent: number) => void): Promise<ApiResponse<MaterialFile>> {
  const formData = new FormData();
  formData.append('file', file);

  return request.post(`/files/upload/${applicationId}`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
    onUploadProgress: (progressEvent: any) => {
      if (onProgress && progressEvent.total) {
        const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
        onProgress(percent);
      }
    },
  });
}

export function listFiles(applicationId: string): Promise<ApiResponse<MaterialFile[]>> {
  return request.get(`/files/application/${applicationId}`);
}

export function getDownloadUrl(fileId: string): string {
  return `/api/files/download/${fileId}`;
}

export function deleteFile(id: string): Promise<ApiResponse> {
  return request.delete(`/files/${id}`);
}
