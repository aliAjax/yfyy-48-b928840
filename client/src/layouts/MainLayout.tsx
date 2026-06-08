import { useState } from 'react';
import { Layout, Menu, Avatar, Dropdown, Space, Typography } from 'antd';
import {
  DashboardOutlined,
  FileTextOutlined,
  AppstoreOutlined,
  UserOutlined,
  LogoutOutlined,
  SettingOutlined,
  HistoryOutlined,
  AuditOutlined,
  TeamOutlined,
  SolutionOutlined,
} from '@ant-design/icons';
import { useAuth } from '../context/AuthContext';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import { roleLabels } from '../utils/common';

const { Header, Sider, Content } = Layout;
const { Text } = Typography;

export default function MainLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const getMenuItems = () => {
    const items: any[] = [];

    items.push({
      key: '/dashboard',
      icon: <DashboardOutlined />,
      label: '工作台',
    });

    items.push({
      key: '/guide',
      icon: <SolutionOutlined />,
      label: '办事指南',
    });

    if (user?.role === 'applicant') {
      items.push({
        key: '/matters',
        icon: <AppstoreOutlined />,
        label: '办事大厅',
      });
      items.push({
        key: '/my-applications',
        icon: <FileTextOutlined />,
        label: '我的申请',
      });
    }

    if (user?.role === 'window') {
      items.push({
        key: '/applications',
        icon: <FileTextOutlined />,
        label: '申请管理',
      });
    }

    if (user?.role === 'reviewer') {
      items.push({
        key: '/review-applications',
        icon: <AuditOutlined />,
        label: '待审核申请',
      });
    }

    if (user?.role === 'admin') {
      items.push({
        key: '/matters',
        icon: <AppstoreOutlined />,
        label: '事项管理',
      });
      items.push({
        key: '/applications',
        icon: <FileTextOutlined />,
        label: '申请管理',
      });
      items.push({
        key: '/users',
        icon: <TeamOutlined />,
        label: '用户管理',
      });
      items.push({
        key: '/logs',
        icon: <HistoryOutlined />,
        label: '操作日志',
      });
    }

    return items;
  };

  const handleMenuClick = ({ key }: { key: string }) => {
    navigate(key);
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const userMenu = {
    items: [
      {
        key: 'profile',
        icon: <UserOutlined />,
        label: `${user?.name} (${roleLabels[user?.role || 'applicant']})`,
        disabled: true,
      },
      { type: 'divider' as const },
      {
        key: 'logout',
        icon: <LogoutOutlined />,
        label: '退出登录',
        onClick: handleLogout,
      },
    ],
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        theme="dark"
      >
        <div style={{
          height: 64,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          fontSize: collapsed ? 12 : 18,
          fontWeight: 'bold',
          background: 'rgba(255,255,255,0.1)',
        }}>
          {collapsed ? '审批' : '行政审批系统'}
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[location.pathname]}
          items={getMenuItems()}
          onClick={handleMenuClick}
        />
      </Sider>
      <Layout>
        <Header style={{
          background: '#fff',
          padding: '0 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
        }}>
          <Text strong style={{ fontSize: 16 }}>
            行政审批事项办理系统
          </Text>
          <Dropdown menu={userMenu} placement="bottomRight">
            <Space style={{ cursor: 'pointer' }}>
              <Avatar icon={<UserOutlined />} />
              <span>{user?.name}</span>
            </Space>
          </Dropdown>
        </Header>
        <Content style={{ margin: '24px', padding: 24, background: '#fff', borderRadius: 8, minHeight: 'calc(100vh - 112px)' }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
