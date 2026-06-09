import { useState, useEffect, useMemo } from 'react';
import { Card, Button, Input, Select, Space, List, Modal, Form, message, Tag, Alert, Steps, Tooltip, Divider } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, UpOutlined, DownOutlined, SettingOutlined, EyeOutlined, CheckCircleOutlined, WarningOutlined } from '@ant-design/icons';
import { FlowStep, UserRole, ApplicationStatus } from '../types';
import { roleLabels, statusLabels, validateFlowConfig, FlowValidationResult } from '../utils/common';

const { TextArea } = Input;

interface FlowConfiguratorProps {
  value?: string;
  onChange?: (value: string) => void;
  disabled?: boolean;
  onValidationChange?: (result: FlowValidationResult) => void;
}

const statusOptions: { value: ApplicationStatus; label: string }[] = [
  { value: 'submitted', label: '窗口受理' },
  { value: 'accepted', label: '材料审核' },
  { value: 'reviewing', label: '业务审核' },
  { value: 'approved', label: '办结' },
  { value: 'completed', label: '已办结' },
];

const roleOptions: { value: UserRole; label: string }[] = [
  { value: 'window', label: '窗口人员' },
  { value: 'reviewer', label: '审核人员' },
  { value: 'admin', label: '管理员' },
];

export default function FlowConfigurator({ value, onChange, disabled = false, onValidationChange }: FlowConfiguratorProps) {
  const [steps, setSteps] = useState<FlowStep[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [editingStep, setEditingStep] = useState<FlowStep | null>(null);
  const [editingIndex, setEditingIndex] = useState<number>(-1);
  const [form] = Form.useForm();

  const validation = useMemo(() => validateFlowConfig(steps), [steps]);

  useEffect(() => {
    onValidationChange?.(validation);
  }, [validation, onValidationChange]);

  useEffect(() => {
    if (value) {
      try {
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed)) {
          setSteps(parsed.sort((a: FlowStep, b: FlowStep) => a.step - b.step));
          return;
        }
      } catch {}
    }
    setSteps([
      { step: 1, name: '窗口受理', role: 'window', description: '窗口人员受理申请', status: 'submitted' },
      { step: 2, name: '材料审核', role: 'window', description: '窗口人员审核材料', status: 'accepted' },
      { step: 3, name: '业务审核', role: 'reviewer', description: '审核人员业务审核', status: 'reviewing' },
      { step: 4, name: '办结出证', role: 'window', description: '窗口人员办结发证', status: 'approved' },
      { step: 5, name: '已办结', role: 'window', description: '申请已办结', status: 'completed' },
    ]);
  }, [value]);

  const updateSteps = (newSteps: FlowStep[]) => {
    const renumbered = newSteps.map((s, idx) => ({ ...s, step: idx + 1 }));
    setSteps(renumbered);
    onChange?.(JSON.stringify(renumbered));
  };

  const handleAdd = () => {
    setEditingStep(null);
    setEditingIndex(-1);
    form.resetFields();
    form.setFieldsValue({
      name: '',
      role: 'window',
      description: '',
      status: 'submitted',
    });
    setModalVisible(true);
  };

  const handleEdit = (step: FlowStep, index: number) => {
    setEditingStep(step);
    setEditingIndex(index);
    form.setFieldsValue({
      name: step.name,
      role: step.role,
      description: step.description || '',
      status: step.status || 'accepted',
    });
    setModalVisible(true);
  };

  const handleDelete = (index: number) => {
    Modal.confirm({
      title: '确认删除',
      content: '确定要删除该流程步骤吗？',
      onOk: () => {
        const newSteps = steps.filter((_, i) => i !== index);
        if (newSteps.length === 0) {
          message.warning('至少保留一个流程步骤');
          return;
        }
        updateSteps(newSteps);
      },
    });
  };

  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    const newSteps = [...steps];
    [newSteps[index - 1], newSteps[index]] = [newSteps[index], newSteps[index - 1]];
    updateSteps(newSteps);
  };

  const handleMoveDown = (index: number) => {
    if (index === steps.length - 1) return;
    const newSteps = [...steps];
    [newSteps[index], newSteps[index + 1]] = [newSteps[index + 1], newSteps[index]];
    updateSteps(newSteps);
  };

  const handleModalOk = async () => {
    try {
      const values = await form.validateFields();
      const newStep: FlowStep = {
        step: editingIndex >= 0 ? steps[editingIndex].step : steps.length + 1,
        name: values.name,
        role: values.role,
        description: values.description,
        status: values.status,
      };

      let newSteps: FlowStep[];
      if (editingIndex >= 0) {
        newSteps = [...steps];
        newSteps[editingIndex] = newStep;
      } else {
        newSteps = [...steps, newStep];
      }
      updateSteps(newSteps);
      setModalVisible(false);
    } catch {}
  };

  const getRoleColor = (role: UserRole) => {
    switch (role) {
      case 'window': return 'blue';
      case 'reviewer': return 'purple';
      case 'admin': return 'red';
      default: return 'default';
    }
  };

  const getStatusColor = (status?: ApplicationStatus) => {
    if (!status) return 'default';
    switch (status) {
      case 'submitted': return 'processing';
      case 'accepted': return 'processing';
      case 'reviewing': return 'processing';
      case 'approved': return 'success';
      case 'completed': return 'success';
      default: return 'default';
    }
  };

  const renderValidationTips = () => {
    if (validation.errors.length === 0 && validation.warnings.length === 0) {
      return (
        <Alert
          icon={<CheckCircleOutlined />}
          message="流程配置校验通过"
          type="success"
          showIcon
          style={{ marginBottom: 12 }}
        />
      );
    }
    return (
      <Space direction="vertical" style={{ width: '100%', marginBottom: 12 }}>
        {validation.errors.length > 0 && (
          <Alert
            message="配置错误"
            description={
              <ul style={{ margin: 0, paddingLeft: 20 }}>
                {validation.errors.map((err, idx) => (
                  <li key={idx}>{err}</li>
                ))}
              </ul>
            }
            type="error"
            showIcon
          />
        )}
        {validation.warnings.length > 0 && (
          <Alert
            message="配置建议"
            description={
              <ul style={{ margin: 0, paddingLeft: 20 }}>
                {validation.warnings.map((warn, idx) => (
                  <li key={idx}>{warn}</li>
                ))}
              </ul>
            }
            type="warning"
            showIcon
          />
        )}
      </Space>
    );
  };

  const renderPreviewModal = () => (
    <Modal
      title="流程预览"
      open={previewVisible}
      onCancel={() => setPreviewVisible(false)}
      footer={[
        <Button key="close" onClick={() => setPreviewVisible(false)}>关闭</Button>,
      ]}
      width={700}
    >
      <div style={{ marginBottom: 16 }}>
        <Divider orientation="left" plain style={{ marginBottom: 12 }}>
          <Space>
            <EyeOutlined />
            <span>流程步骤概览</span>
          </Space>
        </Divider>
        <Steps
          direction="vertical"
          size="small"
          current={-1}
          items={steps.map((step) => ({
            title: (
              <Space>
                <strong>{step.name}</strong>
                <Tag color={getStatusColor(step.status)}>
                  {step.status ? statusLabels[step.status] : '未设置状态'}
                </Tag>
              </Space>
            ),
            description: (
              <Space direction="vertical" size={4} style={{ marginTop: 4 }}>
                <Space size={8}>
                  <Tag color={getRoleColor(step.role)}>
                    操作角色：{roleLabels[step.role]}
                  </Tag>
                </Space>
                {step.description && (
                  <span style={{ color: '#666', fontSize: 12 }}>
                    {step.description}
                  </span>
                )}
              </Space>
            ),
            status: 'process' as const,
          }))}
        />
      </div>

      <div>
        <Divider orientation="left" plain style={{ marginBottom: 12 }}>
          <Space>
            <WarningOutlined />
            <span>流程流转说明</span>
          </Space>
        </Divider>
        <div style={{ background: '#fafafa', padding: 16, borderRadius: 6, border: '1px solid #e8e8e8' }}>
          <List
            size="small"
            dataSource={steps}
            renderItem={(item, index) => (
              <List.Item>
                <List.Item.Meta
                  avatar={
                    <div style={{
                      width: 28,
                      height: 28,
                      borderRadius: '50%',
                      background: '#1890ff',
                      color: '#fff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 'bold',
                      fontSize: 12,
                    }}>
                      {index + 1}
                    </div>
                  }
                  title={
                    <Space>
                      <span>{item.name}</span>
                      {index < steps.length - 1 && (
                        <span style={{ color: '#bfbfbf' }}>→</span>
                      )}
                    </Space>
                  }
                  description={
                    <Tooltip title={`由【${roleLabels[item.role]}】操作`}>
                      <span style={{ fontSize: 12, color: '#8c8c8c' }}>
                        由 <Tag color={getRoleColor(item.role)} style={{ margin: 0 }}>{roleLabels[item.role]}</Tag> 操作
                        {item.status && `，对应状态：${statusLabels[item.status]}`}
                      </span>
                    </Tooltip>
                  }
                />
              </List.Item>
            )}
          />
        </div>
      </div>
    </Modal>
  );

  return (
    <Card
      title={
        <Space>
          <SettingOutlined />
          <span>审批流程配置</span>
        </Space>
      }
      extra={
        <Space>
          <Button
            icon={<EyeOutlined />}
            onClick={() => setPreviewVisible(true)}
            disabled={steps.length === 0}
          >
            流程预览
          </Button>
          {!disabled && (
            <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
              添加步骤
            </Button>
          )}
        </Space>
      }
      size="small"
    >
      {renderValidationTips()}

      <List
        dataSource={steps}
        renderItem={(item, index) => (
          <List.Item
            style={{
              padding: '12px 16px',
              border: '1px solid #e8e8e8',
              borderRadius: 6,
              marginBottom: 8,
              background: '#fafafa',
            }}
            actions={
              !disabled
                ? [
                    <Button
                      type="text"
                      size="small"
                      icon={<UpOutlined />}
                      onClick={() => handleMoveUp(index)}
                      disabled={index === 0}
                    />,
                    <Button
                      type="text"
                      size="small"
                      icon={<DownOutlined />}
                      onClick={() => handleMoveDown(index)}
                      disabled={index === steps.length - 1}
                    />,
                    <Button
                      type="text"
                      size="small"
                      icon={<EditOutlined />}
                      onClick={() => handleEdit(item, index)}
                    />,
                    <Button
                      type="text"
                      size="small"
                      danger
                      icon={<DeleteOutlined />}
                      onClick={() => handleDelete(index)}
                    />,
                  ]
                : []
            }
          >
            <List.Item.Meta
              avatar={
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    background: '#1890ff',
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 'bold',
                    fontSize: 14,
                  }}
                >
                  {item.step}
                </div>
              }
              title={
                <Space>
                  <strong>{item.name}</strong>
                  <Tag color={getRoleColor(item.role)}>
                    {roleLabels[item.role]}
                  </Tag>
                  {item.status && (
                    <Tag color={getStatusColor(item.status)}>
                      {statusLabels[item.status]}
                    </Tag>
                  )}
                </Space>
              }
              description={item.description || '暂无描述'}
            />
          </List.Item>
        )}
      />
      {steps.length === 0 && (
        <div style={{ textAlign: 'center', color: '#999', padding: 20 }}>
          暂无流程步骤
        </div>
      )}

      <Modal
        title={editingStep ? '编辑流程步骤' : '添加流程步骤'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        onOk={handleModalOk}
        okText="保存"
        width={500}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            label="步骤名称"
            name="name"
            rules={[{ required: true, message: '请输入步骤名称' }]}
          >
            <Input placeholder="请输入步骤名称" maxLength={50} />
          </Form.Item>
          <Space style={{ width: '100%' }}>
            <Form.Item
              label="可操作角色"
              name="role"
              rules={[{ required: true, message: '请选择可操作角色' }]}
              style={{ flex: 1, marginBottom: 0 }}
            >
              <Select placeholder="请选择角色">
                {roleOptions.map(opt => (
                  <Select.Option key={opt.value} value={opt.value}>
                    {opt.label}
                  </Select.Option>
                ))}
              </Select>
            </Form.Item>
            <Form.Item
              label="对应状态"
              name="status"
              rules={[{ required: true, message: '请选择对应状态' }]}
              style={{ flex: 1, marginBottom: 0 }}
            >
              <Select placeholder="请选择状态">
                {statusOptions.map(opt => (
                  <Select.Option key={opt.value} value={opt.value}>
                    {opt.label}
                  </Select.Option>
                ))}
              </Select>
            </Form.Item>
          </Space>
          <Form.Item
            label="步骤描述"
            name="description"
            style={{ marginTop: 16 }}
          >
            <TextArea rows={3} placeholder="请输入步骤描述（选填）" maxLength={200} />
          </Form.Item>
        </Form>
      </Modal>

      {renderPreviewModal()}
    </Card>
  );
}
