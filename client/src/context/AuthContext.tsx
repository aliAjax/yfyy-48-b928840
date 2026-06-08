import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User } from '../types';
import { getUserFromStorage, setUserToStorage, clearStorage } from '../utils/common';
import { login as loginApi, register as registerApi, getCurrentUser } from '../api/userApi';
import { message } from 'antd';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<boolean>;
  register: (data: any) => Promise<boolean>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const savedUser = getUserFromStorage();
    if (savedUser) {
      setUser(savedUser);
      loadCurrentUser();
    } else {
      setLoading(false);
    }
  }, []);

  const loadCurrentUser = async () => {
    try {
      const res = await getCurrentUser();
      if (res.success && res.data) {
        setUser(res.data);
        const token = localStorage.getItem('token') || '';
        setUserToStorage(res.data, token);
      } else {
        clearStorage();
        setUser(null);
      }
    } catch {
      clearStorage();
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const login = async (username: string, password: string): Promise<boolean> => {
    try {
      const res = await loginApi({ username, password });
      if (res.success && res.data) {
        setUser(res.data.user);
        setUserToStorage(res.data.user, res.data.token);
        message.success('登录成功');
        return true;
      } else {
        message.error(res.message || '登录失败');
        return false;
      }
    } catch {
      return false;
    }
  };

  const register = async (data: any): Promise<boolean> => {
    try {
      const res = await registerApi(data);
      if (res.success && res.data) {
        setUser(res.data.user);
        setUserToStorage(res.data.user, res.data.token);
        message.success('注册成功');
        return true;
      } else {
        message.error(res.message || '注册失败');
        return false;
      }
    } catch {
      return false;
    }
  };

  const logout = () => {
    clearStorage();
    setUser(null);
    message.success('已退出登录');
  };

  const refreshUser = async () => {
    await loadCurrentUser();
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
