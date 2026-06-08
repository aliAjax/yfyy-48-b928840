import { useState } from 'react';
import { Form, Input, Button, Card, Tabs, Typography, message } from 'antd';
import { UserOutlined, LockOutlined, PhoneOutlined, IdcardOutlined } from '@ant-design/icons';
import { useAuth } from '../context/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';

const { Title, Text } = Typography;

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as any)?.from?.pathname || '/';

  const handleLogin = async (values: any) => {
    setLoading(true);
    try {
      const success = await login(values.username, values.password);
      if (success) {
        navigate(from, { replace: true });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (values: any) => {
    if (values.password !== values.confirmPassword) {
      message.error('两次输入的密码不一致');
      return;
    }
    setLoading(true);
    try {
      const success = await register({
        username: values.username,
        password: values.password,
        name: values.name,
        phone: values.phone,
        idCard: values.idCard,
      });
      if (success) {
        navigate(from, { replace: true });
      }
    } finally {
      setLoading(false);
    }
  };

  const loginItems = [
    {
      key: 'login',
      label: '登录',
      children: (
        <Form
          name="login"
          initialValues={{ remember: true }}
          onFinish={handleLogin}
          size="large"
        >
          <Form.Item
            name="username"
            rules={[{ required: true, message: '请输入用户名' }]}
          >
            <Input prefix={<UserOutlined />} placeholder="用户名" />
          </Form.Item>
          <Form.Item
            name="password"
            rules={[{ required: true, message: '请输入密码' }]}
          >
            <Input.Password prefix={<LockOutlined />} placeholder="密码" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" block loading={loading}>
              登录
            </Button>
          </Form.Item>
          <Text type="secondary" style={{ fontSize: 12 }}>
            测试账号：admin/admin123，window1/123456，reviewer1/123456，applicant1/123456
          </Text>
        </Form>
      ),
    },
    {
      key: 'register',
      label: '注册',
      children: (
        <Form
          name="register"
          onFinish={handleRegister}
          size="large"
        >
          <Form.Item
            name="username"
            rules={[
              { required: true, message: '请输入用户名' },
              { min: 4, message: '用户名至少4位' },
            ]}
          >
            <Input prefix={<UserOutlined />} placeholder="用户名（至少4位）" />
          </Form.Item>
          <Form.Item
            name="name"
            rules={[{ required: true, message: '请输入姓名' }]}
          >
            <Input placeholder="真实姓名" />
          </Form.Item>
          <Form.Item
            name="password"
            rules={[
              { required: true, message: '请输入密码' },
              { min: 6, message: '密码至少6位' },
            ]}
          >
            <Input.Password prefix={<LockOutlined />} placeholder="密码（至少6位）" />
          </Form.Item>
          <Form.Item
            name="confirmPassword"
            rules={[{ required: true, message: '请确认密码' }]}
          >
            <Input.Password prefix={<LockOutlined />} placeholder="确认密码" />
          </Form.Item>
          <Form.Item name="phone">
            <Input prefix={<PhoneOutlined />} placeholder="手机号（选填）" />
          </Form.Item>
          <Form.Item name="idCard">
            <Input prefix={<IdcardOutlined />} placeholder="身份证号（选填）" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" block loading={loading}>
              注册
            </Button>
          </Form.Item>
        </Form>
      ),
    },
  ];

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      padding: 20,
    }}>
      <Card style={{ width: 420, boxShadow: '0 8px 32px rgba(0,0,0,0.1)' }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <Typography.Title level={3} style={{ marginBottom: 8 }}>
            行政审批事项办理系统
          </Typography.Title>
          <Text type="secondary">高效便捷的在线审批服务平台</Text>
        </div>
        <Tabs items={loginItems} centered />
      </Card>
    </div>
  );
}
