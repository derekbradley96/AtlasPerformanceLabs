import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import TrainerDashboard from '@/components/dashboards/TrainerDashboard';
import ClientDashboard from '@/components/dashboards/ClientDashboard';
import GeneralDashboard from '@/components/dashboards/GeneralDashboard';
import { PageLoader } from '@/components/ui/LoadingState';

const isDev = import.meta.env.DEV;

const LOCAL_USER_FALLBACK = { id: 'local-solo', full_name: 'Guest', user_type: 'solo', role: 'solo', email: 'local@atlas' };

export default function Home() {
  const navigate = useNavigate();
  const { user: authUser, isAuthenticated, isLoadingAuth, navigateToLogin } = useAuth();
  const displayUser = authUser || LOCAL_USER_FALLBACK;

  if (!isAuthenticated && !isLoadingAuth) {
    navigateToLogin();
    return <PageLoader />;
  }
  if (isLoadingAuth && !authUser) return <PageLoader />;

  const userType = displayUser?.user_type ?? displayUser?.role;
  if (!userType) {
    // No role yet – send into canonical auth flow instead of legacy RoleSelection.
    navigate('/auth', { replace: true });
    return <PageLoader />;
  }
  if (userType === 'coach' || userType === 'trainer') {
    return <TrainerDashboard user={displayUser} />;
  }
  if (userType === 'client') {
    return <ClientDashboard user={displayUser} />;
  }
  return <GeneralDashboard user={displayUser} />;
}