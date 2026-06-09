import request from '../utils/request';
import {
  StatsOverview,
  DailyTrendItem,
  MatterRankItem,
  DepartmentStatsItem,
  StatusStatsItem,
  StatsFilterParams,
  ApiResponse,
  UserStatsItem,
  WarningStats,
  MonthlyTrendItem,
  SupplementStats,
  FullStatsOverview,
  SupplementAnalysisData,
} from '../types';

export function getStatsOverview(params?: StatsFilterParams): Promise<ApiResponse<StatsOverview>> {
  return request.get('/stats/overview', { params });
}

export function getFullOverview(params?: StatsFilterParams): Promise<ApiResponse<FullStatsOverview>> {
  return request.get('/stats/full-overview', { params });
}

export function getDailyTrend(params?: StatsFilterParams): Promise<ApiResponse<DailyTrendItem[]>> {
  return request.get('/stats/daily-trend', { params });
}

export function getMonthlyTrend(params?: StatsFilterParams): Promise<ApiResponse<MonthlyTrendItem[]>> {
  return request.get('/stats/monthly-trend', { params });
}

export function getMatterRank(params?: StatsFilterParams & { limit?: number }): Promise<ApiResponse<MatterRankItem[]>> {
  return request.get('/stats/matter-rank', { params });
}

export function getDepartmentStats(params?: StatsFilterParams): Promise<ApiResponse<DepartmentStatsItem[]>> {
  return request.get('/stats/department-stats', { params });
}

export function getStatusStats(params?: StatsFilterParams): Promise<ApiResponse<StatusStatsItem[]>> {
  return request.get('/stats/status-stats', { params });
}

export function getUserStats(params?: StatsFilterParams & { role?: string }): Promise<ApiResponse<UserStatsItem[]>> {
  return request.get('/stats/user-stats', { params });
}

export function getWarningStats(params?: StatsFilterParams): Promise<ApiResponse<WarningStats>> {
  return request.get('/stats/warning-stats', { params });
}

export function getSupplementStats(params?: StatsFilterParams): Promise<ApiResponse<SupplementStats>> {
  return request.get('/stats/supplement-stats', { params });
}

export function getSupplementAnalysis(params?: StatsFilterParams): Promise<ApiResponse<SupplementAnalysisData>> {
  return request.get('/stats/supplement-analysis', { params });
}

export function getDepartmentList(): Promise<ApiResponse<string[]>> {
  return request.get('/stats/departments');
}
