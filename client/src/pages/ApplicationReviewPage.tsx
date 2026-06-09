import { useEffect, useState, useMemo } from 'react';
import { Card, Descriptions, Tag, Button, Space, List, Form, Input, Radio, message, Divider, Steps, Tooltip, Modal, Table, Collapse, Empty, Alert, Row, Col } from 'antd';
import { ArrowLeftOutlined, FileTextOutlined, UserOutlined, HistoryOutlined, DownloadOutlined, CheckCircleOutlined, CloseCircleOutlined, ExclamationCircleOutlined, SaveOutlined, CheckOutlined, CloseOutlined, FolderOpenOutlined, DiffOutlined } from '@ant-design/icons';
import { useParams, useNavigate } from 'react-router-dom';
import { getApplication, reviewApplication, getReviewOpinions, saveReviewOpinions } from '../api/applicationApi';
import { Application, FlowStep, MaterialFile, ReviewOpinionFormData, ReviewOpinion, MatterMaterial, FileVersionCompareResult } from '../types';
import { statusLabels, statusColors, formatFileSize, safeJSONParse, parseFlowConfig, roleLabels } from '../utils/common';
import { getDownloadUrl, listFileVersions, compareFileVersions } from '../api/fileApi';
import { getMatter } from '../api/matterApi';
import dayjs from 'dayjs';

const { Panel } = Collapse;
const { TextArea } = Input;

