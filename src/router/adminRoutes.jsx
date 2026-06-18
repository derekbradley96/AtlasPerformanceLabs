import React from 'react';
import { Route } from 'react-router-dom';
import { RequireAuth, AdminGate, InternalOnlyRoute } from '@/components/auth/routeGuards';

export default function AdminRoutes({
  scope = 'topLevel',
  AdminDevPanelGate,
  AdminDevPanel,
  AdminLayout,
  AdminDashboardPage,
  AdminUsersPage,
  AdminUserLookupPage,
  AdminCoachesPage,
  AdminFeedbackPage,
  AdminMetricsPage,
  GrowthDashboardPage,
  NavigationAudit,
  BetaFeedbackInboxGate,
  BetaFeedbackInboxPage,
  BetaHealthDashboardGate,
  BetaHealthDashboard,
}) {
  if (scope === 'app') {
    return (
      <>
        <Route path="beta-feedback-inbox" element={<RequireAuth><BetaFeedbackInboxGate Component={BetaFeedbackInboxPage} /></RequireAuth>} />
        <Route path="beta-health-dashboard" element={<RequireAuth><BetaHealthDashboardGate Component={BetaHealthDashboard} /></RequireAuth>} />
      </>
    );
  }

  return (
    <>
      <Route path="/admin-dev-panel" element={<AdminDevPanelGate Component={AdminDevPanel} />} />
      <Route path="admin" element={<RequireAuth><AdminGate /></RequireAuth>}>
        <Route element={<AdminLayout />}>
          <Route index element={<AdminDashboardPage />} />
          <Route path="users" element={<AdminUsersPage />} />
          <Route path="lookup" element={<AdminUserLookupPage />} />
          <Route path="coaches" element={<AdminCoachesPage />} />
          <Route path="feedback" element={<AdminFeedbackPage />} />
          <Route path="metrics" element={<AdminMetricsPage />} />
          <Route path="growth" element={<GrowthDashboardPage />} />
        </Route>
      </Route>
      <Route path="/navigation-audit" element={<InternalOnlyRoute><NavigationAudit /></InternalOnlyRoute>} />
    </>
  );
}
