import { Button, Empty, Modal, Space, Table, Tag } from 'antd';
import type { TableProps } from 'antd';
import { DownloadOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { getDownloadUrl } from '../api/fileApi';
import { MaterialFile } from '../types';
import { formatFileSize } from '../utils/common';

interface FileVersionModalProps {
  open: boolean;
  currentVersionFile: MaterialFile | null;
  versionList: MaterialFile[];
  loading: boolean;
  onCancel: () => void;
}

export default function FileVersionModal({
  open,
  currentVersionFile,
  versionList,
  loading,
  onCancel,
}: FileVersionModalProps) {
  const columns: TableProps<MaterialFile>['columns'] = [
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
  ];

  return (
    <Modal
      title={
        <Space>
          <span>{currentVersionFile?.originalName} - 版本历史</span>
          <Tag color="blue">共 {versionList.length} 个版本</Tag>
        </Space>
      }
      open={open}
      onCancel={onCancel}
      footer={null}
      width={800}
    >
      <Table
        dataSource={versionList}
        rowKey="id"
        loading={loading}
        pagination={false}
        size="middle"
        columns={columns}
      />
      {versionList.length === 0 && !loading && (
        <Empty description="暂无版本记录" />
      )}
    </Modal>
  );
}
