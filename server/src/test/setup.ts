import { beforeEach } from 'vitest';
import db from '../database';

const tables = [
  'application_templates',
  'review_opinions',
  'notifications',
  'operation_logs',
  'material_files',
  'applications',
  'matters',
  'users',
];

beforeEach(() => {
  db.pragma('foreign_keys = OFF');
  for (const table of tables) {
    db.prepare(`DELETE FROM ${table}`).run();
  }
  db.pragma('foreign_keys = ON');
});
