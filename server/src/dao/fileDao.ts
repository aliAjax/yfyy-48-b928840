import db from '../database';
import { MaterialFile } from '../types';
import { generateId, now } from '../utils/helpers';
import { findUserById } from './userDao';

interface RawFile {
  id: string;
  application_id: string;
  file_name: string;
  original_name: string;
  file_path: string;
  file_size: number;
  mime_type?: string;
  uploaded_by: string;
  uploader_name?: string;
  version: number;
  is_current: number;
  version_note?: string;
  created_at: string;
}

function mapFile(raw: RawFile): MaterialFile {
  return {
    id: raw.id,
    applicationId: raw.application_id,
    fileName: raw.file_name,
    originalName: raw.original_name,
    filePath: raw.file_path,
    fileSize: raw.file_size,
    mimeType: raw.mime_type,
    uploadedBy: raw.uploaded_by,
    uploadedByName: raw.uploader_name,
    version: raw.version,
    isCurrent: raw.is_current === 1,
    versionNote: raw.version_note,
    createdAt: raw.created_at,
  };
}

export function findLatestFileByOriginalName(applicationId: string, originalName: string): MaterialFile | null {
  const raw = db.prepare(
    'SELECT * FROM material_files WHERE application_id = ? AND original_name = ? ORDER BY version DESC LIMIT 1'
  ).get(applicationId, originalName) as RawFile | undefined;
  return raw ? mapFile(raw) : null;
}

export function createFile(data: {
  applicationId: string;
  fileName: string;
  originalName: string;
  filePath: string;
  fileSize: number;
  mimeType?: string;
  uploadedBy: string;
  versionNote?: string;
}): MaterialFile {
  const id = generateId();
  const createdAt = now();

  const user = findUserById(data.uploadedBy);
  const uploaderName = user?.name;

  const existingLatest = findLatestFileByOriginalName(data.applicationId, data.originalName);
  const version = existingLatest ? existingLatest.version + 1 : 1;

  const tx = db.transaction(() => {
    if (existingLatest) {
      db.prepare(
        'UPDATE material_files SET is_current = 0 WHERE application_id = ? AND original_name = ?'
      ).run(data.applicationId, data.originalName);
    }

    db.prepare(`
      INSERT INTO material_files (id, application_id, file_name, original_name, file_path, file_size, mime_type, uploaded_by, uploader_name, version, is_current, version_note, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      data.applicationId,
      data.fileName,
      data.originalName,
      data.filePath,
      data.fileSize,
      data.mimeType || null,
      data.uploadedBy,
      uploaderName || null,
      version,
      1,
      data.versionNote || null,
      createdAt,
    );
  });

  tx();

  const raw = db.prepare('SELECT * FROM material_files WHERE id = ?').get(id) as RawFile;
  return mapFile(raw);
}

export function findFileById(id: string): MaterialFile | null {
  const raw = db.prepare('SELECT * FROM material_files WHERE id = ?').get(id) as RawFile | undefined;
  return raw ? mapFile(raw) : null;
}

export function listCurrentFilesByApplication(applicationId: string): MaterialFile[] {
  const rows = db.prepare(
    'SELECT * FROM material_files WHERE application_id = ? AND is_current = 1 ORDER BY created_at DESC'
  ).all(applicationId) as RawFile[];
  return rows.map(mapFile);
}

export function listAllFilesByApplication(applicationId: string): MaterialFile[] {
  const rows = db.prepare(
    'SELECT * FROM material_files WHERE application_id = ? ORDER BY original_name ASC, version DESC'
  ).all(applicationId) as RawFile[];
  return rows.map(mapFile);
}

export function listFileVersions(applicationId: string, originalName: string): MaterialFile[] {
  const rows = db.prepare(
    'SELECT * FROM material_files WHERE application_id = ? AND original_name = ? ORDER BY version DESC'
  ).all(applicationId, originalName) as RawFile[];
  return rows.map(mapFile);
}

export function getVersionCount(applicationId: string, originalName: string): number {
  const row = db.prepare(
    'SELECT COUNT(*) as count FROM material_files WHERE application_id = ? AND original_name = ?'
  ).get(applicationId, originalName) as { count: number };
  return row.count;
}

export function deleteFile(id: string): boolean {
  const file = findFileById(id);
  if (!file) return false;

  const tx = db.transaction(() => {
    if (file.isCurrent) {
      const prevVersion = db.prepare(
        'SELECT * FROM material_files WHERE application_id = ? AND original_name = ? AND version < ? ORDER BY version DESC LIMIT 1'
      ).get(file.applicationId, file.originalName, file.version) as RawFile | undefined;
      
      if (prevVersion) {
        db.prepare(
          'UPDATE material_files SET is_current = 1 WHERE id = ?'
        ).run(prevVersion.id);
      }
    }

    const result = db.prepare('DELETE FROM material_files WHERE id = ?').run(id);
    return result.changes > 0;
  });

  return tx();
}

export function canDeleteFile(fileId: string, userId: string, userRole: string, applicationStatus: string): { canDelete: boolean; reason?: string } {
  const file = findFileById(fileId);
  if (!file) {
    return { canDelete: false, reason: '文件不存在' };
  }

  if (userRole !== 'applicant') {
    return { canDelete: false, reason: '只有申请人可删除材料' };
  }

  if (file.uploadedBy !== userId) {
    return { canDelete: false, reason: '只能删除本人上传的材料' };
  }

  if (applicationStatus !== 'draft' && applicationStatus !== 'supplement') {
    return { canDelete: false, reason: '仅草稿或补正状态可删除材料' };
  }

  if (!file.isCurrent) {
    return { canDelete: false, reason: '只能删除最新版本的材料' };
  }

  return { canDelete: true };
}
