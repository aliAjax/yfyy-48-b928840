import { useEffect, useState } from 'react';
import { Card, Table, Button, Space, Modal, Form, Input, InputNumber, Select, message, Tag, Tabs } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { listMatters, createMatter, updateMatter, deleteMatter } from '../api/matterApi';
import { Matter } from '../types';
import { validateFlowConfig } from '../utils/common';
import FlowConfigurator from '../components/FlowConfigurator';

const { TextArea } = Input;

export default function MatterManagePage() {
  const [matters, setMatters] = useState<Matter[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form] = Form.useForm();
  const [materialsText, setMaterialsText] = useState('');
  const [flowText, setFlowText] = useState('');

  useEffect(() => {
    loadMatters();
  }, [page, pageSize]);

  const loadMatters = async () => {
    setLoading(true);
    try {
      const res = await listMatters({ page, pageSize });
      if (res.success) {
        setMatters(res.data || []);
        setTotal(res.total || 0);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    setEditingId(null);
    form.resetFields();
    setMaterialsText(JSON.stringify([
      { name: '身份证复印件', required: true, description: '申请人身份证正反面复印件' },
    ], null, 2));
    setFlowText(JSON.stringify([
      { step: 1, name: '窗口受理', role: 'window', status: 'submitted', description: '窗口人员受理申请' },
      { step: 2, name: '材料审核', role: 'window', status: 'accepted', description: '窗口人员审核材料' },
      { step: 3, name: '业务审核', role: 'reviewer', status: 'reviewing', description: '审核人员业务审核' },
      { step: 4, name: '办结出证', role: 'window', status: 'approved', description: '窗口人员办结发证' },
      { step: 5, name: '已办结', role: 'window', status: 'completed', description: '申请已办结' },
    ], null, 2));
    setModalVisible(true);
  };

  const handleEdit = async (record: Matter) => {
    setEditingId(record.id);
    form.setFieldsValue({
      code: record.code,
      name: record.name,
      department: record.department,
      description: record.description,
      promiseDays: record.promiseDays,
      status: record.status,
    });
    setMaterialsText(record.requiredMaterials);
    setFlowText(record.flowConfig);
    setModalVisible(true);
  };

  const handleDelete = (record: Matter) => {
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除事项"${record.name}"吗？`,
      onOk: async () => {
        try {
          const res = await deleteMatter(record.id);
          if (res.success) {
            message.success('删除成功');
            loadMatters();
          }
        } catch {}
      },
    });
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();

      let materialsParsed: any[] = [];

      try {
        materialsParsed = JSON.parse(materialsText);
      } catch {
        message.error('所需材料JSON格式错误');
        return;
      }

      const flowValidation = validateFlowConfig(flowText);
      if (!flowValidation.valid) {
        message.error(flowValidation.errors[0] || '流程配置校验不通过');
        return;
      }

      const data = {
        ...values,
        requiredMaterials: JSON.stringify(materialsParsed),
        flowConfig: JSON.stringify(flowValidation.steps),
      };

      if (editingId) {
        const res = await updateMatter(editingId, data);
        if (res.success) {
          message.success('更新成功');
        }
      } else {
        const res = await createMatter(data);
        if (res.success) {
          message.success('创建成功');
        }
      }

      setModalVisible(false);
      loadMatters();
    } catch {}
  };

  const columns = [
    {
      title: '事项编码',
      dataIndex: 'code',
      key: 'code',
      width: 120,
    },
    {
      title: '事项名称',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: '办理部门',
      dataIndex: 'department',
      key: 'department',
      width: 150,
    },
    {
      title: '承诺时限',
      dataIndex: 'promiseDays',
      key: 'promiseDays',
      width: 100,
      render: (days: number) => `${days} 个工作日`,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => (
        <Tag color={status === 'active' ? 'green' : 'default'}>
          {status === 'active' ? '启用' : '停用'}
        </Tag>
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 170,
      render: (text: string) => new Date(text).toLocaleString('zh-CN'),
    },
    {
      title: '操作',
      key: 'action',
      width: 160,
      render: (_: any, record: Matter) => (
        <Space size="small">
          <Button type="link" icon={<EditOutlined />} onClick={() => handleEdit(record)}>
            编辑
          </Button>
          <Button type="link" danger icon={<DeleteOutlined />} onClick={() => handleDelete(record)}>
            删除
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <Card
      title="事项管理"
      extra={
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
          新增事项
        </Button>
      }
    >
      <Table
        rowKey="id"
        loading={loading}
        dataSource={matters}
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

      <Modal
        title={editingId ? '编辑事项' : '新增事项'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        onOk={handleSubmit}
        width={800}
        okText="保存"
      >
        <Form form={form} layout="vertical">
          <Space direction="vertical" style={{ width: '100%' }} size="middle">
            <Space style={{ width: '100%' }}>
              <Form.Item
                label="事项编码"
                name="code"
                rules={[{ required: true, message: '请输入事项编码' }]}
                style={{ flex: 1, marginBottom: 0 }}
              >
                <Input placeholder="请输入事项编码" />
              </Form.Item>
              <Form.Item
                label="事项名称"
                name="name"
                rules={[{ required: true, message: '请输入事项名称' }]}
                style={{ flex: 2, marginBottom: 0 }}
              >
                <Input placeholder="请输入事项名称" />
              </Form.Item>
            </Space>
            <Space style={{ width: '100%' }}>
              <Form.Item
                label="办理部门"
                name="department"
                rules={[{ required: true, message: '请输入办理部门' }]}
                style={{ flex: 1, marginBottom: 0 }}
              >
                <Input placeholder="请输入办理部门" />
              </Form.Item>
              <Form.Item
                label="承诺时限（工作日）"
                name="promiseDays"
                rules={[{ required: true, message: '请输入承诺时限' }]}
                style={{ width: 180, marginBottom: 0 }}
              >
                <InputNumber min={1} style={{ width: '100%' }} />
              </Form.Item>
              <Form.Item
                label="状态"
                name="status"
                initialValue="active"
                style={{ marginBottom: 0 }}
              >
                <Select style={{ width: 120 }}>
                  <Select.Option value="active">启用</Select.Option>
                  <Select.Option value="inactive">停用</Select.Option>
                </Select>
              </Form.Item>
            </Space>
            <Form.Item
              label="事项描述"
              name="description"
              style={{ marginBottom: 0 }}
            >
              <TextArea rows={2} placeholder="请输入事项描述" />
            </Form.Item>
            <Form.Item
              label="所需材料（JSON格式）"
              style={{ marginBottom: 0 }}
              extra="数组格式，每项包含 name、required、description 字段"
            >
              <TextArea
                rows={4}
                value={materialsText}
                onChange={(e) => setMaterialsText(e.target.value)}
                placeholder='[{"name": "材料名", "required": true, "description": "说明"}]'
                style={{ fontFamily: 'monospace' }}
              />
            </Form.Item>
            <Tabs
              defaultActiveKey="visual"
              items={[
                {
                  key: 'visual',
                  label: '可视化配置',
                  children: (
                    <FlowConfigurator
                      value={flowText}
                      onChange={(val) => setFlowText(val)}
                    />
                  ),
                },
                {
                  key: 'json',
                  label: 'JSON编辑',
                  children: (
                    <Form.Item
                      label="办理流程（JSON格式）"
                      style={{ marginBottom: 0 }}
                      extra="数组格式，每项包含 step、name、role、status、description 字段"
                    >
                      <TextArea
                        rows={8}
                        value={flowText}
                        onChange={(e) => setFlowText(e.target.value)}
                        placeholder='[{"step": 1, "name": "步骤名", "role": "window", "status": "accepted", "description": "说明"}]'
                        style={{ fontFamily: 'monospace' }}
                      />
                    </Form.Item>
                  ),
                },
              ]}
            />
          </Space>
        </Form>
      </Modal>
    </Card>
  );
}
