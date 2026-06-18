import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import CoachHomePage from './CoachHomePage';
import ClientDashboard from '@/components/dashboards/ClientDashboard';
import GeneralDashboard from '@/components/dashboards/GeneralDashboard';
import { PageLoader } from '@/components/ui/LoadingState';
import { atlasMigrationDataAttributes, deriveHomeRouterRouteState } from '@/lib/atlasMigrationPhases';
import { isCoach, isClient } from '@/lib/roles';

const LOCAL_USER_FALLBACK = { id: 'local-solo', full_name: 'Guest', user_type: 'solo', role: 'solo', email: 'local@atlas' };

export default function Home() {
  const navigate = useNavigate();
  const { user: authUser, isAuthenticated, isLoadingAuth, navigateToLogin } = useAuth();
  const displayUser = authUser || LOCAL_USER_FALLBACK;

  const userType = displayUser?.user_type ?? displayUser?.role;
  const homeMigrationAttrs = useMemo(() => {
    let surface = 'loading';
    if (!isAuthenticated && !isLoadingAuth) surface = 'redirect_login';
    else if (isLoadingAuth && !authUser) surface = 'loading';
    else if (!userType) surface = 'redirect_auth';
    else if (isCoach(userType)) surface = 'coach';
    else if (isClient(userType)) surface = 'client';
    else surface = 'personal';
    const s = deriveHomeRouterRouteState({ surface });
    return atlasMigrationDataAttributes(s.phase, s.primary);
  }, [isAuthenticated, isLoadingAuth, authUser, userType]);

  if (!isAuthenticated && !isLoadingAuth) {
    navigateToLogin();
    return (
      <div className="min-h-screen" {...homeMigrationAttrs}>
        <PageLoader />
      </div>
    );
  }
  if (isLoadingAuth && !authUser) {
    return (
      <div className="min-h-screen" {...homeMigrationAttrs}>
        <PageLoader />
      </div>
    );
  }

  if (!userType) {
    // No role yet – send into canonical auth flow instead of legacy RoleSelection.
    navigate('/auth', { replace: true });
    return (
      <div className="min-h-screen" {...homeMigrationAttrs}>
        <PageLoader />
      </div>
    );
  }
  if (isCoach(userType)) {
    return (
      <div className="min-h-0 w-full flex-1 flex flex-col" {...homeMigrationAttrs}>
        <CoachHomePage />
      </div>
    );
  }
  if (isClient(userType)) {
    return (
      <div className="min-h-0 w-full flex-1 flex flex-col" {...homeMigrationAttrs}>
        <ClientDashboard user={displayUser} />
      </div>
    );
  }
  return (
    <div className="min-h-0 w-full flex-1 flex flex-col" {...homeMigrationAttrs}>
      <GeneralDashboard user={displayUser} />
    </div>
  );
}