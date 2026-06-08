import { useEffect, useState, useMemo } from 'react';
import { Card, Descriptions, Tag, Timeline, Button, Space, List, Modal, message, Input, Upload } from 'antd';
import { ArrowLeftOutlined, UploadOutlined, DownloadOutlined, DeleteOutlined, FileTextOutlined, CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import { useParams, useNavigate } from 'react-router-dom';
import { getApplication, getApplicationLogs, submitApplication, acceptApplication, supplementApplication, rejectApplication, sendReviewApplication, completeApplication, reviewApplication } from '../api/applicationApi';
import { warningLabels, warningColors } from '../utils/common';
import { getMatter } from '../api/matterApi';
import { Application, OperationLog, MaterialFile, ApplicationStatus, ApplicationMaterial, MatterMaterial } from '../types';
import { statusLabels, statusColors, formatFileSize, safeJSONParse, actionLabels } from '../utils/common';
import { useAuth } from '../context/AuthContext';
import dayjs from 'dayjs';
import { getDownloadUrl, uploadFile, deleteFile } from '../api/fileApi';

export default function ApplicationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [application, setApplication] = useState<Application | null>(null);
  const [logs, setLogs] = useState<OperationLog[]>([]);
  const [matter, setMatter] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (id) {
      loadApplication();
      loadLogs();
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
            setMatter(matterRes.data);
          }
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const loadLogs = async () => {
    try {
      const res = await getApplicationLogs(id!);
      if (res.success) {
        setLogs(res.data || []);
      }
    } catch {}
  };

  const handleSubmit = async () => {
    try {
      const res = await submitApplication(id!);
      if (res.success) {
        message.success('提交成功');
        loadApplication();
        loadLogs();
      }
    } catch {}
  };

  const handleAccept = async () => {
    try {
      const res = await acceptApplication(id!);
      if (res.success) {
        message.success('受理成功');
        loadApplication();
        loadLogs();
      }
    } catch {}
  };

  const handleSupplement = () => {
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
          const res = await supplementApplication(id!, reason);
          if (res.success) {
            message.success('已发送补正通知');
            loadApplication();
            loadLogs();
          }
        } catch {}
      },
    });
  };

  const handleReject = () => {
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
          const res = await rejectApplication(id!, reason);
          if (res.success) {
            message.success('已退回申请');
            loadApplication();
            loadLogs();
          }
        } catch {}
      },
    });
  };

  const handleSendReview = async () => {
    try {
      const res = await sendReviewApplication(id!);
      if (res.success) {
        message.success('已送审');
        loadApplication();
        loadLogs();
      }
    } catch {}
  };

  const handleComplete = async () => {
    try {
      const res = await completeApplication(id!);
      if (res.success) {
        message.success('办结成功');
        loadApplication();
        loadLogs();
      }
    } catch {}
  };

  const handleUpload = (file: File) => {
    const formData = new FormData();
    formData.append('file', file);

    uploadFile(id!, file).then((res) => {
      if (res.success) {
        message.success('上传成功');
        loadApplication();
      }
    }).catch(() => {});

    return false;
  };

  const handleDeleteFile = async (fileId: string) => {
    try {
      const res = await deleteFile(fileId);
      if (res.success) {
        message.success('删除成功');
        loadApplication();
      }
    } catch {}
  };

  const getActionButtons = () => {
    if (!application) return null;
    const buttons: JSX.Element[] = [];
    const isApplicant = user?.role === 'applicant';
    const isWindow = user?.role === 'window';
    const isReviewer = user?.role === 'reviewer';
    const isAdmin = user?.role === 'admin';

    if (isApplicant && application.applicantId === user?.id) {
      if (application.status === 'draft' || application.status === 'supplement') {
        buttons.push(
          <Button type="primary" onClick={handleSubmit}>
            提交申请
          </Button>
        );
        buttons.push(
          <Button onClick={() => navigate(`/applications/${id}/edit`)}>
            修改申请
          </Button>
        );
      }
    }

    if (isWindow || isAdmin) {
      if (application.status === 'submitted') {
        buttons.push(<Button type="primary" onClick={handleAccept}>受理</Button>);
        buttons.push(<Button danger onClick={handleReject}>退回</Button>);
      }
      if (application.status === 'accepted') {
        buttons.push(<Button onClick={handleSupplement}>要求补正</Button>);
        buttons.push(<Button type="primary" onClick={handleSendReview}>送审</Button>);
      }
      if (application.status === 'approved') {
        buttons.push(<Button type="primary" onClick={handleComplete}>办结</Button>);
      }
    }

    if (isReviewer || isAdmin) {
      if (application.status === 'reviewing') {
        buttons.push(
          <Button type="primary" onClick={() => navigate(`/applications/${id}/review`)}>
            审核
          </Button>
        );
      }
    }

    return buttons;
  };

  const basicInfo = application ? safeJSONParse<Record<string, any>>(application.basicInfo, {}) : {};

  const displayMaterials = useMemo((): ApplicationMaterial[] => {
    if (!application) return [];
    const appMaterials = safeJSONParse<ApplicationMaterial[]>(application.materials, []);
    if (appMaterials.length > 0 && appMaterials.some(m => 'checked' in m)) {
      return appMaterials;
    }
    if (matter) {
      const matterMaterials = safeJSONParse<MatterMaterial[]>(matter.requiredMaterials, []);
      return matterMaterials.map(m => ({ ...m, checked: false, remark: '' }));
    }
    return [];
  }, [application, matter]);

  const checkedCount = useMemo(() => displayMaterials.filter(m => m.checked).length, [displayMaterials]);
  const requiredCount = useMemo(() => displayMaterials.filter(m => m.required).length, [displayMaterials]);
  const requiredCheckedCount = useMemo(() => displayMaterials.filter(m => m.required && m.checked).length, [displayMaterials]);

  if (!application && !loading) {
    return <div style={{ textAlign: 'center', padding: 40 }}>申请不存在</div>;
  }

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)}>
          返回
        </Button>
        <Space>{getActionButtons()}</Space>
      </Space>

      <Card title="申请基本信息" style={{ marginBottom: 16 }}>
        <Descriptions bordered column={2} size="small">
          <Descriptions.Item label="申请编号">{application?.applicationNo}</Descriptions.Item>
          <Descriptions.Item label="申请状态">
            <Tag color={statusColors[application?.status || 'draft'] as any}>
              {statusLabels[application?.status || 'draft']}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label="预警状态">
            {application?.warningStatus && application.warningStatus !== 'none' ? (
              <Tag color={warningColors[application.warningStatus] as any}>
                {warningLabels[application.warningStatus]}
                {application.remainingDays !== undefined && application.remainingDays !== null && (
                  <span style={{ marginLeft: 4 }}>
                    ({application.remainingDays > 0 ? `剩余${application.remainingDays}天` : `超期${Math.abs(application.remainingDays)}天`})
                  </span>
                )}
              </Tag>
            ) : (
              <span style={{ color: '#999' }}>-</span>
            )}
          </Descriptions.Item>
          <Descriptions.Item label="事项名称">{application?.matterName}</Descriptions.Item>
          <Descriptions.Item label="申请人">{application?.applicantName}</Descriptions.Item>
          <Descriptions.Item label="承诺时限">
            {application?.promiseDays ? `${application.promiseDays} 个工作日` : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="当前环节">{application?.currentStep || '-'}</Descriptions.Item>
          <Descriptions.Item label="申请时间">
            {application?.submitTime ? dayjs(application.submitTime).format('YYYY-MM-DD HH:mm') : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="受理时间">
            {application?.acceptTime ? dayjs(application.acceptTime).format('YYYY-MM-DD HH:mm') : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="办结时间">
            {application?.completeTime ? dayjs(application.completeTime).format('YYYY-MM-DD HH:mm') : '-'}
          </Descriptions.Item>
          {application?.supplementReason && (
            <Descriptions.Item label="补正原因" span={2}>
              <span style={{ color: '#faad14' }}>{application.supplementReason}</span>
            </Descriptions.Item>
          )}
          {application?.rejectReason && (
            <Descriptions.Item label="退回原因" span={2}>
              <span style={{ color: '#ff4d4f' }}>{application.rejectReason}</span>
            </Descriptions.Item>
          )}
          {application?.reviewOpinion && (
            <Descriptions.Item label="审核意见" span={2}>
              {application.reviewOpinion}
            </Descriptions.Item>
          )}
        </Descriptions>
      </Card>

      <Card title="申请人填写信息" style={{ marginBottom: 16 }}>
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
        title="材料清单核对"
        style={{ marginBottom: 16 }}
        extra={
          displayMaterials.length > 0 && (
            <Space size={8}>
              <Tag color="blue">共 {displayMaterials.length} 项</Tag>
              <Tag color="orange">必填 {requiredCount} 项</Tag>
              <Tag color={requiredCheckedCount === requiredCount ? 'green' : 'default'}>
                已准备 {checkedCount} 项
                {requiredCount > 0 && ` (必填 ${requiredCheckedCount}/${requiredCount})`}
              </Tag>
            </Space>
          )
        }
      >
        {displayMaterials.length > 0 ? (
          <div style={{ border: '1px solid #e8e8e8', borderRadius: 4, overflow: 'hidden' }}>
            {displayMaterials.map((m, idx) => (
              <div
                key={idx}
                style={{
                  padding: '12px 16px',
                  borderBottom: idx < displayMaterials.length - 1 ? '1px solid #f0f0f0' : 'none',
                  background: m.checked ? '#f6ffed' : '#fff',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <div style={{ marginTop: 2 }}>
                    {m.checked ? (
                      <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 16 }} />
                    ) : (
                      <CloseCircleOutlined style={{ color: '#bfbfbf', fontSize: 16 }} />
                    )}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <strong style={{ fontSize: 14 }}>
                        {m.required && <span style={{ color: 'red' }}>* </span>}
                        {m.name}
                      </strong>
                      {m.checked ? (
                        <Tag icon={<CheckCircleOutlined />} color="success">已准备</Tag>
                      ) : (
                        <Tag icon={<CloseCircleOutlined />} color="default">未准备</Tag>
                      )}
                    </div>
                    {m.description && (
                      <div style={{ color: '#999', fontSize: 12, marginTop: 4 }}>
                        {m.description}
                      </div>
                    )}
                    {m.remark && (
                      <div style={{ marginTop: 8, padding: '8px 12px', background: '#fafafa', borderRadius: 4, borderLeft: '3px solid #1890ff' }}>
                        <div style={{ color: '#666', fontSize: 12, marginBottom: 4 }}>备注：</div>
                        <div style={{ color: '#333' }}>{m.remark}</div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ color: '#999', textAlign: 'center', padding: 20 }}>暂无材料清单</div>
        )}
      </Card>

      <Card
        title="上传材料"
        style={{ marginBottom: 16 }}
        extra={
          (user?.role === 'applicant' && (application?.status === 'draft' || application?.status === 'supplement')) && (
            <Upload
              customRequest={({ file }) => handleUpload(file as File)}
              showUploadList={false}
            >
              <Button icon={<UploadOutlined />}>上传材料</Button>
            </Upload>
          )
        }
      >
        <List
          dataSource={application?.files || []}
          renderItem={(item: MaterialFile) => (
            <List.Item
              actions={[
                <Button type="link" icon={<DownloadOutlined />} onClick={() => window.open(getDownloadUrl(item.id))}>
                  下载
                </Button>,
                (user?.role === 'applicant' && (application?.status === 'draft' || application?.status === 'supplement')) && (
                  <Button type="link" danger icon={<DeleteOutlined />} onClick={() => handleDeleteFile(item.id)}>
                    删除
                  </Button>
                ),
              ].filter(Boolean) as any}
            >
              <List.Item.Meta
                avatar={<FileTextOutlined style={{ fontSize: 24, color: '#1890ff' }} />}
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

      <Card title="办理进度">
        <Timeline
          items={logs.map(log => ({
            color: log.action === 'create' ? 'gray' :
                   log.action === 'submit' ? 'blue' :
                   log.action === 'accept' ? 'green' :
                   log.action === 'reject' ? 'red' :
                   log.action === 'complete' ? 'green' : 'blue',
            children: (
              <div>
                <div>
                  <strong>{actionLabels[log.action] || log.action}</strong>
                  <span style={{ marginLeft: 8, color: '#999' }}>
                    — {log.userName || '系统'}
                  </span>
                </div>
                <div style={{ color: '#666', marginTop: 4 }}>
                  {log.description}
                </div>
                <div style={{ color: '#999', fontSize: 12, marginTop: 4 }}>
                  {dayjs(log.createdAt).format('YYYY-MM-DD HH:mm:ss')}
                </div>
              </div>
            ),
          }))}
        />
        {logs.length === 0 && (
          <div style={{ color: '#999', textAlign: 'center', padding: 20 }}>暂无办理记录</div>
        )}
      </Card>
    </div>
  );
}
