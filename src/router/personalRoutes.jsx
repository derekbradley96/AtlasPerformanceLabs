import React from 'react';
import { Navigate, Route, useParams } from 'react-router-dom';
import RequireRole from '@/components/auth/RequireRole';
import { Roles } from '@/lib/roles';
import PrepComparisonPage from '@/pages/PrepComparisonPage';

function PersonalCoachSlugRedirect() {
  const { slug } = useParams();
  return <Navigate to={`/coach/${encodeURIComponent(slug || '')}`} replace />;
}

export default function PersonalRoutes({
  PersonalMyProgram,
  PersonalCoachTransitionPage,
  PersonalCoachTierSelectionPage,
  NutritionTargetsPage,
  PersonalInsightsPage,
  PersonalPlanBuilderPage,
  ImportMFPPage,
  ProgressPage,
  WorkoutPlayerRedirect,
}) {
  return (
    <>
      {/* Shared route: appears in both client and personal
          role blocks. Each is independently role-gated.
          This is intentional — not a duplicate bug. */}
      <Route path="workout" element={<RequireRole allow={[Roles.PERSONAL, Roles.ADMIN]} accessDeniedMessage="This page is for Personal accounts."><WorkoutPlayerRedirect /></RequireRole>} />
      {/* Shared route: appears in both client and personal
          role blocks. Each is independently role-gated.
          This is intentional — not a duplicate bug. */}
      <Route path="progress" element={<RequireRole allow={[Roles.PERSONAL, Roles.ADMIN]} accessDeniedMessage="This page is for Personal accounts."><ProgressPage /></RequireRole>} />
      <Route path="marketplace" element={<RequireRole allow={[Roles.PERSONAL, Roles.ADMIN]} accessDeniedMessage="This page is for Personal accounts."><Navigate to="/discover" replace /></RequireRole>} />
      <Route path="coach/:slug" element={<RequireRole allow={[Roles.PERSONAL, Roles.ADMIN]} accessDeniedMessage="This page is for Personal accounts."><PersonalCoachSlugRedirect /></RequireRole>} />
      <Route path="personal-my-program" element={<Navigate to="/myprogram" replace />} />
      <Route path="programme" element={<Navigate to="/myprogram" replace />} />
      <Route path="personal/coach-transition" element={<RequireRole allow={[Roles.PERSONAL, Roles.ADMIN]} accessDeniedMessage="This guide is for Personal accounts."><PersonalCoachTransitionPage /></RequireRole>} />
      <Route path="personal/coach-tier-selection" element={<RequireRole allow={[Roles.PERSONAL, Roles.ADMIN]} accessDeniedMessage="This guide is for Personal accounts."><PersonalCoachTierSelectionPage /></RequireRole>} />
      <Route path="nutrition-targets" element={<RequireRole allow={[Roles.PERSONAL, Roles.ADMIN]} accessDeniedMessage="Nutrition targets are for Personal accounts."><NutritionTargetsPage /></RequireRole>} />
      <Route path="athlete" element={<RequireRole allow={[Roles.PERSONAL]}><Navigate to="/home" replace /></RequireRole>} />
      <Route path="solo-dashboard" element={<RequireRole allow={[Roles.PERSONAL]}><Navigate to="/home" replace /></RequireRole>} />
      <Route path="personal/insights" element={<RequireRole allow={[Roles.PERSONAL]}><PersonalInsightsPage /></RequireRole>} />
      <Route path="personal-plan-builder" element={<RequireRole allow={[Roles.PERSONAL, Roles.ADMIN]} accessDeniedMessage="This page is for Personal accounts."><PersonalPlanBuilderPage /></RequireRole>} />
      <Route
        path="programs/new"
        element={<RequireRole allow={[Roles.PERSONAL, Roles.ADMIN]}><Navigate to="/program-builder?personal=1&scratch=1" replace /></RequireRole>}
      />
      <Route
        path="programs/templates"
        element={<RequireRole allow={[Roles.PERSONAL, Roles.ADMIN]}><Navigate to="/program-builder?personal=1&templates=1" replace /></RequireRole>}
      />
      <Route path="import/mfp" element={<RequireRole allow={[Roles.PERSONAL, Roles.ADMIN]} accessDeniedMessage="MFP import is for Personal accounts."><ImportMFPPage /></RequireRole>} />
      <Route path="prep-comparison" element={<RequireRole allow={[Roles.PERSONAL, Roles.ADMIN]} accessDeniedMessage="Photo comparison is for Personal accounts."><PrepComparisonPage /></RequireRole>} />
    </>
  );
}
