import { useEffect, useState } from 'react';
import {
  Card,
  List,
  Tag,
  Button,
  Input,
  Select,
  Space,
  Pagination,
  Modal,
  Descriptions,
  Timeline,
  Row,
  Col,
} from 'antd';
import {
  SearchOutlined,
  FileTextOutlined,
  ClockCircleOutlined,
  TeamOutlined,
  CheckCircleOutlined,
  FolderOpenOutlined,
  SolutionOutlined,
} from '@ant-design/icons';
import { listGuideMatters, listDepartments, getGuideMatter } from '../api/guideApi';
import { Matter } from '../types';
import { safeJSONParse } from '../utils/common';

const { Search } = Input;
const { Option } = Select;

interface FlowStep {
  name: string;
  description?: string;
  days?: number;
}

interface MaterialItem {
  name: string;
  required?: boolean;
  description?: string;
}

export default function GuidePage() {
  const [matters, setMatters] = useState<Matter[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(8);
  const [keyword, setKeyword] = useState('');
  const [department, setDepartment] = useState<string>('');
  const [departments, setDepartments] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [detailVisible, setDetailVisible] = useState(false);
  const [selectedMatter, setSelectedMatter] = useState<Matter | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    loadDepartments();
  }, []);

  useEffect(() => {
    loadMatters();
  }, [page, keyword, department]);

  const loadDepartments = async () => {
    try {
      const res = await listDepartments();
      if (res.success) {
        setDepartments(res.data || []);
      }
    } catch (error) {
      // error handled by interceptor
    }
  };

  const loadMatters = async () => {
    setLoading(true);
    try {
      const res = await listGuideMatters({
        department: department || undefined,
        keyword: keyword || undefined,
        page,
        pageSize,
      });
      if (res.success) {
        setMatters(res.data || []);
        setTotal(res.total || 0);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (value: string) => {
    setKeyword(value);
    setPage(1);
  };

  const handleDepartmentChange = (value: string) => {
    setDepartment(value);
    setPage(1);
  };

  const handleViewDetail = async (matter: Matter) => {
    setDetailLoading(true);
    try {
      const res = await getGuideMatter(matter.id);
      if (res.success && res.data) {
        setSelectedMatter(res.data);
        setDetailVisible(true);
      }
    } finally {
      setDetailLoading(false);
    }
  };

  const requiredMaterials = selectedMatter
    ? safeJSONParse<MaterialItem[]>(selectedMatter.requiredMaterials, [])
    : [];

  const flowSteps = selectedMatter
    ? safeJSONParse<FlowStep[]>(selectedMatter.flowConfig, [])
    : [];

  const getMaterialCount = (matter: Matter) => {
    const materials = safeJSONParse<MaterialItem[]>(matter.requiredMaterials, []);
    return materials.length;
  };

  return (
    <div>
      <Card
        title={
          <Space>
            <SolutionOutlined style={{ fontSize: 20, color: '#1890ff' }} />
            <span>办事指南</span>
          </Space>
        }
        extra={
          <Space wrap>
            <Select
              placeholder="选择部门"
              allowClear
              style={{ width: 180 }}
              onChange={handleDepartmentChange}
              value={department || undefined}
            >
              {departments.map((dept) => (
                <Option key={dept} value={dept}>
                  {dept}
                </Option>
              ))}
            </Select>
            <Search
              placeholder="搜索事项名称/编码"
              allowClear
              enterButton={<SearchOutlined />}
              size="middle"
              onSearch={handleSearch}
              style={{ width: 300 }}
            />
          </Space>
        }
      >
        {(keyword || department) && (
          <div style={{ marginBottom: 16, padding: '8px 12px', background: '#f0f5ff', borderRadius: 4 }}>
            <Space size="small">
              <span style={{ color: '#666' }}>筛选条件：</span>
              {department && (
                <Tag color="blue" closable onClose={() => handleDepartmentChange('')}>
                  部门：{department}
                </Tag>
              )}
              {keyword && (
                <Tag color="green" closable onClose={() => handleSearch('')}>
                  关键词：{keyword}
                </Tag>
              )}
              <span style={{ color: '#999', fontSize: 12 }}>
                共找到 {total} 个事项
              </span>
            </Space>
          </div>
        )}

        <List
          loading={loading}
          grid={{ gutter: 16, xs: 1, sm: 1, md: 2, lg: 2, xl: 3 }}
          dataSource={matters}
          locale={{ emptyText: '暂无相关办事指南' }}
          renderItem={(matter) => (
            <List.Item>
              <Card
                hoverable
                style={{ height: '100%' }}
                bodyStyle={{ padding: 20 }}
                actions={[
                  <Button
                    type="link"
                    icon={<FileTextOutlined />}
                    onClick={() => handleViewDetail(matter)}
                  >
                    查看指南
                  </Button>,
                ]}
              >
                <Card.Meta
                  title={
                    <Space direction="vertical" size={8} style={{ width: '100%' }}>
                      <Space>
                        <FolderOpenOutlined style={{ color: '#1890ff' }} />
                        <span style={{ fontSize: 16, fontWeight: 500 }}>
                          {matter.name}
                        </span>
                      </Space>
                      <Space size={[4, 4]} wrap>
                        <Tag color="blue" icon={<TeamOutlined />}>
                          {matter.department}
                        </Tag>
                        <Tag>{matter.code}</Tag>
                      </Space>
                    </Space>
                  }
                  description={
                    <div style={{ marginTop: 12 }}>
                      <p
                        style={{
                          color: '#666',
                          fontSize: 13,
                          marginBottom: 12,
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                          minHeight: 36,
                        }}
                      >
                        {matter.description || '暂无办理条件说明'}
                      </p>
                      <Row gutter={16}>
                        <Col span={12}>
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              color: '#999',
                              fontSize: 12,
                            }}
                          >
                            <FileTextOutlined style={{ marginRight: 4 }} />
                            <span>
                              所需材料：{getMaterialCount(matter)}份
                            </span>
                          </div>
                        </Col>
                        <Col span={12}>
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              color: '#999',
                              fontSize: 12,
                            }}
                          >
                            <ClockCircleOutlined style={{ marginRight: 4 }} />
                            <span>承诺：{matter.promiseDays}个工作日</span>
                          </div>
                        </Col>
                      </Row>
                    </div>
                  }
                />
              </Card>
            </List.Item>
          )}
        />

        {total > 0 && (
          <div style={{ marginTop: 24, textAlign: 'right' }}>
            <Pagination
              current={page}
              total={total}
              pageSize={pageSize}
              onChange={setPage}
              showSizeChanger={false}
            />
          </div>
        )}
      </Card>

      <Modal
        title={
          <Space>
            <FileTextOutlined />
            <span>{selectedMatter?.name} - 办事指南</span>
          </Space>
        }
        open={detailVisible}
        onCancel={() => setDetailVisible(false)}
        footer={[
          <Button key="close" onClick={() => setDetailVisible(false)}>
            关闭
          </Button>,
        ]}
        width={720}
        maskClosable={false}
      >
        {detailLoading ? (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>加载中...</div>
        ) : selectedMatter ? (
          <div>
            <Descriptions column={2} bordered size="small" style={{ marginBottom: 24 }}>
              <Descriptions.Item label="事项编码">
                {selectedMatter.code}
              </Descriptions.Item>
              <Descriptions.Item label="办理部门">
                <Tag color="blue">{selectedMatter.department}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="承诺时限" span={2}>
                <Space>
                  <ClockCircleOutlined style={{ color: '#faad14' }} />
                  <span>
                    <strong style={{ color: '#faad14' }}>
                      {selectedMatter.promiseDays}
                    </strong>{' '}
                    个工作日内办结
                  </span>
                </Space>
              </Descriptions.Item>
            </Descriptions>

            <Card
              size="small"
              title={
                <Space>
                  <CheckCircleOutlined style={{ color: '#52c41a' }} />
                  <span>办理条件</span>
                </Space>
              }
              style={{ marginBottom: 16 }}
            >
              <div style={{ color: '#333', lineHeight: 1.8 }}>
                {selectedMatter.description || '暂无办理条件说明'}
              </div>
            </Card>

            <Card
              size="small"
              title={
                <Space>
                  <FileTextOutlined style={{ color: '#1890ff' }} />
                  <span>所需材料</span>
                </Space>
              }
              style={{ marginBottom: 16 }}
            >
              {requiredMaterials.length > 0 ? (
                <ul style={{ margin: 0, paddingLeft: 20, lineHeight: 2 }}>
                  {requiredMaterials.map((m, idx) => (
                    <li key={idx}>
                      {m.required && <span style={{ color: '#f5222d' }}>* </span>}
                      <span style={{ fontWeight: 500 }}>{m.name}</span>
                      {m.description && (
                        <span style={{ color: '#999', marginLeft: 8 }}>
                          （{m.description}）
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <span style={{ color: '#999' }}>暂无材料要求</span>
              )}
            </Card>

            <Card
              size="small"
              title={
                <Space>
                  <SolutionOutlined style={{ color: '#722ed1' }} />
                  <span>办理流程</span>
                </Space>
              }
            >
              {flowSteps.length > 0 ? (
                <Timeline
                  items={flowSteps.map((step, idx) => ({
                    color: idx === 0 ? 'blue' : 'green',
                    children: (
                      <div>
                        <div style={{ fontWeight: 500, marginBottom: 4 }}>
                          {step.name}
                          {step.days && (
                            <Tag color="orange" style={{ marginLeft: 8, fontSize: 12 }}>
                              {step.days}个工作日
                            </Tag>
                          )}
                        </div>
                        {step.description && (
                          <div style={{ color: '#666', fontSize: 13 }}>
                            {step.description}
                          </div>
                        )}
                      </div>
                    ),
                  }))}
                />
              ) : (
                <span style={{ color: '#999' }}>暂无办理流程说明</span>
              )}
            </Card>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
