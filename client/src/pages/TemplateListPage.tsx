import { useEffect, useState } from 'react';
import { Card, Table, Tag, Button, Input, Space, Modal, Descriptions, message, Popconfirm } from 'antd';
import { SearchOutlined, EditOutlined, CopyOutlined, PlayCircleOutlined, DeleteOutlined, EyeOutlined } from '@ant-design/icons';
import { listTemplates, deleteTemplate, applyTemplate, updateTemplate, copyTemplate } from '../api/templateApi';
import { ApplicationTemplate, ApplicationMaterial } from '../types';
import { useNavigate } from 'react-router-dom';
import { safeJSONParse } from '../utils/common';
import dayjs from 'dayjs';
import type { ColumnsType } from 'antd/es/table';

const { Search } = Input;

export default function TemplateListPage() {
  const [templates, setTemplates] = useState<ApplicationTemplate[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [keyword, setKeyword] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<ApplicationTemplate | null>(null);
  const [detailVisible, setDetailVisible] = useState(false);
  const [renameVisible, setRenameVisible] = useState(false);
  const [renameTemplate, setRenameTemplate] = useState<ApplicationTemplate | null>(null);
  const [renameInput, setRenameInput] = useState('');
  const [renaming, setRenaming] = useState(false);
  const [copyingId, setCopyingId] = useState<string | null>(null);
  const [applyingId, setApplyingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const navigate = useNavigate();

  useEffect(() => {
    loadTemplates();
  }, [page, pageSize, keyword]);

  const loadTemplates = async () => {
    setLoading(true);
    try {
      const res = await listTemplates({
        keyword: keyword || undefined,
        page,
        pageSize,
      });
      if (res.success) {
        setTemplates(res.data || []);
        setTotal(res.total || 0);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (value: string) => {
    setKeyword(value);
    setPage(1);
  };

  const handleViewDetail = (template: ApplicationTemplate) => {
    setSelectedTemplate(template);
    setDetailVisible(true);
  };

  const handleDelete = async (id: string) => {
    try {
      setDeletingId(id);
      const res = await deleteTemplate(id);
      if (res.success) {
        message.success('删除成功');
        loadTemplates();
      }
    } finally {
      setDeletingId(null);
    }
  };

  const handleApply = async (template: ApplicationTemplate) => {
    try {
      setApplyingId(template.id);
      const res = await applyTemplate(template.id);
      if (res.success && res.data) {
        message.success('已从模板创建申请草稿');
        navigate(`/applications/${res.data.id}/edit`);
      }
    } catch (error) {
      // error handled by interceptor
    } finally {
      setApplyingId(null);
    }
  };

  const handleRenameClick = (template: ApplicationTemplate) => {
    setRenameTemplate(template);
    setRenameInput(template.name);
    setRenameVisible(true);
  };

  const handleRename = async () => {
    if (!renameTemplate || !renameInput.trim()) {
      message.warning('模板名称不能为空');
      return;
    }
    try {
      setRenaming(true);
      const res = await updateTemplate(renameTemplate.id, { name: renameInput.trim() });
      if (res.success) {
        message.success('重命名成功');
        setRenameVisible(false);
        loadTemplates();
      }
    } finally {
      setRenaming(false);
    }
  };

  const handleCopy = async (template: ApplicationTemplate) => {
    try {
      setCopyingId(template.id);
      const res = await copyTemplate(template.id);
      if (res.success) {
        message.success('复制成功');
        loadTemplates();
      }
    } finally {
      setCopyingId(null);
    }
  };

  const basicInfo = selectedTemplate
    ? safeJSONParse<Record<string, any>>(selectedTemplate.basicInfo, {})
    : {};

  const materials = selectedTemplate
    ? safeJSONParse<ApplicationMaterial[]>(selectedTemplate.materials, [])
    : [];

  const columns: ColumnsType<ApplicationTemplate> = [
    {
      title: '模板名称',
      dataIndex: 'name',
      key: 'name',
      ellipsis: true,
      render: (name: string) => (
        <Space>
          <EditOutlined style={{ color: '#1890ff' }} />
          <span>{name}</span>
        </Space>
      ),
    },
    {
      title: '所属事项',
      dataIndex: 'matterName',
      key: 'matterName',
      width: 200,
      render: (matterName: string) => <Tag color="blue">{matterName}</Tag>,
    },
    {
      title: '材料数量',
      dataIndex: 'materials',
      key: 'materialCount',
      width: 100,
      align: 'center',
      render: (materialsStr: string) => {
        const ms = safeJSONParse<ApplicationMaterial[]>(materialsStr, []);
        return ms.length;
      },
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 180,
      render: (createdAt: string) => dayjs(createdAt).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: '操作',
      key: 'action',
      width: 320,
      fixed: 'right',
      render: (_, record: ApplicationTemplate) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => handleViewDetail(record)}
          >
            详情
          </Button>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleRenameClick(record)}
          >
            重命名
          </Button>
          <Button
            type="link"
            size="small"
            icon={<CopyOutlined />}
            loading={copyingId === record.id}
            onClick={() => handleCopy(record)}
          >
            复制
          </Button>
          <Button
            type="link"
            size="small"
            icon={<PlayCircleOutlined />}
            loading={applyingId === record.id}
            onClick={() => handleApply(record)}
          >
            套用
          </Button>
          <Popconfirm
            title="确定删除此模板？"
            description="删除后无法恢复"
            onConfirm={() => handleDelete(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Button
              type="link"
              size="small"
              danger
              icon={<DeleteOutlined />}
              loading={deletingId === record.id}
            >
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Card
        title="常用申请模板"
        extra={
          <Space>
            <Search
              placeholder="搜索模板名称"
              allowClear
              enterButton={<SearchOutlined />}
              size="middle"
              onSearch={handleSearch}
              style={{ width: 300 }}
            />
          </Space>
        }
      >
        <Table
          rowKey="id"
          loading={loading}
          columns={columns}
          dataSource={templates}
          pagination={{
            current: page,
            pageSize,
            total,
            showSizeChanger: true,
            pageSizeOptions: ['10', '20', '50'],
            showTotal: (total) => `共 ${total} 条记录`,
            onChange: (page, pageSize) => {
              setPage(page);
              setPageSize(pageSize);
            },
          }}
          locale={{
            emptyText: '暂无模板，您可以在填写申请时保存为模板',
          }}
        />
      </Card>

      <Modal
        title="模板详情"
        open={detailVisible}
        onCancel={() => setDetailVisible(false)}
        footer={[
          <Button key="close" onClick={() => setDetailVisible(false)}>关闭</Button>,
          <Button key="apply" type="primary" onClick={() => {
            setDetailVisible(false);
            if (selectedTemplate) handleApply(selectedTemplate);
          }}>
            套用此模板
          </Button>,
        ]}
        width={600}
      >
        {selectedTemplate && (
          <Descriptions column={1} bordered size="small">
            <Descriptions.Item label="模板名称">{selectedTemplate.name}</Descriptions.Item>
            <Descriptions.Item label="所属事项">{selectedTemplate.matterName}</Descriptions.Item>
            <Descriptions.Item label="创建时间">
              {dayjs(selectedTemplate.createdAt).format('YYYY-MM-DD HH:mm')}
            </Descriptions.Item>
            <Descriptions.Item label="基本信息">
              {Object.keys(basicInfo).length > 0 ? (
                <ul style={{ margin: 0, paddingLeft: 20 }}>
                  {Object.entries(basicInfo).map(([key, value]) => (
                    <li key={key}>
                      <strong>{key}：</strong>
                      {String(value || '-')}
                    </li>
                  ))}
                </ul>
              ) : '暂无'}
            </Descriptions.Item>
            <Descriptions.Item label="材料清单">
              {materials.length > 0 ? (
                <ul style={{ margin: 0, paddingLeft: 20 }}>
                  {materials.map((m, idx) => (
                    <li key={idx}>
                      {m.required && <span style={{ color: 'red' }}>* </span>}
                      {m.name}
                      {m.checked ? (
                        <Tag color="success" style={{ marginLeft: 8 }}>已准备</Tag>
                      ) : (
                        <Tag style={{ marginLeft: 8 }}>未准备</Tag>
                      )}
                    </li>
                  ))}
                </ul>
              ) : '暂无'}
            </Descriptions.Item>
          </Descriptions>
        )}
      </Modal>

      <Modal
        title="重命名模板"
        open={renameVisible}
        onCancel={() => setRenameVisible(false)}
        onOk={handleRename}
        confirmLoading={renaming}
        okText="确定"
        cancelText="取消"
        width={400}
      >
        <Input
          value={renameInput}
          onChange={(e) => setRenameInput(e.target.value)}
          placeholder="请输入新的模板名称"
          onPressEnter={handleRename}
          maxLength={50}
          showCount
          autoFocus
        />
      </Modal>
    </div>
  );
}
