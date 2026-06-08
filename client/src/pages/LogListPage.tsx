import { useEffect, useState } from 'react';
import { Card, Table, Tag } from 'antd';
import { listLogs } from '../api/logApi';
import { OperationLog } from '../types';
import { actionLabels } from '../utils/common';
import dayjs from 'dayjs';

export default function LogListPage() {
  const [logs, setLogs] = useState<OperationLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadLogs();
  }, [page, pageSize]);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const res = await listLogs({ page, pageSize });
      if (res.success) {
        setLogs(res.data || []);
        setTotal(res.total || 0);
      }
    } finally {
      setLoading(false);
    }
  };

  const actionColorMap: Record<string, string> = {
    create: 'default',
    update: 'default',
    submit: 'blue',
    accept: 'green',
    supplement: 'orange',
    reject: 'red',
    send_review: 'purple',
    review: 'cyan',
    complete: 'green',
  };

  const columns = [
    {
      title: '操作类型',
      dataIndex: 'action',
      key: 'action',
      width: 120,
      render: (action: string) => (
        <Tag color={actionColorMap[action] || 'default'}>
          {actionLabels[action] || action}
        </Tag>
      ),
    },
    {
      title: '操作描述',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
    },
    {
      title: '申请编号',
      dataIndex: 'applicationId',
      key: 'applicationId',
      width: 200,
      render: (_: any, record: OperationLog) => record.applicationId?.substring(0, 20) + '...',
    },
    {
      title: '操作人',
      dataIndex: 'userName',
      key: 'userName',
      width: 120,
    },
    {
      title: '状态变化',
      key: 'status',
      width: 200,
      render: (_: any, record: OperationLog) => {
        if (record.oldStatus && record.newStatus) {
          return (
            <span>
              <Tag>{record.oldStatus}</Tag>
              <span style={{ margin: '0 4px' }}>→</span>
              <Tag color="blue">{record.newStatus}</Tag>
            </span>
          );
        }
        return '-';
      },
    },
    {
      title: '操作时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 170,
      render: (text: string) => dayjs(text).format('YYYY-MM-DD HH:mm:ss'),
    },
  ];

  return (
    <Card title="操作日志">
      <Table
        rowKey="id"
        loading={loading}
        dataSource={logs}
        columns={columns}
        pagination={{
          current: page,
          pageSize,
          total,
          onChange: (p, ps) => {
            setPage(p);
            setPageSize(ps);
          },
          showSizeChanger: true,
          showTotal: (total) => `共 ${total} 条记录`,
        }}
      />
    </Card>
  );
}
