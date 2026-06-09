import db from '../database';
import {
  StatsFilterParams,
  StatsOverview,
  DailyTrendItem,
  MatterRankItem,
  DepartmentStatsItem,
  StatusStatsItem,
  UserStatsItem,
  WarningStats,
  MonthlyTrendItem,
  SupplementStats,
  FullStatsOverview,
  ApplicationStatus,
} from '../types';
import { calculateWarningStatus, calculateSupplementDays } from '../utils/helpers';
import { findMatterById } from './matterDao';

function buildWhereClause(params: StatsFilterParams, requireSubmitTime: boolean = false): { where: string; values: any[] } {
  const whereClauses: string[] = [];
  const values: any[] = [];

  if (requireSubmitTime) {
    whereClauses.push('a.submit_time IS NOT NULL');
  }

  if (params.startDate) {
    whereClauses.push('DATE(a.submit_time) >= DATE(?)');
    values.push(params.startDate);
  }
  if (params.endDate) {
    whereClauses.push('DATE(a.submit_time) <= DATE(?)');
    values.push(params.endDate);
  }
  if (params.department) {
    whereClauses.push('m.department = ?');
    values.push(params.department);
  }
  if (params.matterId) {
    whereClauses.push('a.matter_id = ?');
    values.push(params.matterId);
  }
  if (params.status) {
    whereClauses.push('a.status = ?');
    values.push(params.status);
  }

  return {
    where: whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '',
    values,
  };
}

export function getStatsOverview(params: StatsFilterParams): StatsOverview {
  const { where, values } = buildWhereClause(params);

  const sql = `
    SELECT
      COUNT(*) as totalCount,
      SUM(CASE WHEN a.status IN ('approved', 'completed') THEN 1 ELSE 0 END) as approvedCount,
      SUM(CASE WHEN a.status = 'rejected' THEN 1 ELSE 0 END) as rejectedCount,
      AVG(CASE 
        WHEN a.complete_time IS NOT NULL AND a.submit_time IS NOT NULL 
        THEN julianday(a.complete_time) - julianday(a.submit_time)
        ELSE NULL 
      END) as avgDuration
    FROM applications a
    LEFT JOIN matters m ON a.matter_id = m.id
    ${where}
  `;

  const row: any = db.prepare(sql).get(...values);

  const totalCount = row.totalCount || 0;
  const approvedCount = row.approvedCount || 0;
  const rejectedCount = row.rejectedCount || 0;
  const avgDuration = row.avgDuration ? Number(row.avgDuration.toFixed(2)) : 0;
  const approvalRate = totalCount > 0 ? Number(((approvedCount / totalCount) * 100).toFixed(2)) : 0;
  const rejectionRate = totalCount > 0 ? Number(((rejectedCount / totalCount) * 100).toFixed(2)) : 0;

  return {
    totalCount,
    approvedCount,
    rejectedCount,
    avgDuration,
    approvalRate,
    rejectionRate,
  };
}

export function getDailyTrend(params: StatsFilterParams): DailyTrendItem[] {
  const { where, values } = buildWhereClause(params, true);

  const sql = `
    SELECT
      DATE(a.submit_time) as date,
      COUNT(*) as totalCount,
      SUM(CASE WHEN a.status IN ('approved', 'completed') THEN 1 ELSE 0 END) as approvedCount,
      SUM(CASE WHEN a.status = 'rejected' THEN 1 ELSE 0 END) as rejectedCount
    FROM applications a
    LEFT JOIN matters m ON a.matter_id = m.id
    ${where}
    GROUP BY DATE(a.submit_time)
    ORDER BY date ASC
  `;

  const rows: any[] = db.prepare(sql).all(...values);

  return rows.map(row => ({
    date: row.date,
    totalCount: row.totalCount || 0,
    approvedCount: row.approvedCount || 0,
    rejectedCount: row.rejectedCount || 0,
  }));
}

