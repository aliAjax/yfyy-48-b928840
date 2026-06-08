import { useEffect, useState } from 'react';
import { Card, Table, Button, Space, Modal, Form, Input, Select, message, Tag } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { listUsers, updateUser, deleteUser } from '../api/userApi';
import { User, UserRole } from '../types';
import { roleLabels } from '../utils/common';

export default function UserManagePage() {
  const [users, setUsers] = useState<User[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form] = Form.useForm();

  useEffect(() => {
    loadUsers();
  }, [page, pageSize]);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const res = await listUsers({ page, pageSize });
      if (res.success) {
        setUsers(res.data || []);
        setTotal(res.total || 0);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (record: User) => {
    setEditingId(record.id);
    form.setFieldsValue({
      name: record.name,
      phone: record.phone,
      idCard: record.idCard,
      role: record.role,
    });
    setModalVisible(true);
  };

  const handleDelete = (record: User) => {
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除用户"${record.name}"吗？`,
      onOk: async () => {
        try {
          const res = await deleteUser(record.id);
          if (res.success) {
            message.success('删除成功');
            loadUsers();
          }
        } catch {}
      },
    });
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      if (editingId) {
        const res = await updateUser(editingId, values);
        if (res.success) {
          message.success('更新成功');
          setModalVisible(false);
          loadUsers();
        }
      }
    } catch {}
  };

  const columns = [
    {
      title: '用户名',
      dataIndex: 'username',
      key: 'username',
      width: 120,
    },
    {
      title: '姓名',
      dataIndex: 'name',
      key: 'name',
      width: 120,
    },
    {
      title: '角色',
      dataIndex: 'role',
      key: 'role',
      width: 100,
      render: (role: UserRole) => (
        <Tag color={role === 'admin' ? 'red' : role === 'window' ? 'blue' : role === 'reviewer' ? 'purple' : 'green'}>
          {roleLabels[role]}
        </Tag>
      ),
    },
    {
      title: '手机号',
      dataIndex: 'phone',
      key: 'phone',
      width: 140,
      render: (text: string) => text || '-',
    },
    {
      title: '身份证号',
      dataIndex: 'idCard',
      key: 'idCard',
      width: 200,
      render: (text: string) => text || '-',
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
      width: 140,
      render: (_: any, record: User) => (
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
    <Card title="用户管理">
      <Table
        rowKey="id"
        loading={loading}
        dataSource={users}
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
        title="编辑用户"
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        onOk={handleSubmit}
        okText="保存"
      >
        <Form form={form} layout="vertical">
          <Form.Item
            label="姓名"
            name="name"
            rules={[{ required: true, message: '请输入姓名' }]}
          >
            <Input placeholder="请输入姓名" />
          </Form.Item>
          <Form.Item
            label="角色"
            name="role"
            rules={[{ required: true, message: '请选择角色' }]}
          >
            <Select>
              <Select.Option value="applicant">申请人</Select.Option>
              <Select.Option value="window">窗口人员</Select.Option>
              <Select.Option value="reviewer">审核人员</Select.Option>
              <Select.Option value="admin">管理员</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item label="手机号" name="phone">
            <Input placeholder="请输入手机号" />
          </Form.Item>
          <Form.Item label="身份证号" name="idCard">
            <Input placeholder="请输入身份证号" />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
}
