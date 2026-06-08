import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { createFile, findFileById, listFilesByApplication, deleteFile } from '../dao/fileDao';
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

  if (req.user.role === 'applicant' && app.applicantId !== req.user.id) {
    res.status(403).json({ success: false, message: '无权上传' });
    return;
  }

  const file = createFile({
    applicationId,
    fileName: req.file.filename,
    originalName: req.file.originalname,
    filePath: req.file.path,
    fileSize: req.file.size,
    mimeType: req.file.mimetype,
    uploadedBy: req.user.id,
  });

  res.json({ success: true, data: file, message: '上传成功' });
});

router.get('/application/:applicationId', authMiddleware, (req: AuthRequest, res) => {
  if (!req.user) return;

  const { applicationId } = req.params;
  const app = findApplicationById(applicationId);
  if (!app) {
    res.json({ success: false, message: '申请不存在' });
    return;
  }

  if (req.user.role === 'applicant' && app.applicantId !== req.user.id) {
    res.status(403).json({ success: false, message: '无权查看' });
    return;
  }

  const files = listFilesByApplication(applicationId);
  res.json({ success: true, data: files });
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

  if (req.user.role === 'applicant' && app.applicantId !== req.user.id) {
    res.status(403).json({ success: false, message: '无权下载' });
    return;
  }

  if (!fs.existsSync(file.filePath)) {
    res.status(404).json({ success: false, message: '文件已丢失' });
    return;
  }

  res.download(file.filePath, file.originalName);
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

  if (req.user.role === 'applicant' && app.applicantId !== req.user.id) {
    res.status(403).json({ success: false, message: '无权删除' });
    return;
  }

  if (fs.existsSync(file.filePath)) {
    fs.unlinkSync(file.filePath);
  }
  deleteFile(file.id);

  res.json({ success: true, message: '删除成功' });
});

export default router;