export function getMatterRank(params: StatsFilterParams, limit?: number): MatterRankItem[] {
  const { where, values } = buildWhereClause(params);

  let sql = `
    SELECT
      a.matter_id as matterId,
      m.name as matterName,
      m.department as department,
      COUNT(*) as totalCount,
      SUM(CASE WHEN a.status IN ('approved', 'completed') THEN 1 ELSE 0 END) as approvedCount,
      SUM(CASE WHEN a.status = 'rejected' THEN 1 ELSE 0 END) as rejectedCount,
      AVG(CASE 
        WHEN a.complete_time IS NOT NULL AND a.submit_time IS NOT NULL 
        THEN julianday(a.complete_time) - julianday(a.submit_time)
        ELSE NULL 
      END) as avgDuration
    FROM applications a
    LEFT JOIN matters m ON a.matter_id = m.id
    ${where}
    GROUP BY a.matter_id, m.name, m.department
    ORDER BY totalCount DESC
  `;

  if (limit) {
    sql += ' LIMIT ?';
    values.push(limit);
  }

  const rows: any[] = db.prepare(sql).all(...values);

  return rows.map(row => {
    const totalCount = row.totalCount || 0;
    const approvedCount = row.approvedCount || 0;
    return {
      matterId: row.matterId,
      matterName: row.matterName,
      department: row.department,
      totalCount,
      approvedCount,
      rejectedCount: row.rejectedCount || 0,
      approvalRate: totalCount > 0 ? Number(((approvedCount / totalCount) * 100).toFixed(2)) : 0,
      avgDuration: row.avgDuration ? Number(row.avgDuration.toFixed(2)) : 0,
    };
  });
}

export function getDepartmentStats(params: StatsFilterParams): DepartmentStatsItem[] {
  const { where, values } = buildWhereClause(params);

  const sql = `
    SELECT
      m.department as department,
      COUNT(*) as totalCount,
      SUM(CASE WHEN a.status IN ('approved', 'completed') THEN 1 ELSE 0 END) as approvedCount,
      SUM(CASE WHEN a.status = 'rejected' THEN 1 ELSE 0 END) as rejectedCount,
      AVG(CASE
        WHEN a.complete_time IS NOT NULL AND a.submit_time IS NOT NULL
        THEN julianday(a.complete_time) - julianday(a.submit_time)
        ELSE NULL
      END) as avgDuration
    FROM applications a
    LEFT JOIN matters m ON a.matter_id = m.id
    ${where}
    GROUP BY m.department
    ORDER BY totalCount DESC
  `;

  const rows: any[] = db.prepare(sql).all(...values);

  return rows.map(row => {
    const totalCount = row.totalCount || 0;
    const approvedCount = row.approvedCount || 0;
    const rejectedCount = row.rejectedCount || 0;
    return {
      department: row.department || '未分类',
      totalCount,
      approvedCount,
      rejectedCount,
      approvalRate: totalCount > 0 ? Number(((approvedCount / totalCount) * 100).toFixed(2)) : 0,
      rejectionRate: totalCount > 0 ? Number(((rejectedCount / totalCount) * 100).toFixed(2)) : 0,
      avgDuration: row.avgDuration ? Number(row.avgDuration.toFixed(2)) : 0,
    };
  });
}

export function getStatusStats(params: StatsFilterParams): StatusStatsItem[] {
  const { where, values } = buildWhereClause(params);

  const sql = `
    SELECT
      a.status as status,
      COUNT(*) as totalCount,
      SUM(CASE WHEN a.status IN ('approved', 'completed') THEN 1 ELSE 0 END) as approvedCount,
      SUM(CASE WHEN a.status = 'rejected' THEN 1 ELSE 0 END) as rejectedCount,
      AVG(CASE
        WHEN a.complete_time IS NOT NULL AND a.submit_time IS NOT NULL
        THEN julianday(a.complete_time) - julianday(a.submit_time)
        ELSE NULL
      END) as avgDuration
    FROM applications a
    LEFT JOIN matters m ON a.matter_id = m.id
    ${where}
    GROUP BY a.status
    ORDER BY totalCount DESC
  `;

  const rows: any[] = db.prepare(sql).all(...values);

  return rows.map(row => {
    const totalCount = row.totalCount || 0;
    const approvedCount = row.approvedCount || 0;
    const rejectedCount = row.rejectedCount || 0;
    return {
      status: row.status,
      count: totalCount,
      totalCount,
      approvedCount,
      rejectedCount,
      approvalRate: totalCount > 0 ? Number(((approvedCount / totalCount) * 100).toFixed(2)) : 0,
      rejectionRate: totalCount > 0 ? Number(((rejectedCount / totalCount) * 100).toFixed(2)) : 0,
      avgDuration: row.avgDuration ? Number(row.avgDuration.toFixed(2)) : 0,
    };
  });
}

