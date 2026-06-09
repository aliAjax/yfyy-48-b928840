import { useEffect, useState } from 'react';
import { Card, Descriptions, Tag, Button, Space, List, Form, Input, Radio, message, Divider, Steps, Tooltip, Modal, Collapse, Empty } from 'antd';
import { ArrowLeftOutlined, FileTextOutlined, UserOutlined, HistoryOutlined, DownloadOutlined, CheckCircleOutlined, CloseCircleOutlined, ExclamationCircleOutlined, SaveOutlined, CheckOutlined, CloseOutlined, FolderOpenOutlined } from '@ant-design/icons';
import { useParams, useNavigate } from 'react-router-dom';
import { getApplication, reviewApplication } from '../api/applicationApi';
import { Application, MaterialFile, Matter } from '../types';
import { statusLabels, statusColors, formatFileSize, safeJSONParse, roleLabels } from '../utils/common';
import { getDownloadUrl } from '../api/fileApi';
import { getMatter } from '../api/matterApi';
import FileVersionModal from '../components/FileVersionModal';
import { useFileVersionModal } from '../hooks/useFileVersionModal';
import { useReviewFlowSteps } from '../hooks/useReviewFlowSteps';
import { useReviewOpinionForm } from '../hooks/useReviewOpinionForm';
import dayjs from 'dayjs';

const { Panel } = Collapse;
const { TextArea } = Input;

