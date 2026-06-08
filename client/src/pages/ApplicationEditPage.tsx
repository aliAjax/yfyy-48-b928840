import { useEffect, useState, useMemo } from 'react';
import { Card, Form, Input, Button, Space, message, Upload, List, Divider, Checkbox, Tag, Modal, Select, Table, Tooltip, Popconfirm } from 'antd';
import { ArrowLeftOutlined, UploadOutlined, DeleteOutlined, FileTextOutlined, SaveOutlined, SendOutlined, CheckCircleOutlined, CloseCircleOutlined, CopyOutlined, HistoryOutlined, DownloadOutlined } from '@ant-design/icons';
import { useParams, useNavigate } from 'react-router-dom';
import { getApplication, updateApplication, submitApplication } from '../api/applicationApi';
import { getMatter } from '../api/matterApi';
import { listTemplates, createTemplate, getTemplate } from '../api/templateApi';
import { Application, Matter, ApplicationMaterial, MatterMaterial, ApplicationTemplate, MaterialFile } from '../types';
import { useAuth } from '../context/AuthContext';
import { safeJSONParse, formatFileSize } from '../utils/common';
import { uploadFile, deleteFile, getDownloadUrl, listFileVersions } from '../api/fileApi';
import dayjs from 'dayjs';

export default function ApplicationEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [form] = Form.useForm();
  const [application, setApplication] = useState<Application | null>(null);
  const [matter, setMatter] = useState<Matter | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [materials, setMaterials] = useState<ApplicationMaterial[]>([]);
  const [saveTemplateVisible, setSaveTemplateVisible] = useState(false);
  const [applyTemplateVisible, setApplyTemplateVisible] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [templateList, setTemplateList] = useState<ApplicationTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [versionModalVisible, setVersionModalVisible] = useState(false);
  const [versionList, setVersionList] = useState<MaterialFile[]>([]);
  const [currentVersionFile, setCurrentVersionFile] = useState<MaterialFile | null>(null);
  const [versionLoading, setVersionLoading] = useState(false);

  useEffect(() => {
    if (id) {
      loadApplication();
    }
  }, [id]);

  const loadApplication = async () => {
    setLoading(true);
    try {
      const res = await getApplication(id!);
      if (res.success && res.data) {
        setApplication(res.data);
        const basicInfo = safeJSONParse<Record<string, any>>(res.data.basicInfo, {});
        form.setFieldsValue(basicInfo);

        if (res.data.matterId) {
          const matterRes = await getMatter(res.data.matterId);
          if (matterRes.success && matterRes.data) {
            setMatter(matterRes.data);
            initMaterials(res.data.materials, matterRes.data.requiredMaterials);
          }
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const initMaterials = (appMaterialsStr: string, matterMaterialsStr: string) => {
    const appMaterials = safeJSONParse<ApplicationMaterial[]>(appMaterialsStr, []);
    const matterMaterials = safeJSONParse<MatterMaterial[]>(matterMaterialsStr, []);

    if (appMaterials.length > 0) {
      setMaterials(appMaterials);
    } else {
      const initial: ApplicationMaterial[] = matterMaterials.map(m => ({
        ...m,
        checked: false,
        remark: '',
      }));
      setMaterials(initial);
    }
  };

  const handleMaterialCheck = (index: number, checked: boolean) => {
    const newMaterials = [...materials];
    newMaterials[index] = { ...newMaterials[index], checked };
    setMaterials(newMaterials);
  };

  const handleMaterialRemark = (index: number, remark: string) => {
    const newMaterials = [...materials];
    newMaterials[index] = { ...newMaterials[index], remark };
    setMaterials(newMaterials);
  };

  const getIncompleteRequired = () => {
    return materials.filter(m => m.required && !m.checked);
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      const res = await updateApplication(id!, { basicInfo: values, materials });
      if (res.success) {
        message.success('保存成功');
        loadApplication();
      }
    } catch {}
  };

  const handleSubmit = async () => {
    try {
      await form.validateFields();

      const incomplete = getIncompleteRequired();
      if (incomplete.length > 0) {
        Modal.confirm({
          title: '材料未准备齐全',
          icon: <CloseCircleOutlined style={{ color: '#faad14' }} />,
          content: (
            <div>
              <p>以下 <strong>{incomplete.length}</strong> 项必填材料尚未勾选为"已准备"：</p>
              <ul style={{ margin: '8px 0', paddingLeft: 20 }}>
                {incomplete.map((m, idx) => (
                  <li key={idx} style={{ color: '#ff4d4f' }}>
                    <strong>{m.name}</strong>
                    {m.description && <span style={{ color: '#999', marginLeft: 8 }}>（{m.description}）</span>}
                  </li>
                ))}
              </ul>
              <p style={{ marginTop: 12, color: '#666' }}>是否仍要提交申请？</p>
            </div>
          ),
          okText: '仍要提交',
          cancelText: '返回核对',
          onOk: async () => {
            await doSubmit();
          },
        });
        return;
      }

      await doSubmit();
    } catch {}
  };

  const doSubmit = async () => {
    try {
      const values = await form.getFieldsValue();
      await updateApplication(id!, { basicInfo: values, materials });

      setSubmitting(true);
      const res = await submitApplication(id!);
      if (res.success) {
        message.success('提交成功');
        navigate(`/applications/${id}`);
      }
    } catch (error) {
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveAsTemplate = () => {
    setTemplateName('');
    setSaveTemplateVisible(true);
  };

  const handleConfirmSaveTemplate = async () => {
    if (!templateName.trim()) {
      message.warning('请输入模板名称');
      return;
    }
    try {
      const values = await form.getFieldsValue();
      setSavingTemplate(true);
      const res = await createTemplate({
        name: templateName.trim(),
        matterId: application!.matterId,
        basicInfo: values,
        materials,
      });
      if (res.success) {
        message.success('模板保存成功');
        setSaveTemplateVisible(false);
      }
    } catch (error) {
    } finally {
      setSavingTemplate(false);
    }
  };

  const handleApplyTemplate = () => {
    loadTemplateList();
    setSelectedTemplateId(null);
    setApplyTemplateVisible(true);
  };

  const loadTemplateList = async () => {
    if (!application?.matterId) return;
    setLoadingTemplates(true);
    try {
      const res = await listTemplates({ matterId: application.matterId, pageSize: 100 });
      if (res.success) {
        setTemplateList(res.data || []);
      }
    } finally {
      setLoadingTemplates(false);
    }
  };

  const handleConfirmApplyTemplate = async () => {
    if (!selectedTemplateId) {
      message.warning('请选择要套用的模板');
      return;
    }
    try {
      const res = await getTemplate(selectedTemplateId);
      if (res.success && res.data) {
        const basicInfo = safeJSONParse<Record<string, any>>(res.data.basicInfo, {});
        const templateMaterials = safeJSONParse<ApplicationMaterial[]>(res.data.materials, []);

        form.setFieldsValue(basicInfo);

        if (templateMaterials.length > 0) {
          setMaterials(templateMaterials);
        }

        message.success('模板套用成功');
        setApplyTemplateVisible(false);
      }
    } catch (error) {
    }
  };

  const handleUpload = (file: File) => {
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
    if (application.applicantId !== user.id) return { canDelete: false, reason: '只能删除本人申请的材料' };
    if (application.status !== 'draft' && application.status !== 'supplement') {
      return { canDelete: false, reason: '仅草稿或补正状态可删除' };
    }
    if (file.uploadedBy !== user.id) return { canDelete: false, reason: '只能删除本人上传的材料' };
    if (!file.isCurrent) return { canDelete: false, reason: '只能删除最新版本' };
    return { canDelete: true };
  };

  const checkedCount = useMemo(() => materials.filter(m => m.checked).length, [materials]);
  const requiredCount = useMemo(() => materials.filter(m => m.required).length, [materials]);
  const requiredCheckedCount = useMemo(() => materials.filter(m => m.required && m.checked).length, [materials]);

  if (!application && !loading) {
    return <div style={{ textAlign: 'center', padding: 40 }}>申请不存在</div>;
  }

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)}>
          返回
        </Button>
        <Button icon={<CopyOutlined />} onClick={handleApplyTemplate}>
          套用模板
        </Button>
        <Button icon={<SaveOutlined />} onClick={handleSaveAsTemplate}>
          保存为模板
        </Button>
        <Button type="primary" icon={<SaveOutlined />} onClick={handleSave}>
          保存草稿
        </Button>
        <Button type="primary" icon={<SendOutlined />} onClick={handleSubmit} loading={submitting}>
          提交申请
        </Button>
      </Space>

      <Card title={`${matter?.name || '申请事项'} - 申请填写`} style={{ marginBottom: 16 }}>
        <div style={{ marginBottom: 16, padding: 12, background: '#f5f5f5', borderRadius: 4 }}>
          <div><strong>申请编号：</strong>{application?.applicationNo}</div>
          <div><strong>办理部门：</strong>{matter?.department}</div>
          <div><strong>承诺办结时限：</strong>{matter?.promiseDays} 个工作日</div>
          {application?.supplementReason && (
            <div style={{ marginTop: 8, color: '#faad14' }}>
              <strong>补正要求：</strong>{application.supplementReason}
            </div>
          )}
        </div>

        <Divider orientation="left">基本信息</Divider>

        <Form
          form={form}
          layout="vertical"
          style={{ maxWidth: 600 }}
        >
          <Form.Item
            label="姓名"
            name="name"
            rules={[{ required: true, message: '请输入姓名' }]}
          >
            <Input placeholder="请输入姓名" />
          </Form.Item>
          <Form.Item
            label="身份证号"
            name="idCard"
            rules={[{ required: true, message: '请输入身份证号' }]}
          >
            <Input placeholder="请输入身份证号" />
          </Form.Item>
          <Form.Item
            label="联系电话"
            name="phone"
            rules={[{ required: true, message: '请输入联系电话' }]}
          >
            <Input placeholder="请输入联系电话" />
          </Form.Item>
          <Form.Item
            label="联系地址"
            name="address"
          >
            <Input placeholder="请输入联系地址" />
          </Form.Item>
          <Form.Item
            label="申请说明"
            name="description"
          >
            <Input.TextArea rows={4} placeholder="请输入申请说明" />
          </Form.Item>
        </Form>

        <Divider orientation="left">材料清单核对</Divider>

        {materials.length > 0 && (
          <>
            <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
              <Tag color="blue">共 {materials.length} 项</Tag>
              <Tag color="orange">必填 {requiredCount} 项</Tag>
              <Tag color={requiredCheckedCount === requiredCount ? 'green' : 'default'}>
                已准备 {checkedCount} 项
                {requiredCount > 0 && ` (必填 ${requiredCheckedCount}/${requiredCount})`}
              </Tag>
            </div>

            <div style={{ marginBottom: 16, border: '1px solid #e8e8e8', borderRadius: 4, overflow: 'hidden' }}>
              {materials.map((m, idx) => (
                <div
                  key={idx}
                  style={{
                    padding: '12px 16px',
                    borderBottom: idx < materials.length - 1 ? '1px solid #f0f0f0' : 'none',
                    background: m.checked ? '#f6ffed' : '#fff',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                    <Checkbox
                      checked={m.checked}
                      onChange={(e) => handleMaterialCheck(idx, e.target.checked)}
                      style={{ marginTop: 2 }}
                    />
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
                      <div style={{ marginTop: 8 }}>
                        <Input
                          size="small"
                          placeholder="填写备注（可选）"
                          value={m.remark || ''}
                          onChange={(e) => handleMaterialRemark(idx, e.target.value)}
                          style={{ maxWidth: 400 }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        <Divider orientation="left">
          <Space>
            <span>上传材料</span>
            <Tag color="blue">共 {application?.files?.length || 0} 份当前版本</Tag>
          </Space>
        </Divider>

        <div style={{ marginBottom: 16 }}>
          <Upload
            customRequest={({ file }) => handleUpload(file as File)}
            showUploadList={false}
          >
            <Button type="primary" icon={<UploadOutlined />}>上传材料</Button>
          </Upload>
        </div>

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
                  ) : (
                    <Tooltip title={reason}>
                      <Button key="delete" type="link" size="small" disabled style={{ color: '#bfbfbf' }}>
                        删除
                      </Button>
                    </Tooltip>
                  ),
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

      <Modal
        title="保存为模板"
        open={saveTemplateVisible}
        onCancel={() => setSaveTemplateVisible(false)}
        onOk={handleConfirmSaveTemplate}
        confirmLoading={savingTemplate}
        okText="保存"
        cancelText="取消"
      >
        <div style={{ marginTop: 16 }}>
          <p style={{ marginBottom: 16, color: '#666' }}>
            将当前申请的基本信息和材料核对内容保存为模板，下次创建同类申请时可一键套用。
          </p>
          <Form layout="vertical">
            <Form.Item label="模板名称" required>
              <Input
                placeholder="请输入模板名称，便于下次快速识别"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                maxLength={50}
              />
            </Form.Item>
            <div style={{ color: '#999', fontSize: 12 }}>
              所属事项：{matter?.name}
            </div>
          </Form>
        </div>
      </Modal>

      <Modal
        title="套用模板"
        open={applyTemplateVisible}
        onCancel={() => setApplyTemplateVisible(false)}
        onOk={handleConfirmApplyTemplate}
        okText="套用"
        cancelText="取消"
        width={500}
      >
        <div style={{ marginTop: 16 }}>
          <p style={{ marginBottom: 16, color: '#666' }}>
            选择一个模板，将自动填充基本信息和材料核对内容。
          </p>
          <Select
            placeholder="请选择模板"
            style={{ width: '100%' }}
            loading={loadingTemplates}
            value={selectedTemplateId}
            onChange={(value) => setSelectedTemplateId(value)}
            options={templateList.map(t => ({
              label: t.name,
              value: t.id,
            }))}
            notFoundContent="暂无可用模板"
            showSearch
            optionFilterProp="label"
          />
          {selectedTemplateId && (
            <div style={{ marginTop: 12, padding: 12, background: '#f5f5f5', borderRadius: 4 }}>
              <div style={{ color: '#999', fontSize: 12 }}>
                创建时间：{dayjs(templateList.find(t => t.id === selectedTemplateId)?.createdAt).format('YYYY-MM-DD HH:mm')}
              </div>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