export default function ApplicationReviewPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [application, setApplication] = useState<Application | null>(null);
  const [matter, setMatter] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [versionModalVisible, setVersionModalVisible] = useState(false);
  const [versionList, setVersionList] = useState<MaterialFile[]>([]);
  const [currentVersionFile, setCurrentVersionFile] = useState<MaterialFile | null>(null);
  const [versionLoading, setVersionLoading] = useState(false);
  const [reviewOpinions, setReviewOpinions] = useState<ReviewOpinion[]>([]);
  const [formData, setFormData] = useState<ReviewOpinionFormData[]>([]);
  const [initialized, setInitialized] = useState(false);
  const [selectedCompareIds, setSelectedCompareIds] = useState<string[]>([]);
  const [compareModalVisible, setCompareModalVisible] = useState(false);
  const [compareResult, setCompareResult] = useState<FileVersionCompareResult | null>(null);
  const [compareLoading, setCompareLoading] = useState(false);

  useEffect(() => {
    if (id) {
      loadApplication();
      loadReviewOpinions();
    }
  }, [id]);

  useEffect(() => {
    if (matter && reviewOpinions.length > 0 && !initialized) {
      restoreFromLatestRound();
    }
  }, [matter, reviewOpinions, initialized]);

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

  const loadReviewOpinions = async () => {
    try {
      const res = await getReviewOpinions(id!);
      if (res.success) {
        setReviewOpinions(res.data || []);
      }
    } catch {}
  };

  const restoreFromLatestRound = () => {
    if (reviewOpinions.length === 0) return;
    const maxRound = Math.max(...reviewOpinions.map(o => o.reviewRound));
    const latestOpinions = reviewOpinions.filter(o => o.reviewRound === maxRound);
    
    const materials = safeJSONParse<MatterMaterial[]>(matter?.requiredMaterials, []);
    const data: ReviewOpinionFormData[] = materials.map(m => {
      const existing = latestOpinions.find(o => o.materialName === m.name);
      return {
        materialName: m.name,
        status: existing?.status || 'pass',
        opinion: existing?.opinion || '',
      };
    });
    setFormData(data);
    setInitialized(true);
  };

  useEffect(() => {
    if (matter && formData.length === 0 && !initialized) {
      const materials = safeJSONParse<MatterMaterial[]>(matter.requiredMaterials, []);
      const data: ReviewOpinionFormData[] = materials.map(m => ({
        materialName: m.name,
        status: 'pass',
        opinion: '',
      }));
      setFormData(data);
    }
  }, [matter, formData.length, initialized]);

  const handleStatusChange = (materialName: string, status: 'pass' | 'problem') => {
    setFormData(prev => prev.map(item => 
      item.materialName === materialName ? { ...item, status } : item
    ));
  };

  const handleOpinionChange = (materialName: string, opinion: string) => {
    setFormData(prev => prev.map(item => 
      item.materialName === materialName ? { ...item, opinion } : item
    ));
  };

  const handleMarkAllPass = () => {
    setFormData(prev => prev.map(item => ({ ...item, status: 'pass' as const })));
    message.success('已全部标记为通过');
  };

  const handleMarkAllProblem = () => {
    setFormData(prev => prev.map(item => ({ ...item, status: 'problem' as const })));
    message.success('已全部标记为存在问题');
  };

  const handleSaveDraft = async () => {
    if (formData.length === 0) {
      message.warning('暂无材料可保存');
      return;
    }

    const problemItems = formData.filter(item => item.status === 'problem' && !item.opinion.trim());
    if (problemItems.length > 0) {
      Modal.confirm({
        title: '存在问题的材料未填写意见',
        content: `以下材料标记为"存在问题"但未填写具体意见：\n${problemItems.map(i => `• ${i.materialName}`).join('\n')}\n\n是否继续保存？`,
        okText: '继续保存',
        cancelText: '返回补充',
        onOk: doSaveDraft,
      });
      return;
    }

    doSaveDraft();
  };

  const doSaveDraft = async () => {
    setSaving(true);
    try {
      const res = await saveReviewOpinions(id!, formData);
      if (res.success) {
        message.success('审查意见已保存');
        loadReviewOpinions();
        setInitialized(true);
      }
    } finally {
      setSaving(false);
    }
  };

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

  const handleViewVersions = async (file: MaterialFile) => {
    setCurrentVersionFile(file);
    setVersionModalVisible(true);
    setSelectedCompareIds([]);
    setCompareResult(null);
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

  const handleClearCompareSelection = () => {
    setSelectedCompareIds([]);
  };

  const handleCompareVersions = async () => {
    if (selectedCompareIds.length !== 2) {
      message.warning('请选择两个版本进行对比');
      return;
    }

    const selectedFiles = selectedCompareIds
      .map(fileId => versionList.find(file => file.id === fileId))
      .filter((file): file is MaterialFile => Boolean(file))
      .sort((a, b) => a.version - b.version);

    if (selectedFiles.length !== 2) {
      message.error('所选版本不存在，请重新选择');
      return;
    }

    setCompareLoading(true);
    try {
      const res = await compareFileVersions(id!, selectedFiles[0].id, selectedFiles[1].id);
      if (res.success && res.data) {
        setCompareResult(res.data);
        setCompareModalVisible(true);
      } else {
        message.error(res.message || '版本对比失败');
      }
    } catch {
      message.error('版本对比失败');
    } finally {
      setCompareLoading(false);
    }
  };

  const renderDiffValue = (field: string, value: string | number | boolean | undefined) => {
    if (value === undefined || value === null || value === '') {
      return <span style={{ color: '#bfbfbf' }}>无</span>;
    }

    if (field === 'createdAt') {
      return dayjs(value as string).format('YYYY-MM-DD HH:mm:ss');
    }

    if (field === 'fileSize') {
      return formatFileSize(value as number);
    }

    if (field === 'isCurrent') {
      return value ? (
        <Tag color="success" icon={<CheckCircleOutlined />}>当前版本</Tag>
      ) : (
        <Tag color="default">历史版本</Tag>
      );
    }

    return String(value);
  };

  const compareButtonText = () => {
    if (selectedCompareIds.length !== 2) {
      return `已选 ${selectedCompareIds.length}/2 个版本`;
    }
    const versions = selectedCompareIds
      .map(fileId => versionList.find(file => file.id === fileId)?.version)
      .filter((version): version is number => typeof version === 'number')
      .sort((a, b) => a - b);
    return versions.length === 2 ? `对比 v${versions[0]} 与 v${versions[1]}` : '版本对比';
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

  const latestRoundOpinions = useMemo(() => {
    if (reviewOpinions.length === 0) return [];
    const maxRound = Math.max(...reviewOpinions.map(o => o.reviewRound));
    return reviewOpinions.filter(o => o.reviewRound === maxRound);
  }, [reviewOpinions]);

  const passCount = formData.filter(item => item.status === 'pass').length;
  const problemCount = formData.filter(item => item.status === 'problem').length;

  const groupedOpinions = useMemo(() => {
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
    return Object.keys(groupedOpinions).map(Number).sort((a, b) => b - a);
  }, [groupedOpinions]);

  const getFilesForMaterial = (materialName: string): MaterialFile[] => {
    if (!application?.files) return [];
    return application.files.filter(f => 
      f.originalName.includes(materialName) || materialName.includes(f.originalName.replace(/\.[^/.]+$/, ''))
    );
  };

  const matterMaterials = useMemo(() => {
    if (!matter) return [];
    return safeJSONParse<MatterMaterial[]>(matter.requiredMaterials, []);
  }, [matter]);

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
                  onClick={() => handleViewVersions(item)}
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

      <Modal
        title={
          <Space>
            <span>{currentVersionFile?.originalName} - 版本历史</span>
            <Tag color="blue">共 {versionList.length} 个版本</Tag>
            {versionList.length >= 2 && (
              <Tag color="orange">可勾选2个版本对比</Tag>
            )}
          </Space>
        }
        open={versionModalVisible}
        onCancel={() => setVersionModalVisible(false)}
        footer={
          <Space>
            {selectedCompareIds.length > 0 && (
              <Button onClick={handleClearCompareSelection}>
                清除选择
              </Button>
            )}
            <Button
              type="primary"
              icon={<DiffOutlined />}
              disabled={selectedCompareIds.length !== 2}
              loading={compareLoading}
              onClick={handleCompareVersions}
            >
              {compareButtonText()}
            </Button>
            <Button onClick={() => setVersionModalVisible(false)}>
              关闭
            </Button>
          </Space>
        }
        width={versionList.length >= 2 ? 900 : 800}
      >
        {versionList.length >= 2 && (
          <Alert
            type="info"
            showIcon
            icon={<DiffOutlined />}
            message={
              selectedCompareIds.length === 0
                ? '勾选表格左侧复选框，选择同一材料的两个版本进行对比'
                : selectedCompareIds.length === 1
                  ? '已选择1个版本，请再选择1个版本'
                  : '已选择2个版本，可查看元数据差异摘要'
            }
            style={{ marginBottom: 16 }}
          />
        )}
        <Table
          dataSource={versionList}
          rowKey="id"
          loading={versionLoading}
          pagination={false}
          size="middle"
          rowSelection={versionList.length >= 2 ? {
            type: 'checkbox',
            selectedRowKeys: selectedCompareIds,
            onChange: (keys) => {
              if (keys.length > 2) {
                message.warning('最多只能选择两个版本进行对比');
                return;
              }
              setSelectedCompareIds(keys as string[]);
            },
          } : undefined}
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
              width: 120,
              fixed: 'right',
              render: (_, record: MaterialFile) => (
                <Button
                  type={record.isCurrent ? 'primary' : 'link'}
                  size="small"
                  icon={<DownloadOutlined />}
                  onClick={() => window.open(getDownloadUrl(record.id))}
                >
                  {record.isCurrent ? '下载当前' : '下载'}
                </Button>
              ),
            },
          ]}
        />
        {versionList.length === 0 && !versionLoading && (
          <Empty description="暂无版本记录" />
        )}
      </Modal>

      <Modal
        title={
          compareResult ? (
            <Space>
              <DiffOutlined />
              <span>版本对比 - {compareResult.file1.originalName}</span>
              <Tag color="blue">v{compareResult.file1.version}</Tag>
              <span style={{ color: '#999' }}>→</span>
              <Tag color="green">v{compareResult.file2.version}</Tag>
              {!compareResult.isTextFile && <Tag color="orange">仅元数据对比</Tag>}
            </Space>
          ) : '版本对比'
        }
        open={compareModalVisible}
        onCancel={() => setCompareModalVisible(false)}
        width={960}
        footer={
          compareResult ? (
            <Space>
              <Button
                icon={<DownloadOutlined />}
                onClick={() => window.open(getDownloadUrl(compareResult.file1.id))}
              >
                下载 v{compareResult.file1.version}
              </Button>
              <Button
                type="primary"
                icon={<DownloadOutlined />}
                onClick={() => window.open(getDownloadUrl(compareResult.file2.id))}
              >
                下载 v{compareResult.file2.version}
              </Button>
              <Button onClick={() => setCompareModalVisible(false)}>
                关闭
              </Button>
            </Space>
          ) : (
            <Button onClick={() => setCompareModalVisible(false)}>关闭</Button>
          )
        }
      >
        {compareResult && (
          <div>
            <Alert
              type={compareResult.hasDifferences ? 'warning' : 'success'}
              showIcon
              icon={compareResult.hasDifferences ? <ExclamationCircleOutlined /> : <CheckCircleOutlined />}
              message={
                compareResult.hasDifferences
                  ? `发现 ${compareResult.diffs.filter(diff => diff.changed).length} 处元数据差异`
                  : '两个版本的元数据完全一致'
              }
              description={
                <Space wrap>
                  {compareResult.diffs.filter(diff => diff.changed).map(diff => (
                    <Tag key={diff.field} color="red">{diff.label}</Tag>
                  ))}
                </Space>
              }
              style={{ marginBottom: 16 }}
            />

            <Row gutter={16} style={{ marginBottom: 20 }}>
              <Col span={12}>
                <Card
                  size="small"
                  title={
                    <Space>
                      <Tag color="blue">v{compareResult.file1.version}</Tag>
                      <span>旧版本</span>
                      {compareResult.file1.isCurrent && <Tag color="success">当前版本</Tag>}
                    </Space>
                  }
                  style={{ borderColor: '#91caff' }}
                >
                  <Descriptions column={1} size="small">
                    <Descriptions.Item label="上传人">
                      {compareResult.file1.uploadedByName || <span style={{ color: '#bfbfbf' }}>未知</span>}
                    </Descriptions.Item>
                    <Descriptions.Item label="上传时间">
                      {dayjs(compareResult.file1.createdAt).format('YYYY-MM-DD HH:mm:ss')}
                    </Descriptions.Item>
                    <Descriptions.Item label="文件大小">
                      {formatFileSize(compareResult.file1.fileSize)}
                    </Descriptions.Item>
                    <Descriptions.Item label="版本说明">
                      {compareResult.file1.versionNote || <span style={{ color: '#bfbfbf' }}>无</span>}
                    </Descriptions.Item>
                  </Descriptions>
                </Card>
              </Col>
              <Col span={12}>
                <Card
                  size="small"
                  title={
                    <Space>
                      <Tag color="green">v{compareResult.file2.version}</Tag>
                      <span>新版本</span>
                      {compareResult.file2.isCurrent && <Tag color="success">当前版本</Tag>}
                    </Space>
                  }
                  style={{ borderColor: '#95de64' }}
                >
                  <Descriptions column={1} size="small">
                    <Descriptions.Item label="上传人">
                      {compareResult.file2.uploadedByName || <span style={{ color: '#bfbfbf' }}>未知</span>}
                    </Descriptions.Item>
                    <Descriptions.Item label="上传时间">
                      {dayjs(compareResult.file2.createdAt).format('YYYY-MM-DD HH:mm:ss')}
                    </Descriptions.Item>
                    <Descriptions.Item label="文件大小">
                      {formatFileSize(compareResult.file2.fileSize)}
                    </Descriptions.Item>
                    <Descriptions.Item label="版本说明">
                      {compareResult.file2.versionNote || <span style={{ color: '#bfbfbf' }}>无</span>}
                    </Descriptions.Item>
                  </Descriptions>
                </Card>
              </Col>
            </Row>

            <Divider style={{ margin: '12px 0 16px' }}>
              <span style={{ fontSize: 14, fontWeight: 600 }}>
                <DiffOutlined style={{ marginRight: 6 }} />
                差异详情摘要
              </span>
            </Divider>

            <div style={{ border: '1px solid #e8e8e8', borderRadius: 8, overflow: 'hidden' }}>
              <Row
                style={{
                  background: '#f5f5f5',
                  padding: '12px 16px',
                  fontWeight: 600,
                  borderBottom: '1px solid #e8e8e8',
                }}
              >
                <Col span={5}>对比项</Col>
                <Col span={7}>v{compareResult.file1.version}</Col>
                <Col span={1} style={{ textAlign: 'center' }}> </Col>
                <Col span={7}>v{compareResult.file2.version}</Col>
                <Col span={4} style={{ textAlign: 'center' }}>结果</Col>
              </Row>
              {compareResult.diffs.map(diff => (
                <Row
                  key={diff.field}
                  style={{
                    padding: '14px 16px',
                    borderBottom: '1px solid #f0f0f0',
                    background: diff.changed ? '#fffbe6' : '#fff',
                  }}
                >
                  <Col span={5} style={{ fontWeight: 500 }}>{diff.label}</Col>
                  <Col span={7} style={{ color: diff.changed ? '#cf1322' : undefined }}>
                    {renderDiffValue(diff.field, diff.oldValue)}
                  </Col>
                  <Col span={1} style={{ textAlign: 'center', color: '#bfbfbf' }}>
                    {diff.changed ? '→' : '='}
                  </Col>
                  <Col span={7} style={{ color: diff.changed ? '#389e0d' : undefined }}>
                    {renderDiffValue(diff.field, diff.newValue)}
                  </Col>
                  <Col span={4} style={{ textAlign: 'center' }}>
                    {diff.changed ? (
                      <Tag color="red" icon={<CloseCircleOutlined />}>有差异</Tag>
                    ) : (
                      <Tag color="green" icon={<CheckCircleOutlined />}>一致</Tag>
                    )}
                  </Col>
                </Row>
              ))}
            </div>

            <Alert
              type="info"
              showIcon
              style={{ marginTop: 16 }}
              message={compareResult.isTextFile ? '文本文件提示' : '非文本文件提示'}
              description={
                compareResult.isTextFile
                  ? '当前页面展示元数据差异摘要。如需对比文件内容，请下载两个版本后使用文本对比工具查看。'
                  : '该文件类型为非文本文件，仅展示上传时间、上传人、版本说明、文件大小和当前版本标记等元数据差异。'
              }
            />
          </div>
        )}
      </Modal>

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
