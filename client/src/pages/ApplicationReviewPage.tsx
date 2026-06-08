import { useEffect, useState, useMemo } from 'react';
import { Card, Descriptions, Tag, Button, Space, List, Form, Input, Radio, message, Divider, Steps, Tooltip } from 'antd';
import { ArrowLeftOutlined, FileTextOutlined, UserOutlined } from '@ant-design/icons';
import { useParams, useNavigate } from 'react-router-dom';
import { getApplication, reviewApplication } from '../api/applicationApi';
import { Application, FlowStep } from '../types';
import { statusLabels, statusColors, formatFileSize, safeJSONParse, parseFlowConfig, roleLabels } from '../utils/common';
import { getDownloadUrl } from '../api/fileApi';
import dayjs from 'dayjs';

export default function ApplicationReviewPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [application, setApplication] = useState<Application | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (id) {
      loadApplication();
    }
  }, [id]);

  const loadApplication = async () => {
    setLoading(true);
    try {
      const res = await getApplication(id!);
      if (res.success) {
        setApplication(res.data || null);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);
      
      const res = await reviewApplication(id!, {
        pass: values.result === 'pass',
        opinion: values.opinion || '',
      });
      
      if (res.success) {
        message.success('审核完成');
        navigate(`/applications/${id}`);
      }
    } catch (error) {
    } finally {
      setSubmitting(false);
    }
  };

  const basicInfo = application ? safeJSONParse<Record<string, any>>(application.basicInfo, {}) : {};

  const flowSteps: FlowStep[] = useMemo(() => {
    if (application?.flowSteps && application.flowSteps.length > 0) {
      return application.flowSteps;
    }
    return parseFlowConfig(null);
  }, [application]);

  const currentStepIndex = useMemo(() => {
    if (!application) return -1;
    const status = application.status;
    
    const hasStatusField = flowSteps.some(s => s.status);
    if (hasStatusField) {
      let maxCompletedStep = -1;
      flowSteps.forEach((step, idx) => {
        if (step.status === 'accepted' && (status === 'accepted' || status === 'reviewing' || status === 'approved' || status === 'completed')) {
          maxCompletedStep = Math.max(maxCompletedStep, idx);
        }
        if (step.status === 'reviewing' && (status === 'reviewing' || status === 'approved' || status === 'completed')) {
          maxCompletedStep = Math.max(maxCompletedStep, idx);
        }
        if (step.status === 'approved' && (status === 'approved' || status === 'completed')) {
          maxCompletedStep = Math.max(maxCompletedStep, idx);
        }
        if (step.status === 'completed' && status === 'completed') {
          maxCompletedStep = Math.max(maxCompletedStep, idx);
        }
      });
      return maxCompletedStep;
    } else {
      if (status === 'draft' || status === 'submitted') return -1;
      if (status === 'rejected') return flowSteps.length - 1;
      if (status === 'completed') return flowSteps.length - 1;
      if (status === 'supplement') return 0;
      if (status === 'accepted') return Math.min(1, flowSteps.length - 1);
      if (status === 'reviewing') return Math.min(2, flowSteps.length - 1);
      if (status === 'approved') return Math.min(flowSteps.length - 2, flowSteps.length - 1);
      return -1;
    }
  }, [application, flowSteps]);

  if (!application && !loading) {
    return <div style={{ textAlign: 'center', padding: 40 }}>申请不存在</div>;
  }

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)}>
          返回
        </Button>
      </Space>

      <Card title="办理流程" style={{ marginBottom: 16 }}>
        <Steps
          direction="horizontal"
          current={currentStepIndex >= 0 ? currentStepIndex : 0}
          status={currentStepIndex >= 0 ? 'process' : 'wait'}
          items={flowSteps.map((step) => ({
            title: (
              <Tooltip title={step.description || step.name}>
                <span>{step.name}</span>
              </Tooltip>
            ),
            description: (
              <Tooltip title={`可操作角色：${roleLabels[step.role]}`}>
                <span style={{ fontSize: 12, color: '#999' }}>
                  <UserOutlined style={{ marginRight: 4 }} />
                  {roleLabels[step.role]}
                </span>
              </Tooltip>
            ),
          }))}
        />
        {application?.status === 'rejected' && (
          <div style={{ marginTop: 12, textAlign: 'center' }}>
            <Tag color="red" style={{ fontSize: 14, padding: '4px 12px' }}>
              申请已被退回
            </Tag>
          </div>
        )}
        {application?.status === 'supplement' && (
          <div style={{ marginTop: 12, textAlign: 'center' }}>
            <Tag color="orange" style={{ fontSize: 14, padding: '4px 12px' }}>
              待补正材料
            </Tag>
          </div>
        )}
      </Card>

      <Card title="审核申请" style={{ marginBottom: 16 }}>
        <Descriptions bordered column={2} size="small">
          <Descriptions.Item label="申请编号">{application?.applicationNo}</Descriptions.Item>
          <Descriptions.Item label="申请状态">
            <Tag color={statusColors[application?.status || 'draft'] as any}>
              {statusLabels[application?.status || 'draft']}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label="事项名称">{application?.matterName}</Descriptions.Item>
          <Descriptions.Item label="申请人">{application?.applicantName}</Descriptions.Item>
          <Descriptions.Item label="申请时间">
            {application?.submitTime ? dayjs(application.submitTime).format('YYYY-MM-DD HH:mm') : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="受理时间">
            {application?.acceptTime ? dayjs(application.acceptTime).format('YYYY-MM-DD HH:mm') : '-'}
          </Descriptions.Item>
        </Descriptions>
      </Card>

      <Card title="申请信息" style={{ marginBottom: 16 }}>
        {Object.keys(basicInfo).length > 0 ? (
          <Descriptions bordered column={2} size="small">
            {Object.entries(basicInfo).map(([key, value]) => (
              <Descriptions.Item key={key} label={key}>
                {value?.toString() || '-'}
              </Descriptions.Item>
            ))}
          </Descriptions>
        ) : (
          <div style={{ color: '#999', textAlign: 'center', padding: 20 }}>暂无填写信息</div>
        )}
      </Card>

      <Card title="上传材料" style={{ marginBottom: 16 }}>
        <List
          dataSource={application?.files || []}
          renderItem={(item: any) => (
            <List.Item
              actions={[
                <Button type="link" size="small" onClick={() => window.open(getDownloadUrl(item.id))}>
                  下载查看
                </Button>,
              ]}
            >
              <List.Item.Meta
                avatar={<FileTextOutlined style={{ fontSize: 20, color: '#1890ff' }} />}
                title={item.originalName}
                description={`${formatFileSize(item.fileSize)} · ${dayjs(item.createdAt).format('YYYY-MM-DD HH:mm')}`}
              />
            </List.Item>
          )}
        />
        {(!application?.files || application.files.length === 0) && (
          <div style={{ color: '#999', textAlign: 'center', padding: 20 }}>暂无上传材料</div>
        )}
      </Card>

      <Divider />

      <Card title="审核意见">
        <Form form={form} layout="vertical">
          <Form.Item
            label="审核结果"
            name="result"
            rules={[{ required: true, message: '请选择审核结果' }]}
            initialValue="pass"
          >
            <Radio.Group>
              <Radio value="pass">审核通过</Radio>
              <Radio value="reject">审核不通过</Radio>
            </Radio.Group>
          </Form.Item>
          <Form.Item
            label="审核意见"
            name="opinion"
            rules={[{ required: true, message: '请填写审核意见' }]}
          >
            <Input.TextArea rows={6} placeholder="请填写详细的审核意见" />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" onClick={handleSubmit} loading={submitting}>
                提交审核
              </Button>
              <Button onClick={() => navigate(-1)}>取消</Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
}
