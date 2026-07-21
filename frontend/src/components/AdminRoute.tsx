import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import api, { getToken } from '../services/api';

interface AdminRouteProps {
  children: React.ReactNode;
}

const AdminRoute: React.FC<AdminRouteProps> = ({ children }) => {
  const token = getToken();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    if (!token) {
      setIsAdmin(false);
      setLoading(false);
      return;
    }

    const checkAdmin = async () => {
      try {
        const response = await api.get('/auth/me');
        if (response.data && response.data.is_admin) {
          setIsAdmin(true);
          localStorage.setItem('user', JSON.stringify(response.data));
        } else {
          setIsAdmin(false);
        }
      } catch (err) {
        setIsAdmin(false);
      } finally {
        setLoading(false);
      }
    };

    checkAdmin();
  }, [token]);

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-brand-background flex items-center justify-center text-white">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-brand-accent border-t-transparent rounded-full animate-spin" />
          <span className="text-sm font-semibold text-brand-textMuted">Verifying admin credentials...</span>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

export default AdminRoute;
