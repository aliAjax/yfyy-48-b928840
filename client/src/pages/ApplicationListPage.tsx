import { useEffect, useState } from 'react';
import { Table, Card, Input, Select, Button, Space, Tag, Modal, message } from 'antd';
import { SearchOutlined, ReloadOutlined, PlusOutlined } from '@ant-design/icons';
import { listApplications, acceptApplication, supplementApplication, rejectApplication, sendReviewApplication, completeApplication } from '../api/applicationApi';
import { Application, ApplicationStatus } from '../types';
import { statusLabels, statusColors, roleLabels } from '../utils/common';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';

interface ApplicationListPageProps {
  showAll?: boolean;
  reviewMode?: boolean;
}

export default function ApplicationListPage({ showAll = false, reviewMode = false }: ApplicationListPageProps) {
  const [applications, setApplications] = useState<Application[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [loading, setLoading] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    loadApplications();
  }, [page, pageSize, keyword, statusFilter]);

  const loadApplications = async () => {
    setLoading(true);
    try {
      const params: any = { page, pageSize };
      if (keyword) params.keyword = keyword;
      if (statusFilter) params.status = statusFilter;

      const res = await listApplications(params);
      if (res.success) {
        setApplications(res.data || []);
        setTotal(res.total || 0);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    setPage(1);
    loadApplications();
  };

  const handleReset = () => {
    setKeyword('');
    setStatusFilter('');
    setPage(1);
  };

  const handleAccept = async (id: string) => {
    try {
      const res = await acceptApplication(id);
      if (res.success) {
        message.success('受理成功');
        loadApplications();
      }
    } catch {}
  };

  const handleSupplement = (id: string) => {
    Modal.confirm({
      title: '要求补正材料',
      content: (
        <Input.TextArea
          id="supplementReason"
          placeholder="请输入补正原因"
          rows={4}
        />
      ),
      onOk: async () => {
        const textarea = document.getElementById('supplementReason') as HTMLTextAreaElement;
        const reason = textarea?.value || '';
        if (!reason.trim()) {
          message.warning('请输入补正原因');
          return Promise.reject();
        }
        try {
          const res = await supplementApplication(id, reason);
          if (res.success) {
            message.success('已发送补正通知');
            loadApplications();
          }
        } catch {}
      },
    });
  };

  const handleReject = (id: string) => {
    Modal.confirm({
      title: '退回申请',
      content: (
        <Input.TextArea
          id="rejectReason"
          placeholder="请输入退回原因"
          rows={4}
        />
      ),
      onOk: async () => {
        const textarea = document.getElementById('rejectReason') as HTMLTextAreaElement;
        const reason = textarea?.value || '';
        if (!reason.trim()) {
          message.warning('请输入退回原因');
          return Promise.reject();
        }
        try {
          const res = await rejectApplication(id, reason);
          if (res.success) {
            message.success('已退回申请');
            loadApplications();
          }
        } catch {}
      },
    });
  };

  const handleSendReview = async (id: string) => {
    try {
      const res = await sendReviewApplication(id);
      if (res.success) {
        message.success('已送审');
        loadApplications();
      }
    } catch {}
  };

  const handleComplete = async (id: string) => {
    try {
      const res = await completeApplication(id);
      if (res.success) {
        message.success('办结成功');
        loadApplications();
      }
    } catch {}
  };

  const getActionButtons = (record: Application) => {
    const buttons: JSX.Element[] = [];
    const isWindow = user?.role === 'window';
    const isReviewer = user?.role === 'reviewer';
    const isAdmin = user?.role === 'admin';

    buttons.push(
      <Button type="link" onClick={() => navigate(`/applications/${record.id}`)}>
        详情
      </Button>
    );

    if (isWindow || isAdmin) {
      if (record.status === 'submitted') {
        buttons.push(
          <Button type="link" onClick={() => handleAccept(record.id)}>
            受理
          </Button>
        );
        buttons.push(
          <Button type="link" danger onClick={() => handleReject(record.id)}>
            退回
          </Button>
        );
      }
      if (record.status === 'accepted') {
        buttons.push(
          <Button type="link" onClick={() => handleSupplement(record.id)}>
            补正
          </Button>
        );
        buttons.push(
          <Button type="link" onClick={() => handleSendReview(record.id)}>
            送审
          </Button>
        );
      }
      if (record.status === 'approved') {
        buttons.push(
          <Button type="link" onClick={() => handleComplete(record.id)}>
            办结
          </Button>
        );
      }
    }

    if (isReviewer || isAdmin) {
      if (record.status === 'reviewing') {
        buttons.push(
          <Button type="link" onClick={() => navigate(`/applications/${record.id}/review`)}>
            审核
          </Button>
        );
      }
    }

    return buttons;
  };

  const columns = [
    {
      title: '申请编号',
      dataIndex: 'applicationNo',
      key: 'applicationNo',
      width: 180,
    },
    {
      title: '事项名称',
      dataIndex: 'matterName',
      key: 'matterName',
    },
    {
      title: '申请人',
      dataIndex: 'applicantName',
      key: 'applicantName',
      width: 100,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: ApplicationStatus) => (
        <Tag color={statusColors[status] as any}>
          {statusLabels[status]}
        </Tag>
      ),
    },
    {
      title: '当前环节',
      dataIndex: 'currentStep',
      key: 'currentStep',
      width: 120,
      render: (text: string) => text || '-',
    },
    {
      title: '申请时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 160,
      render: (text: string) => dayjs(text).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      fixed: 'right' as const,
      render: (_: any, record: Application) => (
        <Space size="small">
          {getActionButtons(record)}
        </Space>
      ),
    },
  ];

  const statusOptions = [
    { value: '', label: '全部状态' },
    { value: 'draft', label: '草稿' },
    { value: 'submitted', label: '待受理' },
    { value: 'accepted', label: '已受理' },
    { value: 'supplement', label: '待补正' },
    { value: 'reviewing', label: '审核中' },
    { value: 'approved', label: '审核通过' },
    { value: 'rejected', label: '已退回' },
    { value: 'completed', label: '已办结' },
  ];

  return (
    <Card
      title={reviewMode ? '待审核申请' : showAll ? '申请管理' : '我的申请'}
      extra={
        <Space>
          <Input
            placeholder="搜索申请编号"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            style={{ width: 200 }}
            onPressEnter={handleSearch}
            prefix={<SearchOutlined />}
          />
          <Select
            value={statusFilter}
            onChange={setStatusFilter}
            options={statusOptions}
            style={{ width: 140 }}
          />
          <Button icon={<ReloadOutlined />} onClick={handleReset}>
            重置
          </Button>
        </Space>
      }
    >
      <Table
        rowKey="id"
        loading={loading}
        dataSource={applications}
        columns={columns}
        pagination={{
          current: page,
          pageSize,
          total,
          onChange: (p, ps) => {
            setPage(p);
            setPageSize(ps);
          },
          showSizeChanger: true,
          showTotal: (total) => `共 ${total} 条记录`,
        }}
      />
    </Card>
  );
}
