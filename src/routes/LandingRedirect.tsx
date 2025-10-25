import { Navigate } from 'react-router-dom';

import { useAuth } from '../context/AuthContext';

export function LandingRedirect() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-100">
        <div className="space-y-2 text-center">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-brand border-t-transparent" />
          <p className="text-sm text-slate-400">Preparing your workspace…</p>
        </div>
      </div>
    );
  }

  return <Navigate to={user ? '/dashboard' : '/auth'} replace />;
}
