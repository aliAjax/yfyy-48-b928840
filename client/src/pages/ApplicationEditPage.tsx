import { useEffect, useState, useMemo } from 'react';
import { Card, Form, Input, Button, Space, message, Upload, List, Divider, Checkbox, Tag, Modal } from 'antd';
import { ArrowLeftOutlined, UploadOutlined, DeleteOutlined, FileTextOutlined, SaveOutlined, SendOutlined, CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import { useParams, useNavigate } from 'react-router-dom';
import { getApplication, updateApplication, submitApplication } from '../api/applicationApi';
import { getMatter } from '../api/matterApi';
import { Application, Matter, ApplicationMaterial, MatterMaterial } from '../types';
import { useAuth } from '../context/AuthContext';
import { safeJSONParse, formatFileSize } from '../utils/common';
import { uploadFile, deleteFile, getDownloadUrl } from '../api/fileApi';
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
      }
    } catch {}
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

        <Divider orientation="left">上传材料</Divider>

        <div style={{ marginBottom: 16 }}>
          <Upload
            customRequest={({ file }) => handleUpload(file as File)}
            showUploadList={false}
          >
            <Button icon={<UploadOutlined />}>上传材料</Button>
          </Upload>
        </div>

        <List
          dataSource={application?.files || []}
          renderItem={(item: any) => (
            <List.Item
              actions={[
                <Button type="link" size="small" onClick={() => window.open(getDownloadUrl(item.id))}>
                  下载
                </Button>,
                <Button type="link" danger size="small" onClick={() => handleDeleteFile(item.id)}>
                  删除
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
    </div>
  );
}
