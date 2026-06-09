import { useState, useEffect, useRef } from 'react';
import { Badge, Popover, List, Button, Typography, Space, Empty, Spin } from 'antd';
import { BellOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { Notification } from '../types';
import { getNotifications, getUnreadCount, markAsRead, markAllAsRead } from '../api/notificationApi';

const { Text, Paragraph } = Typography;

export default function NotificationPanel() {
  const [open, setOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const navigate = useNavigate();
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const fetchUnreadCount = async () => {
    try {
      const data = await getUnreadCount();
      setUnreadCount(data.count);
    } catch (e) {
      // silently fail
    }
  };

  const fetchNotifications = async (pageNum: number = 1) => {
    setLoading(true);
    try {
      const result = await getNotifications({ page: pageNum, pageSize });
      if (pageNum === 1) {
        setNotifications(result.data);
      } else {
        setNotifications(prev => [...prev, ...result.data]);
      }
      setTotal(result.total);
      setPage(pageNum);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUnreadCount();
    timerRef.current = setInterval(fetchUnreadCount, 30000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (newOpen) {
      setPage(1);
      fetchNotifications(1);
    }
  };

  const handleMarkAsRead = async (id: string) => {
    try {
      await markAsRead(id);
      setNotifications(prev => prev.map(n => 
        n.id === id ? { ...n, isRead: true } : n
      ));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (e) {
      // silently fail
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      const result = await markAllAsRead();
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (e) {
      // silently fail
    }
  };

  const handleClickNotification = (notification: Notification) => {
    if (!notification.isRead) {
      handleMarkAsRead(notification.id);
    }
    if (notification.applicationId) {
      navigate(`/applications/${notification.applicationId}`);
      setOpen(false);
    }
  };

  const handleLoadMore = () => {
    if (notifications.length < total) {
      fetchNotifications(page + 1);
    }
  };

  const formatTime = (timeStr: string) => {
    const date = new Date(timeStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return '刚刚';
    if (minutes < 60) return `${minutes}分钟前`;
    if (hours < 24) return `${hours}小时前`;
    if (days < 7) return `${days}天前`;
    return date.toLocaleDateString('zh-CN');
  };

  const content = (
    <div style={{ width: 360 }}>
      <div style={{ 
        padding: '12px 16px', 
        borderBottom: '1px solid #f0f0f0',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <Text strong>通知消息</Text>
        {unreadCount > 0 && (
          <Button 
            type="link" 
            size="small" 
            icon={<CheckCircleOutlined />}
            onClick={handleMarkAllAsRead}
          >
            全部已读
          </Button>
        )}
      </div>
      <div style={{ maxHeight: 400, overflowY: 'auto' }}>
        {loading && notifications.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center' }}>
            <Spin />
          </div>
        ) : notifications.length === 0 ? (
          <Empty description="暂无通知" style={{ padding: 40 }} />
        ) : (
          <>
            <List
              dataSource={notifications}
              renderItem={(item) => (
                <List.Item
                  key={item.id}
                  onClick={() => handleClickNotification(item)}
                  style={{ 
                    cursor: item.applicationId ? 'pointer' : 'default',
                    padding: '12px 16px',
                    background: item.isRead ? '#fff' : '#f6ffed',
                    borderBottom: '1px solid #f0f0f0',
                  }}
                >
                  <div style={{ width: '100%' }}>
                    <Space direction="vertical" size={4} style={{ width: '100%' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text strong style={{ fontSize: 14 }}>
                          {!item.isRead && (
                            <span style={{ 
                              display: 'inline-block', 
                              width: 8, 
                              height: 8, 
                              borderRadius: '50%', 
                              background: '#ff4d4f',
                              marginRight: 8,
                              verticalAlign: 'middle'
                            }} />
                          )}
                          {item.title}
                        </Text>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          {formatTime(item.createdAt)}
                        </Text>
                      </div>
                      {item.content && (
                        <Paragraph 
                          style={{ margin: 0, fontSize: 13, color: '#666' }}
                          ellipsis={{ rows: 2 }}
                        >
                          {item.content}
                        </Paragraph>
                      )}
                    </Space>
                  </div>
                </List.Item>
              )}
            />
            {notifications.length < total && (
              <div style={{ padding: '12px', textAlign: 'center', borderTop: '1px solid #f0f0f0' }}>
                <Button type="link" onClick={handleLoadMore} loading={loading}>
                  加载更多
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );

  return (
    <Popover
      content={content}
      trigger="click"
      open={open}
      onOpenChange={handleOpenChange}
      placement="bottomRight"
      overlayStyle={{ padding: 0 }}
    >
      <Badge count={unreadCount} size="small" offset={[-2, 2]}>
        <div
          style={{
            cursor: 'pointer',
            padding: '0 8px',
            fontSize: 18,
            color: '#666',
          }}
        >
          <BellOutlined />
        </div>
      </Badge>
    </Popover>
  );
}
