import { v4 as uuidv4 } from 'uuid';
import { WarningStatus, ApplicationStatus } from '../types';

export function generateId(): string {
  return uuidv4();
}

export function now(): string {
  return new Date().toISOString();
}

export function generateApplicationNo(): string {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `SQ${year}${month}${day}${random}`;
}

export function parseJSON<T>(str: string | null | undefined, defaultValue: T): T {
  if (!str) return defaultValue;
  try {
    return JSON.parse(str) as T;
  } catch {
    return defaultValue;
  }
}

export function toJSON(obj: any): string {
  return JSON.stringify(obj);
}

const WARNING_THRESHOLD_DAYS = 3;

export function calculateWarningStatus(
  acceptTime: string | undefined,
  promiseDays: number | undefined,
  status: ApplicationStatus
): { warningStatus: WarningStatus; remainingDays: number | undefined } {
  if (!acceptTime || !promiseDays) {
    return { warningStatus: 'none', remainingDays: undefined };
  }

  const finishedStatuses: ApplicationStatus[] = ['completed', 'rejected'];
  if (finishedStatuses.includes(status)) {
    return { warningStatus: 'none', remainingDays: undefined };
  }

  const acceptDate = new Date(acceptTime);
  const nowDate = new Date();
  const deadlineDate = new Date(acceptDate);
  deadlineDate.setDate(deadlineDate.getDate() + promiseDays);

  const diffTime = deadlineDate.getTime() - nowDate.getTime();
  const remainingDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (remainingDays < 0) {
    return { warningStatus: 'overdue', remainingDays };
  } else if (remainingDays <= WARNING_THRESHOLD_DAYS) {
    return { warningStatus: 'warning', remainingDays };
  } else {
    return { warningStatus: 'normal', remainingDays };
  }
}
