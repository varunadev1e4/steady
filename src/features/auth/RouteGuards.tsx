import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { FullPageSpinner } from '@/components/ui/Spinner';
import { useAuth } from './authContext';

/** Only signed-in users get past this point. */
export function RequireAuth() {
  const { session, loading } = useAuth();
  const location = useLocation();

  if (loading) return <FullPageSpinner label="Opening Steady" />;
  if (!session) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  return <Outlet />;
}

/** Login and sign-up screens send signed-in users straight to the app. */
export function PublicOnly() {
  const { session, loading } = useAuth();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from;

  if (loading) return <FullPageSpinner label="Opening Steady" />;
  if (session) return <Navigate to={from && from.startsWith('/') ? from : '/'} replace />;
  return <Outlet />;
}
