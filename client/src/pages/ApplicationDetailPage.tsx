import { useEffect, useState, useMemo } from 'react';
import { Card, Descriptions, Tag, Timeline, Button, Space, List, Modal, message, Input, Upload, Steps, Tooltip, Table, Popconfirm, Collapse } from 'antd';
import { ArrowLeftOutlined, UploadOutlined, DownloadOutlined, DeleteOutlined, FileTextOutlined, CheckCircleOutlined, CloseCircleOutlined, UserOutlined, HistoryOutlined, ExclamationCircleOutlined, ClockCircleOutlined } from '@ant-design/icons';
import { useParams, useNavigate } from 'react-router-dom';
import { getApplication, getApplicationLogs, submitApplication, acceptApplication, supplementApplication, rejectApplication, sendReviewApplication, completeApplication, reviewApplication } from '../api/applicationApi';
import { warningLabels, warningColors, parseFlowConfig, roleLabels, DEFAULT_FLOW_STEPS, canOperateStep } from '../utils/common';
import { getMatter } from '../api/matterApi';
import { Application, OperationLog, MaterialFile, ApplicationStatus, ApplicationMaterial, MatterMaterial, FlowStep, ReviewOpinion } from '../types';
import { statusLabels, statusColors, formatFileSize, safeJSONParse, actionLabels } from '../utils/common';
import { useAuth } from '../context/AuthContext';
import dayjs from 'dayjs';
import { getDownloadUrl, uploadFile, deleteFile, listFileVersions } from '../api/fileApi';

