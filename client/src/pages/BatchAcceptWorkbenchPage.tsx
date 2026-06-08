import { useEffect, useState, useMemo } from 'react';
import { Table, Card, Input, Select, Button, Space, Tag, Modal, message, Alert } from 'antd';
import { SearchOutlined, ReloadOutlined, CheckOutlined, ExclamationOutlined, FileTextOutlined } from '@ant-design/icons';
import { listApplications, batchAcceptApplications, batchSupplementApplications } from '../api/applicationApi';
import { listMatters } from '../api/matterApi';
import { Application, ApplicationStatus, Matter, BatchOperationResult, BatchOperationItem, MaterialCompletenessFilter } from '../types';
import { statusLabels, statusColors, safeJSONParse, canOperateStep } from '../utils/common';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';

export default function BatchAcceptWorkbenchPage() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [loading, setLoading] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [matterFilter, setMatterFilter] = useState<string>('');
  const [materialCompletenessFilter, setMaterialCompletenessFilter] = useState<MaterialCompletenessFilter>('all');
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [matters, setMatters] = useState<Matter[]>([]);
  const [batchResult, setBatchResult] = useState<BatchOperationResult | null>(null);
  const [showResultModal, setShowResultModal] = useState(false);
  const [batchLoading, setBatchLoading] = useState(false);
  const [supplementReason, setSupplementReason] = useState('');
  const [showSupplementModal, setShowSupplementModal] = useState(false);

  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    loadMatters();
  }, []);

  useEffect(() => {
    loadApplications();
  }, [page, pageSize, keyword, matterFilter, materialCompletenessFilter]);

  const loadMatters = async () => {
    try {
      const res = await listMatters({ status: 'active' });
      if (res.success) {
        setMatters(res.data || []);
      }
    } catch {}
  };

  const loadApplications = async () => {
    setLoading(true);
    try {
      const params: any = { page, pageSize, status: 'submitted' as ApplicationStatus };
      if (keyword) params.keyword = keyword;
      if (matterFilter) params.matterId = matterFilter;
      if (materialCompletenessFilter !== 'all') params.materialCompleteness = materialCompletenessFilter;

      const res = await listApplications(params);
      if (res.success) {
        setApplications(res.data || []);
        setTotal(res.total || 0);
        setSelectedRowKeys([]);
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
    setMatterFilter('');
    setMaterialCompletenessFilter('all');
    setPage(1);
  };

  const getMaterialCount = (record: Application): number => {
    if (record.files && record.files.length > 0) {
      return record.files.length;
    }
    const materials = safeJSONParse<any[]>(record.materials, []);
    return materials.filter(m => m.checked).length;
  };

  const selectedApplications = useMemo(() => {
    const selectedSet = new Set(selectedRowKeys);
    return applications.filter(app => selectedSet.has(app.id));
  }, [applications, selectedRowKeys]);

  const selectedIncompleteCount = useMemo(() => {
    return selectedApplications.filter(app => app.materialCompleteness && !app.materialCompleteness.isComplete).length;
  }, [selectedApplications]);

  const renderMaterialCompleteness = (record: Application) => {
    const completeness = record.materialCompleteness;
    if (!completeness) return <Tag>未计算</Tag>;

    const progress = `${completeness.completedRequired}/${completeness.totalRequired}`;
    if (completeness.isComplete) {
      return <Tag color="success">材料齐全 {progress}</Tag>;
    }
    return <Tag color="warning">缺少必填材料 {progress}</Tag>;
  };

  const handleBatchAccept = async () => {
    if (selectedRowKeys.length === 0) {
      message.warning('请先选择要受理的申请');
      return;
    }

    Modal.confirm({
      title: '批量受理确认',
      content: `确定要受理选中的 ${selectedRowKeys.length} 条申请吗？其中 ${selectedIncompleteCount} 条材料不完整。`,
      onOk: async () => {
        setBatchLoading(true);
        try {
          const res = await batchAcceptApplications(selectedRowKeys as string[]);
          if (res.success && res.data) {
            setBatchResult(res.data);
            setShowResultModal(true);
            loadApplications();
          }
        } finally {
          setBatchLoading(false);
        }
      },
    });
  };

  const handleBatchSupplement = () => {
    if (selectedRowKeys.length === 0) {
      message.warning('请先选择要补正的申请');
      return;
    }
    setSupplementReason('');
    setShowSupplementModal(true);
  };

  const confirmBatchSupplement = async () => {
    if (!supplementReason.trim()) {
      message.warning('请输入补正原因');
      return;
    }

    setBatchLoading(true);
    try {
      const res = await batchSupplementApplications(selectedRowKeys as string[], supplementReason);
      if (res.success && res.data) {
        setBatchResult(res.data);
        setShowSupplementModal(false);
        setShowResultModal(true);
        loadApplications();
      }
    } finally {
      setBatchLoading(false);
    }
  };

  const matterOptions = useMemo(() => {
    return [
      { value: '', label: '全部事项' },
      ...matters.map(m => ({ value: m.id, label: m.name })),
    ];
  }, [matters]);

  const materialCompletenessOptions = [
    { value: 'all', label: '全部' },
    { value: 'complete', label: '材料齐全' },
    { value: 'incomplete', label: '缺少必填材料' },
  ];

  const columns = [
    {
      title: '事项名称',
      dataIndex: 'matterName',
      key: 'matterName',
      width: 200,
      ellipsis: true,
    },
    {
      title: '申请编号',
      dataIndex: 'applicationNo',
      key: 'applicationNo',
      width: 180,
    },
    {
      title: '申请人',
      dataIndex: 'applicantName',
      key: 'applicantName',
      width: 100,
    },
    {
      title: '材料数量',
      dataIndex: 'materials',
      key: 'materialCount',
      width: 100,
      render: (_: string, record: Application) => {
        const count = getMaterialCount(record);
        return (
          <Space size={4}>
            <FileTextOutlined style={{ color: '#1890ff' }} />
            <span>{count} 份</span>
          </Space>
        );
      },
    },
    {
      title: '材料完整度',
      dataIndex: 'materialCompleteness',
      key: 'materialCompleteness',
      width: 160,
      render: (_: any, record: Application) => renderMaterialCompleteness(record),
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
      title: '提交时间',
      dataIndex: 'submitTime',
      key: 'submitTime',
      width: 160,
      render: (text: string, record: Application) => {
        const time = text || record.createdAt;
        return dayjs(time).format('YYYY-MM-DD HH:mm');
      },
      sorter: (a: Application, b: Application) => {
        const aTime = a.submitTime || a.createdAt;
        const bTime = b.submitTime || b.createdAt;
        return new Date(aTime).getTime() - new Date(bTime).getTime();
      },
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      fixed: 'right' as const,
      render: (_: any, record: Application) => (
        <Button type="link" onClick={() => navigate(`/applications/${record.id}`)}>
          详情
        </Button>
      ),
    },
  ];

  const successItems = useMemo(() => {
    return batchResult?.results.filter(r => r.success) || [];
  }, [batchResult]);

  const failureItems = useMemo(() => {
    return batchResult?.results.filter(r => !r.success) || [];
  }, [batchResult]);

  const rowSelection = {
    selectedRowKeys,
    onChange: (newSelectedRowKeys: React.Key[]) => {
      setSelectedRowKeys(newSelectedRowKeys);
    },
    getCheckboxProps: (record: Application) => ({
      disabled: record.status !== 'submitted' || !canOperateStep(record.flowSteps || [], 'submitted', user?.role),
    }),
  };

  return (
    <div>
      <Card
        title="批量受理工作台"
        extra={
          <Space>
            <Button
              type="primary"
              icon={<CheckOutlined />}
              onClick={handleBatchAccept}
              disabled={selectedRowKeys.length === 0}
              loading={batchLoading}
            >
              批量受理 ({selectedRowKeys.length})
            </Button>
            <Button
              icon={<ExclamationOutlined />}
              onClick={handleBatchSupplement}
              disabled={selectedRowKeys.length === 0}
              loading={batchLoading}
            >
              批量要求补正 ({selectedRowKeys.length})
            </Button>
          </Space>
        }
        style={{ marginBottom: 16 }}
      >
        <Space size={12} wrap>
          <Input
            placeholder="搜索申请编号"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            style={{ width: 200 }}
            onPressEnter={handleSearch}
            prefix={<SearchOutlined />}
          />
          <Select
            value={matterFilter}
            onChange={setMatterFilter}
            options={matterOptions}
            style={{ width: 200 }}
            placeholder="选择事项"
          />
          <Select
            value={materialCompletenessFilter}
            onChange={(value: MaterialCompletenessFilter) => {
              setMaterialCompletenessFilter(value);
              setPage(1);
            }}
            options={materialCompletenessOptions}
            style={{ width: 180 }}
            placeholder="材料完整度"
          />
          <Button type="primary" icon={<SearchOutlined />} onClick={handleSearch}>
            搜索
          </Button>
          <Button icon={<ReloadOutlined />} onClick={handleReset}>
            重置
          </Button>
        </Space>
      </Card>

      {selectedRowKeys.length > 0 && (
        <Alert
          message={`已选择 ${selectedRowKeys.length} 条待受理申请，其中 ${selectedIncompleteCount} 条材料不完整`}
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          action={
            <Button size="small" onClick={() => setSelectedRowKeys([])}>
              清空选择
            </Button>
          }
        />
      )}

      <Card>
        <Table
          rowKey="id"
          loading={loading}
          dataSource={applications}
          columns={columns}
          rowSelection={rowSelection}
          pagination={{
            current: page,
            pageSize,
            total,
            onChange: (p, ps) => {
              setPage(p);
              setPageSize(ps);
            },
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 条待受理记录`,
          }}
        />
      </Card>

      <Modal
        title="批量操作结果"
        open={showResultModal}
        onCancel={() => setShowResultModal(false)}
        footer={[
          <Button key="close" type="primary" onClick={() => setShowResultModal(false)}>
            确定
          </Button>,
        ]}
        width={700}
      >
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          <div>
            <Tag color="success" style={{ fontSize: 14, padding: '4px 12px' }}>
              成功 {batchResult?.successCount || 0} 条
            </Tag>
            <Tag color="error" style={{ fontSize: 14, padding: '4px 12px', marginLeft: 8 }}>
              失败 {batchResult?.failureCount || 0} 条
            </Tag>
          </div>

          {failureItems.length > 0 && (
            <Card
              size="small"
              title={
                <Space>
                  <ExclamationOutlined style={{ color: '#ff4d4f' }} />
                  <span>失败列表</span>
                </Space>
              }
              style={{ borderColor: '#ffa39e', background: '#fff1f0' }}
            >
              {failureItems.map((item: BatchOperationItem, idx: number) => (
                <div key={idx} style={{ padding: '8px 0', borderBottom: idx < failureItems.length - 1 ? '1px solid #ffccc7' : 'none' }}>
                  <div style={{ fontWeight: 500 }}>{item.applicationNo || item.id}</div>
                  <div style={{ color: '#ff4d4f', fontSize: 13, marginTop: 4 }}>
                    失败原因：{item.reason}
                  </div>
                </div>
              ))}
            </Card>
          )}

          {successItems.length > 0 && (
            <Card
              size="small"
              title={
                <Space>
                  <CheckOutlined style={{ color: '#52c41a' }} />
                  <span>成功列表</span>
                </Space>
              }
              style={{ borderColor: '#b7eb8f', background: '#f6ffed' }}
            >
              {successItems.map((item: BatchOperationItem, idx: number) => (
                <div key={idx} style={{ padding: '8px 0', borderBottom: idx < successItems.length - 1 ? '1px solid #d9f7be' : 'none' }}>
                  <div style={{ fontWeight: 500 }}>{item.applicationNo || item.id}</div>
                  <div style={{ color: '#52c41a', fontSize: 13, marginTop: 4 }}>
                    操作成功
                  </div>
                </div>
              ))}
            </Card>
          )}
        </Space>
      </Modal>

      <Modal
        title="批量要求补正"
        open={showSupplementModal}
        onCancel={() => setShowSupplementModal(false)}
        onOk={confirmBatchSupplement}
        confirmLoading={batchLoading}
        okText="确认补正"
        width={500}
      >
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          <Alert
            message={`将对选中的 ${selectedRowKeys.length} 条申请发送补正通知，其中 ${selectedIncompleteCount} 条材料不完整`}
            type="warning"
            showIcon
          />
          <div>
            <div style={{ marginBottom: 8, fontWeight: 500 }}>补正原因：</div>
            <Input.TextArea
              value={supplementReason}
              onChange={(e) => setSupplementReason(e.target.value)}
              placeholder="请输入补正原因"
              rows={4}
              maxLength={500}
              showCount
            />
          </div>
        </Space>
      </Modal>
    </div>
  );
}
