import Database, { type Database as DatabaseType } from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const dbDir = path.join(__dirname, '../../data');
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const dbPath = path.join(dbDir, 'approval.db');
const db: DatabaseType = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function migrateDatabase() {
  const applicationColumns = db.prepare("PRAGMA table_info(applications)").all() as { name: string }[];
  const applicationColNames = applicationColumns.map(c => c.name);

  if (!applicationColNames.includes('flow_snapshot')) {
    db.exec("ALTER TABLE applications ADD COLUMN flow_snapshot TEXT");
  }

  const fileColumns = db.prepare("PRAGMA table_info(material_files)").all() as { name: string }[];
  const fileColNames = fileColumns.map(c => c.name);
  
  if (!fileColNames.includes('version')) {
    db.exec("ALTER TABLE material_files ADD COLUMN version INTEGER NOT NULL DEFAULT 1");
  }
  if (!fileColNames.includes('is_current')) {
    db.exec("ALTER TABLE material_files ADD COLUMN is_current INTEGER NOT NULL DEFAULT 1");
  }
  if (!fileColNames.includes('version_note')) {
    db.exec("ALTER TABLE material_files ADD COLUMN version_note TEXT");
  }
  if (!fileColNames.includes('uploader_name')) {
    db.exec("ALTER TABLE material_files ADD COLUMN uploader_name TEXT");
  }

  const opinionColumns = db.prepare("PRAGMA table_info(review_opinions)").all() as { name: string }[];
  const opinionColNames = opinionColumns.map(c => c.name);
  
  if (!opinionColNames.includes('updated_at')) {
    db.exec("ALTER TABLE review_opinions ADD COLUMN updated_at TEXT");
  }
}

function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL,
      phone TEXT,
      id_card TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS matters (
      id TEXT PRIMARY KEY,
      code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      department TEXT NOT NULL,
      description TEXT,
      required_materials TEXT,
      promise_days INTEGER NOT NULL DEFAULT 5,
      flow_config TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS applications (
      id TEXT PRIMARY KEY,
      application_no TEXT UNIQUE NOT NULL,
      matter_id TEXT NOT NULL,
      applicant_id TEXT NOT NULL,
      basic_info TEXT,
      materials TEXT,
      status TEXT NOT NULL DEFAULT 'draft',
      supplement_reason TEXT,
      reject_reason TEXT,
      review_opinion TEXT,
      current_step TEXT,
      flow_snapshot TEXT,
      window_user_id TEXT,
      reviewer_user_id TEXT,
      submit_time TEXT,
      accept_time TEXT,
      complete_time TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (matter_id) REFERENCES matters(id),
      FOREIGN KEY (applicant_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS material_files (
      id TEXT PRIMARY KEY,
      application_id TEXT NOT NULL,
      file_name TEXT NOT NULL,
      original_name TEXT NOT NULL,
      file_path TEXT NOT NULL,
      file_size INTEGER NOT NULL,
      mime_type TEXT,
      uploaded_by TEXT NOT NULL,
      uploader_name TEXT,
      version INTEGER NOT NULL DEFAULT 1,
      is_current INTEGER NOT NULL DEFAULT 1,
      version_note TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS operation_logs (
      id TEXT PRIMARY KEY,
      application_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      action TEXT NOT NULL,
      description TEXT,
      old_status TEXT,
      new_status TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      content TEXT,
      application_id TEXT,
      is_read INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      read_at TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS application_templates (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      matter_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      basic_info TEXT,
      materials TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (matter_id) REFERENCES matters(id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_templates_user ON application_templates(user_id);
    CREATE INDEX IF NOT EXISTS idx_templates_matter ON application_templates(matter_id);

    CREATE INDEX IF NOT EXISTS idx_applications_applicant ON applications(applicant_id);
    CREATE INDEX IF NOT EXISTS idx_applications_status ON applications(status);
    CREATE INDEX IF NOT EXISTS idx_applications_matter ON applications(matter_id);
    CREATE INDEX IF NOT EXISTS idx_logs_application ON operation_logs(application_id);
    CREATE INDEX IF NOT EXISTS idx_files_application ON material_files(application_id);
    CREATE TABLE IF NOT EXISTS review_opinions (
      id TEXT PRIMARY KEY,
      application_id TEXT NOT NULL,
      material_name TEXT NOT NULL,
      status TEXT NOT NULL,
      opinion TEXT NOT NULL DEFAULT '',
      reviewer_id TEXT NOT NULL,
      reviewer_name TEXT,
      review_round INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT,
      FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE CASCADE,
      FOREIGN KEY (reviewer_id) REFERENCES users(id)
    );

    CREATE INDEX IF NOT EXISTS idx_review_opinions_application ON review_opinions(application_id);
    CREATE INDEX IF NOT EXISTS idx_review_opinions_round ON review_opinions(application_id, review_round);
    CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
    CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(user_id, is_read);
  `);
}

initDatabase();
migrateDatabase();

export default db;
