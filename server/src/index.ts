import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import userRoutes from './routes/userRoutes';
import matterRoutes from './routes/matterRoutes';
import applicationRoutes from './routes/applicationRoutes';
import fileRoutes from './routes/fileRoutes';
import logRoutes from './routes/logRoutes';
import guideRoutes from './routes/guideRoutes';
import notificationRoutes from './routes/notificationRoutes';

const app = express();
const PORT = process.env.PORT || 3001;
const NODE_ENV = process.env.NODE_ENV || 'development';

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api/users', userRoutes);
app.use('/api/matters', matterRoutes);
app.use('/api/applications', applicationRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/logs', logRoutes);
app.use('/api/guide', guideRoutes);
app.use('/api/notifications', notificationRoutes);

app.get('/api/health', (req, res) => {
  res.json({ success: true, message: '行政审批系统运行正常', timestamp: new Date().toISOString() });
});

const clientDistPath = path.join(__dirname, '../../client/dist');
if (NODE_ENV === 'production' && fs.existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath));

  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) {
      res.sendFile(path.join(clientDistPath, 'index.html'));
    }
  });
}

app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ success: false, message: '服务器内部错误' });
});

app.listen(PORT, () => {
  console.log(`🚀 行政审批系统已启动: http://localhost:${PORT}`);
  if (NODE_ENV === 'production' && fs.existsSync(clientDistPath)) {
    console.log(`📦 生产模式：前端静态资源已托管`);
  }
});

export default app;
