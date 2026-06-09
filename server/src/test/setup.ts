import { beforeAll, beforeEach, vi } from 'vitest';
import db from '../database';

beforeAll(() => {
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'test-secret-key-for-unit-testing-2024';
});

beforeEach(() => {
  const tables = [
    'review_opinions',
    'operation_logs',
    'notifications',
    'material_files',
    'applications',
    'application_templates',
    'matters',
    'users',
  ];
  tables.forEach(table => {
    db.exec(`DELETE FROM ${table}`);
  });
});