export default function ApplicationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [application, setApplication] = useState<Application | null>(null);
  const [logs, setLogs] = useState<OperationLog[]>([]);
  const [matter, setMatter] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [versionModalVisible, setVersionModalVisible] = useState(false);
  const [versionList, setVersionList] = useState<MaterialFile[]>([]);
  const [currentVersionFile, setCurrentVersionFile] = useState<MaterialFile | null>(null);
  const [versionLoading, setVersionLoading] = useState(false);

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
        if (versionModalVisible && currentVersionFile) {
          loadVersionHistory(currentVersionFile.originalName);
        }
      }
    } catch {}
  };

  const handleViewVersions = async (file: MaterialFile) => {
    setCurrentVersionFile(file);
    setVersionModalVisible(true);
    await loadVersionHistory(file.originalName);
  };

  const loadVersionHistory = async (originalName: string) => {
    setVersionLoading(true);
    try {
      const res = await listFileVersions(id!, originalName);
      if (res.success) {
        setVersionList(res.data || []);
      }
    } catch {
    } finally {
      setVersionLoading(false);
    }
  };

  const canDeleteFile = (file: MaterialFile): { canDelete: boolean; reason?: string } => {
    if (!application || !user) return { canDelete: false, reason: '无权限' };
    if (user.role === 'admin') return { canDelete: true };
    if (user.role === 'applicant') {
      if (application.applicantId !== user.id) return { canDelete: false, reason: '只能删除本人申请的材料' };
      if (application.status !== 'draft' && application.status !== 'supplement') {
        return { canDelete: false, reason: '仅草稿或补正状态可删除' };
      }
      if (file.uploadedBy !== user.id) return { canDelete: false, reason: '只能删除本人上传的材料' };
      if (!file.isCurrent) return { canDelete: false, reason: '只能删除最新版本' };
      return { canDelete: true };
    }
    return { canDelete: false, reason: '无删除权限' };
  };

  const flowSteps = useMemo((): FlowStep[] => {
    if (application?.flowSteps && application.flowSteps.length > 0) {
      return application.flowSteps;
    }
    if (matter?.flowConfig) {
      return parseFlowConfig(matter.flowConfig);
    }
    return [...DEFAULT_FLOW_STEPS];
  }, [application, matter]);

  const canOperate = (status: ApplicationStatus) => canOperateStep(flowSteps, status, user?.role);

  const getActionButtons = () => {
    if (!application) return null;
    const buttons: JSX.Element[] = [];
    const isApplicant = user?.role === 'applicant';

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

    if (application.status === 'submitted' && canOperate('submitted')) {
      buttons.push(<Button type="primary" onClick={handleAccept}>受理</Button>);
      buttons.push(<Button danger onClick={handleReject}>退回</Button>);
    }

    if (application.status === 'accepted' && canOperate('accepted')) {
      buttons.push(<Button onClick={handleSupplement}>要求补正</Button>);
      buttons.push(<Button type="primary" onClick={handleSendReview}>送审</Button>);
    }

    if (application.status === 'reviewing' && canOperate('reviewing')) {
      buttons.push(
        <Button type="primary" onClick={() => navigate(`/applications/${id}/review`)}>
          审核
        </Button>
      );
    }

    if (application.status === 'approved' && canOperate('approved')) {
      buttons.push(<Button type="primary" onClick={handleComplete}>办结</Button>);
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

  const reviewOpinions = application?.reviewOpinions || [];
  
  const groupedReviewOpinions = useMemo(() => {
    const groups: Record<number, ReviewOpinion[]> = {};
    reviewOpinions.forEach(opinion => {
      if (!groups[opinion.reviewRound]) {
        groups[opinion.reviewRound] = [];
      }
      groups[opinion.reviewRound].push(opinion);
    });
    return groups;
  }, [reviewOpinions]);

  const reviewRounds = useMemo(() => {
    return Object.keys(groupedReviewOpinions).map(Number).sort((a, b) => b - a);
  }, [groupedReviewOpinions]);

  const latestRoundOpinions = useMemo(() => {
    if (reviewRounds.length === 0) return [];
    return groupedReviewOpinions[reviewRounds[0]] || [];
  }, [reviewRounds, groupedReviewOpinions]);

  const latestRoundPassCount = latestRoundOpinions.filter(o => o.status === 'pass').length;
  const latestRoundProblemCount = latestRoundOpinions.filter(o => o.status === 'problem').length;

  interface TimelineNode {
    key: string;
    title: string;
    action: string | string[];
    done: boolean;
    logs?: OperationLog[];
    log?: OperationLog;
    isReview?: boolean;
    reviewResult?: 'pass' | 'reject';
    isCurrent?: boolean;
    description?: string;
    expectedRole?: string;
  }

  const timelineNodes = useMemo((): TimelineNode[] => {
    const currentStatus = application?.status;

    const nodes: TimelineNode[] = [
      { key: 'create', title: '创建申请', action: 'create', done: false, description: '申请人创建申请草稿', expectedRole: '申请人' },
      { key: 'update', title: '修改申请', action: 'update', done: false, description: '草稿或补正期间的信息修改', expectedRole: '申请人' },
      { key: 'submit', title: '提交申请', action: 'submit', done: false, description: '申请人正式提交申请', expectedRole: '申请人' },
      { key: 'accept', title: '窗口受理', action: 'accept', done: false, description: '窗口人员受理申请材料', expectedRole: '窗口人员' },
      { key: 'supplement', title: '要求补正', action: 'supplement', done: false, description: '要求申请人补正材料', expectedRole: '窗口人员' },
      { key: 'reject', title: '退回申请', action: 'reject', done: false, description: '窗口受理阶段直接退回申请', expectedRole: '窗口人员' },
      { key: 'send_review', title: '送审', action: 'send_review', done: false, description: '材料审核通过，送交业务审核', expectedRole: '窗口人员' },
      { key: 'review_opinion', title: '材料审查', action: 'review_opinion_save', done: false, description: '审核人员逐项审查材料', expectedRole: '审核人员' },
      { key: 'review', title: '审核', action: 'review', done: false, description: '审核人员作出通过或退回决定', expectedRole: '审核人员', isReview: true },
      { key: 'complete', title: '办结', action: 'complete', done: false, description: '窗口办结出证', expectedRole: '窗口人员' },
    ];

    const actionLogMap: Record<string, OperationLog[]> = {};
    logs.forEach(log => {
      if (!actionLogMap[log.action]) {
        actionLogMap[log.action] = [];
      }
      actionLogMap[log.action].push(log);
    });

    const statusToNodeKey: Partial<Record<ApplicationStatus, string>> = {
      draft: 'create',
      submitted: 'submit',
      accepted: 'accept',
      supplement: 'supplement',
      reviewing: 'send_review',
      approved: 'review',
      rejected: 'review',
      completed: 'complete',
    };

    const currentNodeKey = currentStatus ? statusToNodeKey[currentStatus] : undefined;

    nodes.forEach(node => {
      const actions = Array.isArray(node.action) ? node.action : [node.action];
      const allMatchedLogs: OperationLog[] = [];
      actions.forEach(act => {
        if (actionLogMap[act]) {
          allMatchedLogs.push(...actionLogMap[act]);
        }
      });

      if (allMatchedLogs.length > 0) {
        const sorted = allMatchedLogs.sort((a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        node.done = true;
        node.logs = sorted;
        node.log = sorted[0];

        if (node.isReview) {
          node.reviewResult = sorted[0].newStatus === 'approved' ? 'pass' : 'reject';
          node.title = sorted[0].newStatus === 'approved' ? '审核通过' : '审核退回';
        }
      }

      const isTerminalStatus = currentStatus === 'completed' || currentStatus === 'rejected';
      if (currentNodeKey === node.key && !isTerminalStatus) {
        if (!node.done || (node.key === 'supplement' && currentStatus === 'supplement')) {
          node.isCurrent = true;
        }
      }

      if (node.done && currentNodeKey && !isTerminalStatus) {
        const doneOrder = ['create', 'update', 'submit', 'accept', 'supplement', 'reject', 'send_review', 'review_opinion', 'review', 'complete'];
        const currentIdx = doneOrder.indexOf(currentNodeKey);
        const nodeIdx = doneOrder.indexOf(node.key);
        if (nodeIdx === currentIdx) {
          if (node.key !== 'review' || currentStatus !== 'approved') {
            node.isCurrent = true;
          }
        }
      }
    });

    const firstSubmitLog = actionLogMap['submit']?.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())[0];
    const submitNode = nodes.find(n => n.key === 'submit');
    if (submitNode && firstSubmitLog) {
      submitNode.log = firstSubmitLog;
    }

    return nodes;
  }, [logs, application]);

  const currentStepIndex = useMemo(() => {
    if (!application) return -1;
    const status = application.status;
    
    const statusOrder: ApplicationStatus[] = [
      'draft', 'submitted', 'accepted', 'reviewing', 'approved', 'completed'
    ];
    const statusIndex = statusOrder.indexOf(status);
    
    const hasStatusField = flowSteps.some(s => s.status);
    
    if (hasStatusField) {
      let maxCompletedStep = -1;
      flowSteps.forEach((step, idx) => {
        if (step.status) {
          const stepStatusIdx = statusOrder.indexOf(step.status);
          if (stepStatusIdx !== -1 && stepStatusIdx <= statusIndex) {
            maxCompletedStep = idx;
          }
        }
      });
      return maxCompletedStep;
    } else {
      if (status === 'draft' || status === 'submitted') {
        return -1;
      }
      if (status === 'rejected') {
        return flowSteps.length - 1;
      }
      if (status === 'completed') {
        return flowSteps.length - 1;
      }
      if (status === 'supplement') {
        return 0;
      }
      if (status === 'accepted') {
        return Math.min(1, flowSteps.length - 1);
      }
      if (status === 'reviewing') {
        return Math.min(2, flowSteps.length - 1);
      }
      if (status === 'approved') {
        return Math.min(flowSteps.length - 2, flowSteps.length - 1);
      }
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
        <Space>{getActionButtons()}</Space>
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

      <Card title="办理时间线" style={{ marginBottom: 16 }}>
        <Timeline
          mode="left"
          items={timelineNodes.map((node) => {
            const isDone = node.done;
            const isCurrent = node.isCurrent;
            let dotColor: string = 'gray';
            let dotIcon: JSX.Element | null = null;

            if (isDone) {
              if (node.key === 'create') dotColor = 'default';
              else if (node.key === 'update') dotColor = 'gray';
              else if (node.key === 'submit') dotColor = 'blue';
              else if (node.key === 'accept') dotColor = 'cyan';
              else if (node.key === 'supplement') dotColor = 'orange';
              else if (node.key === 'reject') dotColor = 'red';
              else if (node.key === 'send_review') dotColor = 'purple';
              else if (node.key === 'review_opinion') dotColor = 'geekblue';
              else if (node.key === 'review') dotColor = node.reviewResult === 'pass' ? 'green' : 'red';
              else if (node.key === 'complete') dotColor = 'green';

              if (node.key === 'review') {
                dotIcon = node.reviewResult === 'pass'
                  ? <CheckCircleOutlined style={{ fontSize: 16 }} />
                  : <CloseCircleOutlined style={{ fontSize: 16 }} />;
              } else if (node.key === 'complete') {
                dotIcon = <CheckCircleOutlined style={{ fontSize: 16 }} />;
              } else if (node.key === 'supplement') {
                dotIcon = <ExclamationCircleOutlined style={{ fontSize: 16 }} />;
              } else if (node.key === 'reject') {
                dotIcon = <CloseCircleOutlined style={{ fontSize: 16 }} />;
              }
            } else if (isCurrent) {
              dotColor = 'blue';
            }

            const timeLabel = isDone && node.log ? (
              <div style={{ fontSize: 12, color: '#666', whiteSpace: 'nowrap' }}>
                <ClockCircleOutlined style={{ marginRight: 4 }} />
                {dayjs(node.log.createdAt).format('YYYY-MM-DD HH:mm')}
              </div>
            ) : isCurrent ? (
              <div style={{ fontSize: 12, color: '#1890ff', whiteSpace: 'nowrap', fontWeight: 500 }}>
                <ClockCircleOutlined style={{ marginRight: 4 }} />
                当前环节
              </div>
            ) : (
              <div style={{ fontSize: 12, color: '#bfbfbf', whiteSpace: 'nowrap' }}>
                <ClockCircleOutlined style={{ marginRight: 4 }} />
                待处理
              </div>
            );

            const logCount = node.logs?.length || 0;

            return {
              color: dotColor,
              dot: dotIcon,
              label: timeLabel,
              children: (
                <div style={{
                  paddingBottom: 8,
                  padding: isCurrent ? '8px 12px' : 0,
                  background: isCurrent ? '#e6f7ff' : 'transparent',
                  borderRadius: isCurrent ? 6 : 0,
                  border: isCurrent ? '1px solid #91d5ff' : 'none',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                    <strong style={{
                      fontSize: 15,
                      color: isDone ? '#262626' : (isCurrent ? '#1890ff' : '#bfbfbf'),
                    }}>
                      {node.title}
                    </strong>
                    {logCount > 1 && isDone && (
                      <Tag color="blue" style={{ margin: 0 }}>共 {logCount} 次</Tag>
                    )}
                    {isDone && node.key === 'review' && (
                      <Tag color={node.reviewResult === 'pass' ? 'success' : 'error'} style={{ margin: 0 }}>
                        {node.reviewResult === 'pass' ? '通过' : '退回'}
                      </Tag>
                    )}
                    {isDone && node.key === 'reject' && (
                      <Tag color="error" style={{ margin: 0 }}>窗口退回</Tag>
                    )}
                    {isCurrent && (
                      <Tag color="processing" style={{ margin: 0 }}>进行中</Tag>
                    )}
                    {!isDone && !isCurrent && (
                      <Tag color="default" style={{ margin: 0 }}>未发生</Tag>
                    )}
                  </div>
                  {isDone && node.log ? (
                    <div style={{ color: '#595959', fontSize: 13 }}>
                      <div style={{ marginBottom: 4, display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                        <span>
                          <UserOutlined style={{ marginRight: 6, color: '#8c8c8c' }} />
                          操作人：{node.log.userName || '系统'}
                        </span>
                        {node.expectedRole && (
                          <Tag color="default" style={{ margin: 0, fontSize: 11 }}>
                            角色：{node.expectedRole}
                          </Tag>
                        )}
                      </div>
                      {node.log.oldStatus && node.log.newStatus && (
                        <div style={{ marginBottom: 4 }}>
                          <Tag color="default" style={{ marginRight: 4 }}>
                            {statusLabels[node.log.oldStatus as ApplicationStatus] || node.log.oldStatus}
                          </Tag>
                          <span style={{ color: '#bfbfbf', margin: '0 4px' }}>→</span>
                          <Tag color={statusColors[node.log.newStatus as ApplicationStatus] as any || 'default'}>
                            {statusLabels[node.log.newStatus as ApplicationStatus] || node.log.newStatus}
                          </Tag>
                        </div>
                      )}
                      <div style={{ marginTop: 6, padding: '8px 12px', background: '#fafafa', borderRadius: 4, borderLeft: '3px solid #d9d9d9' }}>
                        {node.log.description}
                      </div>
                      {logCount > 1 && node.logs && (
                        <Collapse
                          style={{ marginTop: 8, background: 'transparent' }}
                          ghost
                          items={[{
                            key: 'history',
                            label: <span style={{ fontSize: 12, color: '#8c8c8c' }}>查看历史记录（{logCount - 1} 条更早记录）</span>,
                            children: (
                              <div style={{ paddingLeft: 4 }}>
                                {node.logs.slice(1).map((oldLog) => (
                                  <div
                                    key={oldLog.id}
                                    style={{
                                      padding: '8px 12px',
                                      marginTop: 6,
                                      background: '#fafafa',
                                      borderRadius: 4,
                                      borderLeft: '2px solid #e8e8e8',
                                      fontSize: 12,
                                    }}
                                  >
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                      <span style={{ color: '#595959' }}>
                                        <UserOutlined style={{ marginRight: 4 }} />
                                        {oldLog.userName || '系统'}
                                      </span>
                                      <span style={{ color: '#bfbfbf' }}>
                                        {dayjs(oldLog.createdAt).format('YYYY-MM-DD HH:mm')}
                                      </span>
                                    </div>
                                    {oldLog.oldStatus && oldLog.newStatus && (
                                      <div style={{ marginBottom: 4 }}>
                                        <Tag color="default" style={{ fontSize: 11, marginRight: 4 }}>
                                          {statusLabels[oldLog.oldStatus as ApplicationStatus] || oldLog.oldStatus}
                                        </Tag>
                                        <span style={{ color: '#bfbfbf', margin: '0 2px' }}>→</span>
                                        <Tag color={statusColors[oldLog.newStatus as ApplicationStatus] as any || 'default'} style={{ fontSize: 11 }}>
                                          {statusLabels[oldLog.newStatus as ApplicationStatus] || oldLog.newStatus}
                                        </Tag>
                                      </div>
                                    )}
                                    <div style={{ color: '#8c8c8c' }}>{oldLog.description}</div>
                                  </div>
                                ))}
                              </div>
                            ),
                          }]}
                        />
                      )}
                    </div>
                  ) : (
                    <div style={{
                      fontSize: 13,
                      color: isCurrent ? '#595959' : '#bfbfbf',
                      fontStyle: isCurrent ? 'normal' : 'italic',
                    }}>
                      {node.description && (
                        <div style={{ marginBottom: 6 }}>
                          {isCurrent ? (
                            <Tag color="blue" style={{ margin: 0, marginRight: 6 }}>说明</Tag>
                          ) : null}
                          {node.description}
                        </div>
                      )}
                      {node.expectedRole && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                          <UserOutlined style={{ color: isCurrent ? '#1890ff' : '#bfbfbf' }} />
                          <span>
                            预期操作角色：
                            <span style={{ color: isCurrent ? '#1890ff' : '#8c8c8c', fontWeight: isCurrent ? 500 : 400 }}>
                              {node.expectedRole}
                            </span>
                          </span>
                        </div>
                      )}
                      {!isCurrent && (
                        <div style={{ marginTop: 6, padding: '6px 10px', background: '#fafafa', borderRadius: 4, border: '1px dashed #e8e8e8' }}>
                          <span style={{ color: '#bfbfbf' }}>暂无对应办理记录</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ),
            };
          })}
        />
      </Card>

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

      {reviewRounds.length > 0 && (
        <Card
          title={
            <Space>
              <span>审查意见历史</span>
              <Tag color="blue">共 {reviewRounds.length} 轮</Tag>
              {latestRoundProblemCount > 0 ? (
                <Tag color="orange">
                  最新一轮：{latestRoundPassCount} 通过 / {latestRoundProblemCount} 问题
                </Tag>
              ) : (
                <Tag color="green">
                  最新一轮：全部通过
                </Tag>
              )}
            </Space>
          }
          style={{ marginBottom: 16 }}
        >
          <Collapse defaultActiveKey={[String(reviewRounds[0])]}>
            {reviewRounds.map(round => {
              const roundOpinions = groupedReviewOpinions[round];
              const roundPassCount = roundOpinions.filter(o => o.status === 'pass').length;
              const roundProblemCount = roundOpinions.filter(o => o.status === 'problem').length;
              const reviewerName = roundOpinions[0]?.reviewerName || '未知';
              const reviewTime = roundOpinions[0]?.createdAt;
              
              return (
                <Collapse.Panel
                  header={
                    <Space wrap>
                      <strong style={{ fontSize: 14 }}>第 {round} 轮审查</strong>
                      <Tag color="success" icon={<CheckCircleOutlined />}>
                        通过 {roundPassCount} 项
                      </Tag>
                      <Tag color="warning" icon={<ExclamationCircleOutlined />}>
                        问题 {roundProblemCount} 项
                      </Tag>
                      <span style={{ color: '#999', fontSize: 12 }}>
                        <UserOutlined style={{ marginRight: 4 }} />
                        {reviewerName}
                      </span>
                      <span style={{ color: '#999', fontSize: 12 }}>
                        <HistoryOutlined style={{ marginRight: 4 }} />
                        {dayjs(reviewTime).format('YYYY-MM-DD HH:mm')}
                      </span>
                    </Space>
                  }
                  key={String(round)}
                >
                  <div style={{ border: '1px solid #e8e8e8', borderRadius: 8, overflow: 'hidden' }}>
                    {roundOpinions.map((opinion, idx) => (
                      <div
                        key={opinion.id}
                        style={{
                          padding: '14px 20px',
                          borderBottom: idx < roundOpinions.length - 1 ? '1px solid #f0f0f0' : 'none',
                          background: opinion.status === 'pass' ? '#f6ffed' : '#fff7e6',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                          {opinion.status === 'pass' ? (
                            <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 18 }} />
                          ) : (
                            <ExclamationCircleOutlined style={{ color: '#faad14', fontSize: 18 }} />
                          )}
                          <strong style={{ fontSize: 15 }}>{opinion.materialName}</strong>
                          <Tag color={opinion.status === 'pass' ? 'success' : 'warning'} style={{ marginLeft: 8 }}>
                            {opinion.status === 'pass' ? '通过' : '存在问题'}
                          </Tag>
                        </div>
                        {opinion.opinion ? (
                          <div style={{ 
                            color: '#555', 
                            paddingLeft: 28,
                            padding: '8px 12px 8px 28px',
                            background: 'rgba(255,255,255,0.7)',
                            borderRadius: 6,
                            marginLeft: 0,
                            lineHeight: 1.6,
                          }}>
                            {opinion.opinion}
                          </div>
                        ) : (
                          <div style={{ color: '#bfbfbf', paddingLeft: 28, fontSize: 12, fontStyle: 'italic' }}>
                            无具体意见
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </Collapse.Panel>
              );
            })}
          </Collapse>
        </Card>
      )}

      <Card
        title={
          <Space>
            <span>上传材料</span>
            <Tag color="blue">共 {application?.files?.length || 0} 份当前版本</Tag>
          </Space>
        }
        style={{ marginBottom: 16 }}
        extra={
          (user?.role === 'applicant' && (application?.status === 'draft' || application?.status === 'supplement')) && (
            <Upload
              customRequest={({ file }) => handleUpload(file as File)}
              showUploadList={false}
            >
              <Button type="primary" icon={<UploadOutlined />}>上传材料</Button>
            </Upload>
          )
        }
      >
        <List
          dataSource={application?.files || []}
          renderItem={(item: MaterialFile) => {
            const { canDelete, reason } = canDeleteFile(item);
            return (
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
                    onClick={() => handleViewVersions(item)}
                  >
                    版本历史
                  </Button>,
                  <Button
                    key="download"
                    type="link"
                    size="small"
                    icon={<DownloadOutlined />}
                    onClick={() => window.open(getDownloadUrl(item.id))}
                  >
                    {item.isCurrent ? '下载当前版' : '下载'}
                  </Button>,
                  canDelete ? (
                    <Tooltip title="删除此版本">
                      <Button
                        key="delete"
                        type="link"
                        danger
                        size="small"
                        icon={<DeleteOutlined />}
                        onClick={() => {
                          Modal.confirm({
                            title: '确认删除',
                            content: (
                              <div>
                                <p>确定要删除 <strong>{item.originalName}</strong> 的 <strong>v{item.version}</strong> 版本吗？</p>
                                <p style={{ color: '#faad14', fontSize: 12, marginTop: 8 }}>
                                  注意：删除最新版本后，系统将自动回退到上一版本作为当前版本。
                                </p>
                              </div>
                            ),
                            okText: '确认删除',
                            okButtonProps: { danger: true },
                            onOk: () => handleDeleteFile(item.id),
                          });
                        }}
                      >
                        删除
                      </Button>
                    </Tooltip>
                  ) : !item.isCurrent ? (
                    <Tooltip title={reason}>
                      <Button key="delete" type="link" size="small" disabled style={{ color: '#bfbfbf' }}>
                        删除
                      </Button>
                    </Tooltip>
                  ) : null,
                ].filter(Boolean) as any}
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
            );
          }}
        />
        {(!application?.files || application.files.length === 0) && (
          <div style={{ color: '#999', textAlign: 'center', padding: 40 }}>暂无上传材料</div>
        )}
      </Card>

      <Modal
        title={
          <Space>
            <span>{currentVersionFile?.originalName} - 版本历史</span>
            <Tag color="blue">共 {versionList.length} 个版本</Tag>
          </Space>
        }
        open={versionModalVisible}
        onCancel={() => setVersionModalVisible(false)}
        footer={null}
        width={800}
      >
        <Table
          dataSource={versionList}
          rowKey="id"
          loading={versionLoading}
          pagination={false}
          size="middle"
          columns={[
            {
              title: '版本',
              dataIndex: 'version',
              key: 'version',
              width: 90,
              render: (version: number, record: MaterialFile) => (
                <div style={{ textAlign: 'center' }}>
                  <Tag color={record.isCurrent ? 'green' : 'default'} style={{ fontWeight: 'bold', fontSize: 14 }}>
                    v{version}
                  </Tag>
                  {record.isCurrent && (
                    <div style={{ color: '#52c41a', fontSize: 12, marginTop: 2, fontWeight: 'bold' }}>
                      ✓ 当前版本
                    </div>
                  )}
                </div>
              ),
            },
            {
              title: '文件大小',
              dataIndex: 'fileSize',
              key: 'fileSize',
              width: 90,
              render: (size: number) => formatFileSize(size),
            },
            {
              title: '上传人',
              dataIndex: 'uploadedByName',
              key: 'uploadedByName',
              width: 100,
              render: (name?: string) => name || '-',
            },
            {
              title: '上传时间',
              dataIndex: 'createdAt',
              key: 'createdAt',
              width: 160,
              render: (time: string) => dayjs(time).format('YYYY-MM-DD HH:mm:ss'),
            },
            {
              title: '版本说明',
              dataIndex: 'versionNote',
              key: 'versionNote',
              ellipsis: true,
              render: (note?: string) => note || <span style={{ color: '#bfbfbf' }}>无</span>,
            },
            {
              title: '操作',
              key: 'action',
              width: 130,
              fixed: 'right',
              render: (_, record: MaterialFile) => {
                const { canDelete, reason } = canDeleteFile(record);
                return (
                  <Space size={4}>
                    <Button
                      type={record.isCurrent ? 'primary' : 'link'}
                      size="small"
                      icon={<DownloadOutlined />}
                      onClick={() => window.open(getDownloadUrl(record.id))}
                    >
                      {record.isCurrent ? '下载当前' : '下载'}
                    </Button>
                    {canDelete ? (
                      <Popconfirm
                        title="确认删除此版本？"
                        description={
                          <div>
                            <p>删除后将自动回退到上一版本作为当前版本。</p>
                            <p style={{ color: '#faad14', fontSize: 12 }}>此操作不可撤销。</p>
                          </div>
                        }
                        okText="确认删除"
                        okButtonProps={{ danger: true }}
                        onConfirm={() => handleDeleteFile(record.id)}
                      >
                        <Button type="link" danger size="small" icon={<DeleteOutlined />}>
                          删除
                        </Button>
                      </Popconfirm>
                    ) : (
                      <Tooltip title={reason}>
                        <Button type="link" size="small" disabled style={{ color: '#bfbfbf' }}>
                          删除
                        </Button>
                      </Tooltip>
                    )}
                  </Space>
                );
              },
            },
          ]}
        />
        {versionList.length === 0 && !versionLoading && (
          <div style={{ color: '#999', textAlign: 'center', padding: 40 }}>暂无版本记录</div>
        )}
      </Modal>

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
