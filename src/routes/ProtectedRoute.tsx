import { Navigate } from 'react-router-dom';
import { ReactNode } from 'react';
import { useAuth } from '@/hooks/useAuth';

interface Props {
  children: ReactNode;
  requiredPermission?: string;
}

export function ProtectedRoute({ children, requiredPermission }: Props) {
  const { session, profile, loading, hasPermission } = useAuth();

  if (loading) {
    return <div className="page-loading">Cargando…</div>;
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  if (profile && !profile.active) {
    return <div className="page-loading">Tu usuario está inactivo. Contacta al administrador.</div>;
  }

  if (requiredPermission && !hasPermission(requiredPermission)) {
    return <div className="page-loading">No tienes permiso para acceder a esta sección.</div>;
  }

  return <>{children}</>;
}
