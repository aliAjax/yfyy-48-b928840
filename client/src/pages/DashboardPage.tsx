import { useEffect, useState } from 'react';
import { Row, Col, Card, Statistic, List, Tag, Typography } from 'antd';
import {
  FileTextOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  WarningOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import { useAuth } from '../context/AuthContext';
import { listApplications } from '../api/applicationApi';
import { statusLabels, statusColors, warningLabels, warningColors } from '../utils/common';
import { Application } from '../types';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

export default function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<any>({
    total: 0,
    pending: 0,
    approved: 0,
    rejected: 0,
    warning: 0,
    overdue: 0,
  });
  const [recentApps, setRecentApps] = useState<Application[]>([]);

  useEffect(() => {
    loadStats();
  }, [user]);

  const loadStats = async () => {
    try {
      const allRes = await listApplications({ page: 1, pageSize: 100 });
      if (allRes.success) {
        const apps = allRes.data || [];
        const total = allRes.total || 0;
        const pending = apps.filter(a => ['submitted', 'accepted', 'reviewing', 'supplement'].includes(a.status)).length;
        const approved = apps.filter(a => a.status === 'approved').length;
        const rejected = apps.filter(a => a.status === 'rejected').length;
        const warning = apps.filter(a => a.warningStatus === 'warning').length;
        const overdue = apps.filter(a => a.warningStatus === 'overdue').length;
        
        setStats({ total, pending, approved, rejected, warning, overdue });
        setRecentApps(apps.slice(0, 5));
      }
    } catch (error) {
      console.error('加载统计数据失败', error);
    }
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return '上午好';
    if (hour < 18) return '下午好';
    return '晚上好';
  };

  return (
    <div>
      <div style={{ marginBottom: 24, padding: '24px', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', borderRadius: 8, color: 'white' }}>
        <Title level={3} style={{ color: 'white', margin: 0 }}>
          {getGreeting()}，{user?.name}！
        </Title>
        <Text style={{ color: 'rgba(255,255,255,0.85)' }}>
          欢迎使用行政审批事项办理系统
        </Text>
      </div>

      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card hoverable onClick={() => navigate(user?.role === 'applicant' ? '/my-applications' : '/applications')}>
            <Statistic
              title="申请总数"
              value={stats.total}
              prefix={<FileTextOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card hoverable onClick={() => navigate(user?.role === 'applicant' ? '/my-applications' : '/applications')}>
            <Statistic
              title="待处理"
              value={stats.pending}
              valueStyle={{ color: '#1890ff' }}
              prefix={<ClockCircleOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card hoverable onClick={() => navigate(user?.role === 'applicant' ? '/my-applications' : '/applications', { state: { warningFilter: 'warning' } })}>
            <Statistic
              title="即将超期"
              value={stats.warning}
              valueStyle={{ color: '#faad14' }}
              prefix={<WarningOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card hoverable onClick={() => navigate(user?.role === 'applicant' ? '/my-applications' : '/applications', { state: { warningFilter: 'overdue' } })}>
            <Statistic
              title="已超期"
              value={stats.overdue}
              valueStyle={{ color: '#ff4d4f' }}
              prefix={<ExclamationCircleOutlined />}
            />
          </Card>
        </Col>
      </Row>

      <Card title="最近申请" extra={<a onClick={() => navigate(user?.role === 'applicant' ? '/my-applications' : '/applications')}>查看全部</a>}>
        <List
          dataSource={recentApps}
          renderItem={(item) => (
            <List.Item
              actions={[
                <Tag color={statusColors[item.status] as any} key="status">{statusLabels[item.status]}</Tag>,
                item.warningStatus && item.warningStatus !== 'none' ? (
                  <Tag color={warningColors[item.warningStatus] as any} key="warning">
                    {warningLabels[item.warningStatus]}
                    {item.remainingDays !== undefined && ` (${item.remainingDays > 0 ? `剩余${item.remainingDays}天` : `超期${Math.abs(item.remainingDays)}天`})`}
                  </Tag>
                ) : null,
              ]}
              onClick={() => navigate(`/applications/${item.id}`)}
              style={{ cursor: 'pointer' }}
            >
              <List.Item.Meta
                title={item.applicationNo}
                description={
                  <div>
                    <div>{item.matterName}</div>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {dayjs(item.createdAt).format('YYYY-MM-DD HH:mm')}
                    </Text>
                  </div>
                }
              />
            </List.Item>
          )}
        />
        {recentApps.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px 0', color: '#999' }}>
            暂无申请记录
          </div>
        )}
      </Card>
    </div>
  );
}
