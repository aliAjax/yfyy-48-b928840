import request from '../utils/request';
import { User, ApiResponse } from '../types';

export interface LoginData {
  username: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: User;
}

export function login(data: LoginData): Promise<ApiResponse<LoginResponse>> {
  return request.post('/users/login', data);
}

export function register(data: {
  username: string;
  password: string;
  name: string;
  phone?: string;
  idCard?: string;
}): Promise<ApiResponse<LoginResponse>> {
  return request.post('/users/register', data);
}

export function getCurrentUser(): Promise<ApiResponse<User>> {
  return request.get('/users/me');
}

export function listUsers(params?: {
  role?: string;
  page?: number;
  pageSize?: number;
}): Promise<ApiResponse<User[]>> {
  return request.get('/users', { params });
}

export function updateUser(id: string, data: Partial<User>): Promise<ApiResponse<User>> {
  return request.put(`/users/${id}`, data);
}

export function deleteUser(id: string): Promise<ApiResponse> {
  return request.delete(`/users/${id}`);
}
