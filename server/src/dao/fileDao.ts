import db from '../database';
import { MaterialFile } from '../types';
import { generateId, now } from '../utils/helpers';

interface RawFile {
  id: string;
  application_id: string;
  file_name: string;
  original_name: string;
  file_path: string;
  file_size: number;
  mime_type?: string;
  uploaded_by: string;
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
    createdAt: raw.created_at,
  };
}

export function createFile(data: {
  applicationId: string;
  fileName: string;
  originalName: string;
  filePath: string;
  fileSize: number;
  mimeType?: string;
  uploadedBy: string;
}): MaterialFile {
  const id = generateId();
  const createdAt = now();

  db.prepare(`
    INSERT INTO material_files (id, application_id, file_name, original_name, file_path, file_size, mime_type, uploaded_by, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    data.applicationId,
    data.fileName,
    data.originalName,
    data.filePath,
    data.fileSize,
    data.mimeType || null,
    data.uploadedBy,
    createdAt,
  );

  const raw = db.prepare('SELECT * FROM material_files WHERE id = ?').get(id) as RawFile;
  return mapFile(raw);
}

export function findFileById(id: string): MaterialFile | null {
  const raw = db.prepare('SELECT * FROM material_files WHERE id = ?').get(id) as RawFile | undefined;
  return raw ? mapFile(raw) : null;
}

export function listFilesByApplication(applicationId: string): MaterialFile[] {
  const rows = db.prepare(
    'SELECT * FROM material_files WHERE application_id = ? ORDER BY created_at ASC'
  ).all(applicationId) as RawFile[];
  return rows.map(mapFile);
}

export function deleteFile(id: string): boolean {
  const result = db.prepare('DELETE FROM material_files WHERE id = ?').run(id);
  return result.changes > 0;
}
