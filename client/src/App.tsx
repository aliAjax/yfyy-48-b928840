import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import MainLayout from './layouts/MainLayout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import MatterListPage from './pages/MatterListPage';
import MatterManagePage from './pages/MatterManagePage';
import ApplicationListPage from './pages/ApplicationListPage';
import ApplicationDetailPage from './pages/ApplicationDetailPage';
import ApplicationEditPage from './pages/ApplicationEditPage';
import ApplicationReviewPage from './pages/ApplicationReviewPage';
import UserManagePage from './pages/UserManagePage';
import LogListPage from './pages/LogListPage';
import { Spin } from 'antd';

function RequireAuth({ children }: { children: JSX.Element }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
}

function RequireRole({ children, roles }: { children: JSX.Element; roles: string[] }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!user || !roles.includes(user.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

function AppRoutes() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/dashboard" replace /> : <LoginPage />} />
      
      <Route path="/" element={
        <RequireAuth>
          <MainLayout />
        </RequireAuth>
      }>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        
        <Route path="matters" element={
          user?.role === 'admin' ? <MatterManagePage /> : <MatterListPage />
        } />
        
        <Route path="my-applications" element={
          <RequireRole roles={['applicant']}>
            <ApplicationListPage />
          </RequireRole>
        } />
        
        <Route path="applications" element={
          <RequireRole roles={['window', 'admin']}>
            <ApplicationListPage showAll />
          </RequireRole>
        } />
        
        <Route path="review-applications" element={
          <RequireRole roles={['reviewer', 'admin']}>
            <ApplicationListPage showAll reviewMode />
          </RequireRole>
        } />
        
        <Route path="applications/:id" element={<ApplicationDetailPage />} />
        <Route path="applications/:id/edit" element={
          <RequireRole roles={['applicant']}>
            <ApplicationEditPage />
          </RequireRole>
        } />
        <Route path="applications/:id/review" element={
          <RequireRole roles={['reviewer', 'admin']}>
            <ApplicationReviewPage />
          </RequireRole>
        } />
        
        <Route path="users" element={
          <RequireRole roles={['admin']}>
            <UserManagePage />
          </RequireRole>
        } />
        
        <Route path="logs" element={
          <RequireRole roles={['admin']}>
            <LogListPage />
          </RequireRole>
        } />
        
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Route>
    </Routes>
  );
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