export function getDepartmentList(): string[] {
  const rows: any[] = db.prepare('SELECT DISTINCT department FROM matters WHERE department IS NOT NULL AND LENGTH(department) > 0 ORDER BY department').all();
  return rows.map(row => row.department);
}

export function getUserStats(params: StatsFilterParams, role?: string): UserStatsItem[] {
  const { where, values } = buildWhereClause(params);

  let userJoin = '';
  let userField = '';
  if (role === 'window') {
    userJoin = 'INNER JOIN users u ON a.window_user_id = u.id';
    userField = 'a.window_user_id';
  } else if (role === 'reviewer') {
    userJoin = 'INNER JOIN users u ON a.reviewer_user_id = u.id';
    userField = 'a.reviewer_user_id';
  } else {
    userJoin = 'INNER JOIN users u ON (a.window_user_id = u.id OR a.reviewer_user_id = u.id)';
    userField = "CASE WHEN a.window_user_id IS NOT NULL THEN a.window_user_id ELSE a.reviewer_user_id END";
  }

  const roleCondition = role ? 'AND u.role = ?' : '';
  if (role) values.push(role);

  const sql = `
    SELECT
      u.id as userId,
      u.name as userName,
      u.role as role,
      COUNT(*) as totalCount,
      SUM(CASE WHEN a.status IN ('approved', 'completed') THEN 1 ELSE 0 END) as approvedCount,
      SUM(CASE WHEN a.status = 'rejected' THEN 1 ELSE 0 END) as rejectedCount,
      AVG(CASE 
        WHEN a.complete_time IS NOT NULL AND a.accept_time IS NOT NULL 
        THEN julianday(a.complete_time) - julianday(a.accept_time)
        ELSE NULL 
      END) as avgDuration
    FROM applications a
    LEFT JOIN matters m ON a.matter_id = m.id
    ${userJoin}
    ${where ? where + ' ' + roleCondition : 'WHERE 1=1 ' + roleCondition}
    GROUP BY u.id, u.name, u.role
    ORDER BY totalCount DESC
  `;

  const rows: any[] = db.prepare(sql).all(...values);

  return rows.map(row => ({
    userId: row.userId,
    userName: row.userName,
    role: row.role,
    totalCount: row.totalCount || 0,
    approvedCount: row.approvedCount || 0,
    rejectedCount: row.rejectedCount || 0,
    avgDuration: row.avgDuration ? Number(row.avgDuration.toFixed(2)) : 0,
  }));
}

export function getWarningStats(params: StatsFilterParams): WarningStats {
  const { where, values } = buildWhereClause(params);

  const activeStatuses: ApplicationStatus[] = ['submitted', 'accepted', 'supplement', 'reviewing', 'approved'];

  const sql = `
    SELECT
      a.id,
      a.status,
      a.accept_time as acceptTime,
      a.matter_id as matterId
    FROM applications a
    LEFT JOIN matters m ON a.matter_id = m.id
    ${where}
  `;

  const rows: any[] = db.prepare(sql).all(...values);
  const activeApps = rows.filter(r => activeStatuses.includes(r.status as ApplicationStatus) && r.acceptTime);

  let normalCount = 0;
  let warningCount = 0;
  let overdueCount = 0;

  for (const app of activeApps) {
    const matter = findMatterById(app.matterId);
    if (!matter) continue;

    const logsSql = `
      SELECT action, created_at as createdAt, new_status as newStatus
      FROM operation_logs
      WHERE application_id = ?
      ORDER BY created_at ASC
    `;
    const logs: any[] = db.prepare(logsSql).all(app.id);
    const supplementDays = calculateSupplementDays(logs);

    const { warningStatus } = calculateWarningStatus(
      app.acceptTime,
      matter.promiseDays,
      app.status,
      matter.warningDays,
      matter.excludeSupplementTime,
      supplementDays
    );

    if (warningStatus === 'normal') normalCount++;
    else if (warningStatus === 'warning') warningCount++;
    else if (warningStatus === 'overdue') overdueCount++;
  }

  const totalCount = activeApps.length;

  return {
    totalCount,
    normalCount,
    warningCount,
    overdueCount,
    warningRate: totalCount > 0 ? Number(((warningCount / totalCount) * 100).toFixed(2)) : 0,
    overdueRate: totalCount > 0 ? Number(((overdueCount / totalCount) * 100).toFixed(2)) : 0,
  };
}

