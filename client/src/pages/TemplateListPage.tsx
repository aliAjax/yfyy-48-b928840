import { useEffect, useState } from 'react';
import { Card, List, Tag, Button, Input, Space, Pagination, Modal, Descriptions, message, Popconfirm } from 'antd';
import { SearchOutlined, FileTextOutlined, DeleteOutlined, PlayCircleOutlined, PlusOutlined, EditOutlined, CopyOutlined } from '@ant-design/icons';
import { listTemplates, deleteTemplate, applyTemplate, updateTemplate, copyTemplate } from '../api/templateApi';
import { ApplicationTemplate, ApplicationMaterial } from '../types';
import { useNavigate } from 'react-router-dom';
import { safeJSONParse } from '../utils/common';
import dayjs from 'dayjs';

const { Search } = Input;

export default function TemplateListPage() {
  const [templates, setTemplates] = useState<ApplicationTemplate[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [keyword, setKeyword] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<ApplicationTemplate | null>(null);
  const [detailVisible, setDetailVisible] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [renameVisible, setRenameVisible] = useState(false);
  const [renameTemplate, setRenameTemplate] = useState<ApplicationTemplate | null>(null);
  const [renameName, setRenameName] = useState('');
  const [copyingId, setCopyingId] = useState<string | null>(null);

  const navigate = useNavigate();

  useEffect(() => {
    loadTemplates();
  }, [page, keyword]);

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

  const handleOpenRename = (template: ApplicationTemplate) => {
    setRenameTemplate(template);
    setRenameName(template.name);
    setRenameVisible(true);
  };

  const handleConfirmRename = async () => {
    const name = renameName.trim();
    if (!name) {
      message.warning('请输入模板名称');
      return;
    }
    if (!renameTemplate) return;

    try {
      setRenaming(true);
      const res = await updateTemplate(renameTemplate.id, { name });
      if (res.success) {
        message.success('重命名成功');
        setRenameVisible(false);
        setRenameTemplate(null);
        setRenameName('');
        loadTemplates();
      }
    } finally {
      setRenaming(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      setDeleting(true);
      const res = await deleteTemplate(id);
      if (res.success) {
        message.success('删除成功');
        loadTemplates();
      }
    } finally {
      setDeleting(false);
    }
  };

  const handleApply = async (template: ApplicationTemplate) => {
    try {
      const res = await applyTemplate(template.id);
      if (res.success && res.data) {
        message.success('已从模板创建申请草稿');
        navigate(`/applications/${res.data.id}/edit`);
      }
    } catch (error) {
      // error handled by interceptor
    }
  };

  const handleCopy = async (template: ApplicationTemplate) => {
    try {
      setCopyingId(template.id);
      const res = await copyTemplate(template.id);
      if (res.success) {
        message.success('模板复制成功');
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
        <List
          loading={loading}
          grid={{ gutter: 16, xs: 1, sm: 2, md: 2, lg: 3, xl: 3 }}
          dataSource={templates}
          locale={{
            emptyText: '暂无模板，您可以在填写申请时保存为模板',
          }}
          renderItem={(template) => {
            const itemMaterials = safeJSONParse<ApplicationMaterial[]>(template.materials, []);
            return (
              <List.Item>
                <Card
                  hoverable
                  actions={[
                    <Button type="link" onClick={() => handleViewDetail(template)}>查看详情</Button>,
                    <Button type="link" onClick={() => handleOpenRename(template)}>
                      <EditOutlined /> 重命名
                    </Button>,
                    <Button type="link" loading={copyingId === template.id} onClick={() => handleCopy(template)}>
                      <CopyOutlined /> 复制
                    </Button>,
                    <Button type="link" onClick={() => handleApply(template)}>
                      <PlayCircleOutlined /> 套用
                    </Button>,
                    <Popconfirm
                      title="确定删除此模板？"
                      description="删除后无法恢复"
                      onConfirm={() => handleDelete(template.id)}
                      okText="确定"
                      cancelText="取消"
                    >
                      <Button type="link" danger>
                        <DeleteOutlined /> 删除
                      </Button>
                    </Popconfirm>,
                  ]}
                >
                  <Card.Meta
                    title={
                      <Space>
                        <PlusOutlined style={{ color: '#1890ff' }} />
                        <span>{template.name}</span>
                      </Space>
                    }
                    description={
                      <div style={{ marginTop: 12 }}>
                        <div style={{ marginBottom: 8 }}>
                          <Tag color="blue">{template.matterName}</Tag>
                        </div>
                        <p style={{ color: '#666', fontSize: 13, marginBottom: 8 }}>
                          共 {itemMaterials.length} 项材料
                        </p>
                        <div style={{ display: 'flex', alignItems: 'center', color: '#999', fontSize: 12 }}>
                          <FileTextOutlined style={{ marginRight: 4 }} />
                          创建时间：{dayjs(template.createdAt).format('YYYY-MM-DD HH:mm')}
                        </div>
                      </div>
                    }
                  />
                </Card>
              </List.Item>
            );
          }}
        />
        <div style={{ marginTop: 24, textAlign: 'right' }}>
          <Pagination
            current={page}
            total={total}
            pageSize={pageSize}
            onChange={setPage}
            showSizeChanger={false}
          />
        </div>
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
        onCancel={() => {
          setRenameVisible(false);
          setRenameTemplate(null);
          setRenameName('');
        }}
        onOk={handleConfirmRename}
        confirmLoading={renaming}
        okText="保存"
        cancelText="取消"
      >
        <Input
          placeholder="请输入模板名称"
          value={renameName}
          maxLength={50}
          showCount
          onChange={(e) => setRenameName(e.target.value)}
          onPressEnter={handleConfirmRename}
        />
      </Modal>
    </div>
  );
}
