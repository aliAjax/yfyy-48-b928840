import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import {
  createFile,
  findFileById,
  listCurrentFilesByApplication,
  listFileVersions,
  deleteFile,
  listAllFilesByApplication,
  canDeleteFile,
  getVersionCount,
  compareFileVersions,
} from '../dao/fileDao';
import { findApplicationById } from '../dao/applicationDao';

const router = Router();

const uploadDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const filename = `${uuidv4()}${ext}`;
    cb(null, filename);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
});

function canViewApplication(applicantId: string, userId: string, userRole: string): boolean {
  if (userRole === 'admin') return true;
  if (userRole === 'window' || userRole === 'reviewer') return true;
  if (userRole === 'applicant' && applicantId === userId) return true;
  return false;
}

function canEditApplication(applicantId: string, userId: string, userRole: string): boolean {
  if (userRole === 'admin') return true;
  if (userRole === 'applicant' && applicantId === userId) return true;
  return false;
}

router.post('/upload/:applicationId', authMiddleware, upload.single('file'), (req: AuthRequest, res) => {
  if (!req.user) return;
  if (!req.file) {
    res.json({ success: false, message: '请选择文件' });
    return;
  }

  const { applicationId } = req.params;
  const app = findApplicationById(applicationId);
  if (!app) {
    res.json({ success: false, message: '申请不存在' });
    return;
  }

  if (!canEditApplication(app.applicantId, req.user.id, req.user.role)) {
    res.status(403).json({ success: false, message: '无权上传材料' });
    return;
  }

  if (req.user.role === 'applicant') {
    if (app.status !== 'draft' && app.status !== 'supplement') {
      res.status(403).json({ success: false, message: '当前状态下无法上传材料，仅草稿或补正状态可上传' });
      return;
    }
  }

  const versionNote = req.body.versionNote as string | undefined;

  const file = createFile({
    applicationId,
    fileName: req.file.filename,
    originalName: req.file.originalname,
    filePath: req.file.path,
    fileSize: req.file.size,
    mimeType: req.file.mimetype,
    uploadedBy: req.user.id,
    versionNote,
  });

  const versionCount = getVersionCount(applicationId, req.file.originalname);

  res.json({
    success: true,
    data: file,
    message: versionCount > 1 ? `上传成功，已创建 v${file.version} 新版本` : '上传成功',
  });
});

router.get('/application/:applicationId', authMiddleware, (req: AuthRequest, res) => {
  if (!req.user) return;

  const { applicationId } = req.params;
  const app = findApplicationById(applicationId);
  if (!app) {
    res.json({ success: false, message: '申请不存在' });
    return;
  }

  if (!canViewApplication(app.applicantId, req.user.id, req.user.role)) {
    res.status(403).json({ success: false, message: '无权查看' });
    return;
  }

  const files = listCurrentFilesByApplication(applicationId);
  res.json({ success: true, data: files });
});

router.get('/application/:applicationId/all', authMiddleware, (req: AuthRequest, res) => {
  if (!req.user) return;

  const { applicationId } = req.params;
  const app = findApplicationById(applicationId);
  if (!app) {
    res.json({ success: false, message: '申请不存在' });
    return;
  }

  if (!canViewApplication(app.applicantId, req.user.id, req.user.role)) {
    res.status(403).json({ success: false, message: '无权查看' });
    return;
  }

  const files = listAllFilesByApplication(applicationId);
  res.json({ success: true, data: files });
});

router.get('/versions/:applicationId', authMiddleware, (req: AuthRequest, res) => {
  if (!req.user) return;

  const { applicationId } = req.params;
  const { originalName } = req.query;

  const app = findApplicationById(applicationId);
  if (!app) {
    res.json({ success: false, message: '申请不存在' });
    return;
  }

  if (!canViewApplication(app.applicantId, req.user.id, req.user.role)) {
    res.status(403).json({ success: false, message: '无权查看' });
    return;
  }

  if (!originalName || typeof originalName !== 'string') {
    res.json({ success: false, message: '缺少材料名称参数' });
    return;
  }

  const versions = listFileVersions(applicationId, decodeURIComponent(originalName));
  res.json({ success: true, data: versions });
});

router.get('/compare/:applicationId', authMiddleware, (req: AuthRequest, res) => {
  if (!req.user) return;

  const { applicationId } = req.params;
  const { file1Id, file2Id } = req.query;

  const app = findApplicationById(applicationId);
  if (!app) {
    res.json({ success: false, message: '申请不存在' });
    return;
  }

  if (!canViewApplication(app.applicantId, req.user.id, req.user.role)) {
    res.status(403).json({ success: false, message: '无权查看' });
    return;
  }

  if (!file1Id || !file2Id || typeof file1Id !== 'string' || typeof file2Id !== 'string') {
    res.json({ success: false, message: '请提供两个文件ID进行对比' });
    return;
  }

  if (file1Id === file2Id) {
    res.json({ success: false, message: '请选择两个不同版本进行对比' });
    return;
  }

  const result = compareFileVersions(applicationId, file1Id, file2Id);
  if (!result) {
    res.json({ success: false, message: '文件不存在或不属于同一材料' });
    return;
  }

  res.json({ success: true, data: result });
});

router.get('/download/:id', authMiddleware, (req: AuthRequest, res) => {
  if (!req.user) return;

  const file = findFileById(req.params.id);
  if (!file) {
    res.status(404).json({ success: false, message: '文件不存在' });
    return;
  }

  const app = findApplicationById(file.applicationId);
  if (!app) {
    res.status(404).json({ success: false, message: '申请不存在' });
    return;
  }

  if (!canViewApplication(app.applicantId, req.user.id, req.user.role)) {
    res.status(403).json({ success: false, message: '无权下载' });
    return;
  }

  if (!fs.existsSync(file.filePath)) {
    res.status(404).json({ success: false, message: '文件已丢失' });
    return;
  }

  let downloadName = file.originalName;
  if (!file.isCurrent) {
    const ext = path.extname(file.originalName);
    const baseName = path.basename(file.originalName, ext);
    downloadName = `${baseName}_v${file.version}${ext}`;
  }

  res.download(file.filePath, downloadName);
});

router.delete('/:id', authMiddleware, (req: AuthRequest, res) => {
  if (!req.user) return;

  const file = findFileById(req.params.id);
  if (!file) {
    res.json({ success: false, message: '文件不存在' });
    return;
  }

  const app = findApplicationById(file.applicationId);
  if (!app) {
    res.json({ success: false, message: '申请不存在' });
    return;
  }

  const { canDelete, reason } = canDeleteFile(
    file.id,
    req.user.id,
    req.user.role,
    app.status
  );

  if (!canDelete) {
    res.status(403).json({ success: false, message: reason || '无权删除' });
    return;
  }

  if (fs.existsSync(file.filePath)) {
    fs.unlinkSync(file.filePath);
  }
  deleteFile(file.id);

  res.json({ success: true, message: '删除成功' });
});

export default router;
