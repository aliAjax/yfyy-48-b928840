import express from 'express';
import cors from 'cors';
import path from 'path';
import userRoutes from './routes/userRoutes';
import matterRoutes from './routes/matterRoutes';
import applicationRoutes from './routes/applicationRoutes';
import fileRoutes from './routes/fileRoutes';
import logRoutes from './routes/logRoutes';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api/users', userRoutes);
app.use('/api/matters', matterRoutes);
app.use('/api/applications', applicationRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/logs', logRoutes);

app.get('/api/health', (req, res) => {
  res.json({ success: true, message: '行政审批系统运行正常', timestamp: new Date().toISOString() });
});

app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ success: false, message: '服务器内部错误' });
});

app.listen(PORT, () => {
  console.log(`🚀 行政审批系统后端服务已启动: http://localhost:${PORT}`);
});

export default app;
