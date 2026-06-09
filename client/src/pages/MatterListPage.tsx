import { useEffect, useState } from 'react';
import { Card, List, Tag, Button, Input, Space, Pagination, Modal, Descriptions, message } from 'antd';
import { SearchOutlined, FileTextOutlined, ClockCircleOutlined } from '@ant-design/icons';
import { listMatters } from '../api/matterApi';
import { Matter } from '../types';
import { useAuth } from '../context/AuthContext';
import { createApplication } from '../api/applicationApi';
import { useNavigate } from 'react-router-dom';
import { safeJSONParse } from '../utils/common';

const { Search } = Input;

interface MatterListPageProps {
  isAdmin?: boolean;
}

export default function MatterListPage({ isAdmin = false }: MatterListPageProps) {
  const [matters, setMatters] = useState<Matter[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [keyword, setKeyword] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedMatter, setSelectedMatter] = useState<Matter | null>(null);
  const [detailVisible, setDetailVisible] = useState(false);
  
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    loadMatters();
  }, [page, keyword]);

  const loadMatters = async () => {
    setLoading(true);
    try {
      const res = await listMatters({
        keyword: keyword || undefined,
        status: isAdmin ? undefined : 'active',
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

  const handleViewDetail = (matter: Matter) => {
    setSelectedMatter(matter);
    setDetailVisible(true);
  };

  const handleApply = async (matter: Matter) => {
    try {
      const res = await createApplication({ matterId: matter.id });
      if (res.success && res.data) {
        message.success('申请创建成功，请填写信息并提交');
        navigate(`/applications/${res.data.id}/edit`);
      }
    } catch (error) {
      // error handled by interceptor
    }
  };

  const requiredMaterials = selectedMatter 
    ? safeJSONParse<any[]>(selectedMatter.requiredMaterials, [])
    : [];

  return (
    <div>
      <Card
        title={isAdmin ? '事项管理' : '办事大厅'}
        extra={
          <Space>
            <Search
              placeholder="搜索事项名称/编码/部门"
              allowClear
              enterButton={<SearchOutlined />}
              size="middle"
              onSearch={handleSearch}
              style={{ width: 300 }}
            />
          </Space>
        }
      >
        <List
          loading={loading}
          grid={{ gutter: 16, xs: 1, sm: 2, md: 2, lg: 3, xl: 3 }}
          dataSource={matters}
          renderItem={(matter) => (
            <List.Item>
              <Card
                hoverable
                actions={[
                  <Button type="link" onClick={() => handleViewDetail(matter)}>查看详情</Button>,
                  !isAdmin && user?.role === 'applicant' && matter.status === 'active'
                    ? <Button type="primary" onClick={() => handleApply(matter)}>立即办理</Button>
                    : null,
                ].filter(Boolean)}
              >
                <Card.Meta
                  title={
                    <Space>
                      <FileTextOutlined />
                      <span>{matter.name}</span>
                      {isAdmin && (
                        <Tag color={matter.status === 'active' ? 'green' : 'default'}>
                          {matter.status === 'active' ? '启用' : '停用'}
                        </Tag>
                      )}
                    </Space>
                  }
                  description={
                    <div style={{ marginTop: 12 }}>
                      <div style={{ marginBottom: 8 }}>
                        <Tag color="blue">{matter.department}</Tag>
                        <Tag>{matter.code}</Tag>
                      </div>
                      <p style={{ color: '#666', fontSize: 13, marginBottom: 8 }}>
                        {matter.description || '暂无描述'}
                      </p>
                      <div style={{ display: 'flex', alignItems: 'center', color: '#999', fontSize: 12 }}>
                        <ClockCircleOutlined style={{ marginRight: 4 }} />
                        承诺办结：{matter.promiseDays} 个工作日
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', color: '#999', fontSize: 12, marginTop: 4 }}>
                        提前预警：{matter.warningDays ?? 3} 天
                        {matter.excludeSupplementTime && <Tag color="blue" style={{ marginLeft: 8, fontSize: 11 }}>排除补正时间</Tag>}
                      </div>
                    </div>
                  }
                />
              </Card>
            </List.Item>
          )}
        />
        <div style={{ marginTop: 24, textAlign: 'right' }}>
          <Pagination
            current={page}
            total={total}
            pageSize={pageSize}
            onChange={setPage}
            showSizeChanger={false}
          />
        </div>
      </Card>

      <Modal
        title="事项详情"
        open={detailVisible}
        onCancel={() => setDetailVisible(false)}
        footer={[
          <Button key="close" onClick={() => setDetailVisible(false)}>关闭</Button>,
          !isAdmin && user?.role === 'applicant' && selectedMatter?.status === 'active' ? (
            <Button key="apply" type="primary" onClick={() => {
              setDetailVisible(false);
              if (selectedMatter) handleApply(selectedMatter);
            }}>立即办理</Button>
          ) : null,
        ].filter(Boolean)}
        width={600}
      >
        {selectedMatter && (
          <Descriptions column={1} bordered size="small">
            <Descriptions.Item label="事项编码">{selectedMatter.code}</Descriptions.Item>
            <Descriptions.Item label="事项名称">{selectedMatter.name}</Descriptions.Item>
            <Descriptions.Item label="办理部门">{selectedMatter.department}</Descriptions.Item>
            <Descriptions.Item label="承诺时限">{selectedMatter.promiseDays} 个工作日</Descriptions.Item>
            <Descriptions.Item label="提前预警天数">{selectedMatter.warningDays ?? 3} 天</Descriptions.Item>
            <Descriptions.Item label="排除补正等待时间">
              {selectedMatter.excludeSupplementTime ? '是（计算超期时扣除补正天数）' : '否'}
            </Descriptions.Item>
            <Descriptions.Item label="事项描述">{selectedMatter.description || '暂无'}</Descriptions.Item>
            <Descriptions.Item label="所需材料">
              {requiredMaterials.length > 0 ? (
                <ul style={{ margin: 0, paddingLeft: 20 }}>
                  {requiredMaterials.map((m, idx) => (
                    <li key={idx}>
                      {m.required && <span style={{ color: 'red' }}>* </span>}
                      {m.name}
                      {m.description && <span style={{ color: '#999' }}>（{m.description}）</span>}
                    </li>
                  ))}
                </ul>
              ) : '暂无'}
            </Descriptions.Item>
          </Descriptions>
        )}
      </Modal>
    </div>
  );
}