export function getMonthlyTrend(params: StatsFilterParams): MonthlyTrendItem[] {
  const { where, values } = buildWhereClause(params, true);

  const sql = `
    SELECT
      strftime('%Y-%m', a.submit_time) as month,
      COUNT(*) as totalCount,
      SUM(CASE WHEN a.status IN ('approved', 'completed') THEN 1 ELSE 0 END) as approvedCount,
      SUM(CASE WHEN a.status = 'rejected' THEN 1 ELSE 0 END) as rejectedCount,
      AVG(CASE 
        WHEN a.complete_time IS NOT NULL AND a.submit_time IS NOT NULL 
        THEN julianday(a.complete_time) - julianday(a.submit_time)
        ELSE NULL 
      END) as avgDuration
    FROM applications a
    LEFT JOIN matters m ON a.matter_id = m.id
    ${where}
    GROUP BY strftime('%Y-%m', a.submit_time)
    ORDER BY month ASC
  `;

  const rows: any[] = db.prepare(sql).all(...values);

  return rows.map(row => ({
    month: row.month,
    totalCount: row.totalCount || 0,
    approvedCount: row.approvedCount || 0,
    rejectedCount: row.rejectedCount || 0,
    avgDuration: row.avgDuration ? Number(row.avgDuration.toFixed(2)) : 0,
  }));
}

export function getSupplementStats(params: StatsFilterParams): SupplementStats {
  const { where, values } = buildWhereClause(params);

  const sql = `
    SELECT
      COUNT(*) as totalCount,
      SUM(CASE WHEN a.status = 'supplement' OR (a.supplement_reason IS NOT NULL AND a.supplement_reason != '') THEN 1 ELSE 0 END) as supplementCount
    FROM applications a
    LEFT JOIN matters m ON a.matter_id = m.id
    ${where}
  `;

  const row: any = db.prepare(sql).get(...values);

  const totalCount = row.totalCount || 0;
  const supplementCount = row.supplementCount || 0;

  return {
    supplementCount,
    supplementRate: totalCount > 0 ? Number(((supplementCount / totalCount) * 100).toFixed(2)) : 0,
    avgSupplementCount: 0,
  };
}

export function getFullOverview(params: StatsFilterParams): FullStatsOverview {
  const basic = getStatsOverview(params);
  const warning = getWarningStats(params);
  const supplement = getSupplementStats(params);

  const inProgressStatuses = ['submitted', 'accepted', 'supplement', 'reviewing', 'approved'];
  
  const { where, values } = buildWhereClause(params);
  const inProgressSql = `
    SELECT COUNT(*) as count FROM applications a
    LEFT JOIN matters m ON a.matter_id = m.id
    ${where}
    ${where ? 'AND' : 'WHERE'} a.status IN (${inProgressStatuses.map(() => '?').join(',')})
  `;
  const inProgressRow: any = db.prepare(inProgressSql).get([...values, ...inProgressStatuses]);
  const inProgressCount = inProgressRow?.count || 0;

  return {
    ...basic,
    inProgressCount,
    supplementCount: supplement.supplementCount,
    warningCount: warning.warningCount,
    overdueCount: warning.overdueCount,
    supplementRate: supplement.supplementRate,
    warningRate: warning.warningRate,
    overdueRate: warning.overdueRate,
  };
}
