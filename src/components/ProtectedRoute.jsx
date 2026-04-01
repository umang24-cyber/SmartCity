import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute({ allowedRoles }) {
  const { user, loading } = useAuth();

  if (loading) return <div style={{ color: 'var(--accent-cyan)', padding: '20px' }}>[SYSTEM] Authenticating...</div>;

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    // If logged in but wrong role, maybe go to their own dashboard or a fallback
    if (user.role === 'user' || user.role === 'citizen') return <Navigate to="/user-dashboard" replace />;
    if (user.role === 'supervisor') return <Navigate to="/supervisor" replace />;
    if (user.role === 'officer') return <Navigate to="/officer" replace />;
    return <Navigate to="/login" replace />;
  }

  // Render children
  return <Outlet />;
}