export default function ApplicationReviewPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [application, setApplication] = useState<Application | null>(null);
  const [matter, setMatter] = useState<Matter | null>(null);
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
        if (res.data?.matterId) {
          const matterRes = await getMatter(res.data.matterId);
          if (matterRes.success) {
            setMatter(matterRes.data || null);
          }
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const versionModal = useFileVersionModal(id);
  const { flowSteps, currentStepIndex } = useReviewFlowSteps(application);
  const {
    saving,
    formData,
    passCount,
    problemCount,
    groupedOpinions,
    reviewRounds,
    matterMaterials,
    getFilesForMaterial,
    handleStatusChange,
    handleOpinionChange,
    handleMarkAllPass,
    handleMarkAllProblem,
    handleSaveDraft,
  } = useReviewOpinionForm({
    applicationId: id,
    matter,
    files: application?.files || [],
  });

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      
      const problemItems = formData.filter(item => item.status === 'problem' && !item.opinion.trim());
      if (problemItems.length > 0) {
        message.error(`存在问题的材料必须填写具体意见：${problemItems.map(i => i.materialName).join('、')}`);
        return;
      }

      const hasProblem = formData.some(item => item.status === 'problem');
      if (values.result === 'pass' && hasProblem) {
        Modal.confirm({
          title: '确认审核通过？',
          content: '部分材料标记为"存在问题"，但您选择了"审核通过"。是否继续？',
          okText: '确认通过',
          okButtonProps: { danger: true },
          cancelText: '返回修改',
          onOk: () => doSubmit(values),
        });
        return;
      }

      doSubmit(values);
    } catch (error) {
    }
  };

  const doSubmit = async (values: any) => {
    setSubmitting(true);
    try {
      const res = await reviewApplication(id!, {
        pass: values.result === 'pass',
        opinion: values.opinion || '',
        reviewOpinions: formData,
      });
      
      if (res.success) {
        message.success('审核完成');
        navigate(`/applications/${id}`);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const basicInfo = application ? safeJSONParse<Record<string, any>>(application.basicInfo, {}) : {};

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

      <Card
        title={
          <Space>
            <span>上传材料</span>
            <Tag color="blue">共 {application?.files?.length || 0} 份当前版本</Tag>
          </Space>
        }
        style={{ marginBottom: 16 }}
      >
        <List
          dataSource={application?.files || []}
          renderItem={(item: MaterialFile) => (
            <List.Item
              style={{
                padding: '12px 16px',
                background: item.isCurrent ? '#f6ffed' : '#fff',
                borderLeft: item.isCurrent ? '3px solid #52c41a' : '3px solid #d9d9d9',
                marginBottom: 8,
                borderRadius: 4,
              }}
              actions={[
                <Button
                  key="history"
                  type="link"
                  size="small"
                  icon={<HistoryOutlined />}
                  onClick={() => versionModal.handleViewVersions(item)}
                >
                  版本历史
                </Button>,
                <Button
                  key="download"
                  type={item.isCurrent ? 'primary' : 'link'}
                  size="small"
                  icon={<DownloadOutlined />}
                  onClick={() => window.open(getDownloadUrl(item.id))}
                >
                  {item.isCurrent ? '下载当前版' : '下载'}
                </Button>,
              ]}
            >
              <List.Item.Meta
                avatar={<FileTextOutlined style={{ fontSize: 28, color: item.isCurrent ? '#52c41a' : '#1890ff' }} />}
                title={
                  <Space>
                    <strong style={{ fontSize: 14 }}>{item.originalName}</strong>
                    <Tag color={item.isCurrent ? 'green' : 'default'} style={{ fontWeight: 'bold' }}>
                      v{item.version}
                    </Tag>
                    {item.isCurrent && (
                      <Tag color="success" icon={<CheckCircleOutlined />}>
                        当前版本
                      </Tag>
                    )}
                  </Space>
                }
                description={
                  <div style={{ color: '#666' }}>
                    <Space size={16}>
                      <span>文件大小：{formatFileSize(item.fileSize)}</span>
                      <span>上传时间：{dayjs(item.createdAt).format('YYYY-MM-DD HH:mm')}</span>
                      {item.uploadedByName && <span>上传人：{item.uploadedByName}</span>}
                    </Space>
                    {item.versionNote && (
                      <div style={{ marginTop: 6, padding: '6px 10px', background: '#f5f5f5', borderRadius: 4, fontSize: 12 }}>
                        版本说明：{item.versionNote}
                      </div>
                    )}
                  </div>
                }
              />
            </List.Item>
          )}
        />
        {(!application?.files || application.files.length === 0) && (
          <Empty description="暂无上传材料" />
        )}
      </Card>

      <FileVersionModal
        open={versionModal.visible}
        currentVersionFile={versionModal.currentVersionFile}
        versionList={versionModal.versionList}
        loading={versionModal.loading}
        onCancel={versionModal.handleClose}
      />

      <Divider />

      <Card
        title={
          <Space>
            <span>材料审查意见</span>
            <Tag color="green">通过 {passCount} 项</Tag>
            <Tag color="orange">存在问题 {problemCount} 项</Tag>
            <Tag color="blue">共 {formData.length} 项</Tag>
          </Space>
        }
        style={{ marginBottom: 16 }}
        extra={
          <Space>
            <Button
              size="small"
              icon={<CheckOutlined />}
              onClick={handleMarkAllPass}
            >
              全部通过
            </Button>
            <Button
              size="small"
              danger
              icon={<CloseOutlined />}
              onClick={handleMarkAllProblem}
            >
              全部问题
            </Button>
            <Button
              icon={<SaveOutlined />}
              onClick={handleSaveDraft}
              loading={saving}
              type="primary"
              ghost
            >
              保存草稿
            </Button>
          </Space>
        }
      >
        {formData.length > 0 ? (
          <div style={{ border: '1px solid #e8e8e8', borderRadius: 8, overflow: 'hidden' }}>
            {formData.map((item, idx) => {
              const materialFiles = getFilesForMaterial(item.materialName);
              const materialInfo = matterMaterials.find(m => m.name === item.materialName);
              return (
                <div
                  key={item.materialName}
                  style={{
                    padding: '20px',
                    borderBottom: idx < formData.length - 1 ? '1px solid #f0f0f0' : 'none',
                    background: item.status === 'pass' ? '#f6ffed' : '#fff7e6',
                    transition: 'background 0.3s',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
                    <div style={{ marginTop: 4 }}>
                      {item.status === 'pass' ? (
                        <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 22 }} />
                      ) : (
                        <ExclamationCircleOutlined style={{ color: '#faad14', fontSize: 22 }} />
                      )}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 12 }}>
                        <strong style={{ fontSize: 16 }}>
                          {materialInfo?.required && <span style={{ color: '#ff4d4f', marginRight: 4 }}>*</span>}
                          {item.materialName}
                        </strong>
                        <Radio.Group
                          value={item.status}
                          onChange={(e) => handleStatusChange(item.materialName, e.target.value)}
                          size="middle"
                        >
                          <Radio.Button value="pass">
                            <CheckCircleOutlined style={{ color: '#52c41a' }} /> 通过
                          </Radio.Button>
                          <Radio.Button value="problem">
                            <ExclamationCircleOutlined style={{ color: '#faad14' }} /> 存在问题
                          </Radio.Button>
                        </Radio.Group>
                        <Tag color={item.status === 'pass' ? 'success' : 'warning'} style={{ marginLeft: 'auto' }}>
                          {item.status === 'pass' ? '材料合规' : '需修改'}
                        </Tag>
                      </div>

                      {materialInfo?.description && (
                        <div style={{ color: '#999', fontSize: 13, marginBottom: 12, padding: '8px 12px', background: 'rgba(0,0,0,0.02)', borderRadius: 4 }}>
                          <span style={{ marginRight: 8 }}>📋</span>
                          材料要求：{materialInfo.description}
                        </div>
                      )}

                      {materialFiles.length > 0 && (
                        <div style={{ marginBottom: 12, padding: '12px 16px', background: 'rgba(255,255,255,0.8)', borderRadius: 6, border: '1px solid #e8e8e8' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                            <FolderOpenOutlined style={{ color: '#1890ff' }} />
                            <span style={{ fontWeight: 500, color: '#333' }}>相关上传文件（{materialFiles.length}）</span>
                          </div>
                          <Space wrap size={[8, 8]}>
                            {materialFiles.map(file => (
                              <Button
                                key={file.id}
                                size="small"
                                type="link"
                                icon={<FileTextOutlined />}
                                onClick={() => window.open(getDownloadUrl(file.id))}
                                style={{ margin: 0 }}
                              >
                                {file.originalName}
                                <Tag color={file.isCurrent ? 'green' : 'default'} style={{ marginLeft: 6 }}>
                                  v{file.version}
                                </Tag>
                              </Button>
                            ))}
                          </Space>
                        </div>
                      )}

                      <TextArea
                        rows={3}
                        placeholder={
                          item.status === 'pass' 
                            ? '请填写审核意见（选填），如：材料齐全、信息准确、符合要求等' 
                            : '请详细填写存在的问题及修改建议，以便申请人补正材料'
                        }
                        value={item.opinion}
                        onChange={(e) => handleOpinionChange(item.materialName, e.target.value)}
                        style={{ 
                          resize: 'vertical',
                          borderRadius: 6,
                          borderColor: item.status === 'problem' && !item.opinion.trim() ? '#ff4d4f' : undefined,
                        }}
                        status={item.status === 'problem' && !item.opinion.trim() ? 'error' : undefined}
                      />
                      {item.status === 'problem' && !item.opinion.trim() && (
                        <div style={{ color: '#ff4d4f', fontSize: 12, marginTop: 4 }}>
                          请填写具体的问题描述和修改建议
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <Empty description="暂无材料清单" />
        )}
      </Card>

      {reviewRounds.length > 0 && (
        <Card
          title={
            <Space>
              <span>历史审查意见</span>
              <Tag color="blue">共 {reviewRounds.length} 轮</Tag>
            </Space>
          }
          style={{ marginBottom: 16 }}
        >
          <Collapse defaultActiveKey={[String(reviewRounds[0])]}>
            {reviewRounds.map(round => (
              <Panel
                header={
                  <Space>
                    <strong>第 {round} 轮审查</strong>
                    <Tag color="green">
                      通过 {groupedOpinions[round].filter(o => o.status === 'pass').length} 项
                    </Tag>
                    <Tag color="orange">
                      问题 {groupedOpinions[round].filter(o => o.status === 'problem').length} 项
                    </Tag>
                    <span style={{ color: '#999', fontSize: 12 }}>
                      {groupedOpinions[round][0]?.reviewerName || '未知'} · 
                      {dayjs(groupedOpinions[round][0]?.createdAt).format('YYYY-MM-DD HH:mm')}
                    </span>
                  </Space>
                }
                key={String(round)}
              >
                <div style={{ border: '1px solid #e8e8e8', borderRadius: 4, overflow: 'hidden' }}>
                  {groupedOpinions[round].map((opinion, idx) => (
                    <div
                      key={opinion.id}
                      style={{
                        padding: '12px 16px',
                        borderBottom: idx < groupedOpinions[round].length - 1 ? '1px solid #f0f0f0' : 'none',
                        background: opinion.status === 'pass' ? '#f6ffed' : '#fff7e6',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                        {opinion.status === 'pass' ? (
                          <CheckCircleOutlined style={{ color: '#52c41a' }} />
                        ) : (
                          <ExclamationCircleOutlined style={{ color: '#faad14' }} />
                        )}
                        <strong>{opinion.materialName}</strong>
                        <Tag color={opinion.status === 'pass' ? 'success' : 'warning'}>
                          {opinion.status === 'pass' ? '通过' : '存在问题'}
                        </Tag>
                      </div>
                      {opinion.opinion ? (
                        <div style={{ color: '#666', paddingLeft: 24 }}>
                          {opinion.opinion}
                        </div>
                      ) : (
                        <div style={{ color: '#bfbfbf', paddingLeft: 24, fontSize: 12 }}>
                          无具体意见
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </Panel>
            ))}
          </Collapse>
        </Card>
      )}

      <Card title="审核结论" style={{ marginBottom: 16 }}>
        <Form form={form} layout="vertical">
          <Form.Item
            label="审核结果"
            name="result"
            rules={[{ required: true, message: '请选择审核结果' }]}
            initialValue="pass"
          >
            <Radio.Group size="large">
              <Radio value="pass" style={{ padding: '8px 24px' }}>
                <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 18 }} /> 
                <span style={{ fontSize: 15, fontWeight: 500 }}>审核通过</span>
              </Radio>
              <Radio value="reject" style={{ padding: '8px 24px' }}>
                <CloseCircleOutlined style={{ color: '#ff4d4f', fontSize: 18 }} /> 
                <span style={{ fontSize: 15, fontWeight: 500 }}>审核不通过</span>
              </Radio>
            </Radio.Group>
          </Form.Item>
          <Form.Item
            label="总体审核意见"
            name="opinion"
            rules={[{ required: true, message: '请填写总体审核意见' }]}
          >
            <TextArea 
              rows={4} 
              placeholder="请填写总体审核意见，系统将自动汇总各材料的审查意见附在下方" 
              showCount
              maxLength={1000}
            />
          </Form.Item>
          <div style={{ background: '#f5f5f5', padding: '12px 16px', borderRadius: 6, marginBottom: 16 }}>
            <div style={{ color: '#999', fontSize: 12, marginBottom: 6 }}>
              💡 提示：提交审核后，系统将自动汇总各材料的审查意见到总体意见中
            </div>
            <div style={{ color: '#666', fontSize: 13 }}>
              当前材料审查结果：通过 {passCount} 项，存在问题 {problemCount} 项
            </div>
          </div>
          <Form.Item>
            <Space size="large">
              <Button type="primary" size="large" onClick={handleSubmit} loading={submitting}>
                提交审核
              </Button>
              <Button size="large" onClick={() => navigate(-1)}>
                取消
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
}
