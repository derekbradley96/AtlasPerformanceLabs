/**
 * Competition coach Prep tab: timeline (default) + Peak week dashboard.
 */
import React from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import TopBar from '@/components/ui/TopBar';
import { colors } from '@/ui/tokens';
import { pageContainer } from '@/ui/pageLayout';
import CoachPrepTimelineBoard from '@/pages/CoachPrepTimelineBoard';
import CoachPeakWeekDashboard from '@/pages/CoachPeakWeekDashboard';
import { Button } from '@/components/ui/button';
import { hapticLight } from '@/lib/haptics';

function getCoachFocus(profile, coachFocusFromAuth) {
  const raw = (coachFocusFromAuth ?? profile?.coach_focus ?? 'transformation').toString().trim().toLowerCase();
  return raw || 'transformation';
}

export default function CoachPrepHubPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { profile, coachFocus: coachFocusFromAuth } = useAuth();
  const coachFocus = getCoachFocus(profile, coachFocusFromAuth);
  const tab = searchParams.get('tab') === 'peak' ? 'peak' : 'timeline';
  const syncUrl = (next) => {
    setSearchParams(next === 'timeline' ? {} : { tab: 'peak' }, { replace: true });
  };

  const isCompetition = coachFocus === 'competition' || coachFocus === 'integrated';

  if (!isCompetition) {
    return (
      <div className="min-h-screen" style={{ background: colors.bg, color: colors.text }}>
        <TopBar title="Prep" onBack={() => navigate(-1)} />
        <div className="p-4 max-w-lg mx-auto" style={pageContainer}>
          <p className="text-sm" style={{ color: colors.muted }}>
            Prep hub is for competition or integrated coaches.
          </p>
          <Button variant="outline" className="mt-4" onClick={() => navigate('/prep-dashboard/roster')}>
            Open prep roster
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: colors.bg, color: colors.text }}>
      <TopBar title="Prep" onBack={() => navigate(-1)} />
      <div className="max-w-lg mx-auto px-4 pt-2" style={pageContainer}>
        <div className="flex rounded-lg p-1 mb-4" style={{ background: colors.surface2, border: `1px solid ${colors.border}` }}>
          <button
            type="button"
            className="flex-1 py-2 text-sm font-semibold rounded-md transition-colors"
            style={{
              background: tab === 'timeline' ? colors.surface : 'transparent',
              color: tab === 'timeline' ? colors.text : colors.muted,
            }}
            onClick={() => { hapticLight(); syncUrl('timeline'); }}
          >
            Timeline
          </button>
          <button
            type="button"
            className="flex-1 py-2 text-sm font-semibold rounded-md transition-colors"
            style={{
              background: tab === 'peak' ? colors.surface : 'transparent',
              color: tab === 'peak' ? colors.text : colors.muted,
            }}
            onClick={() => { hapticLight(); syncUrl('peak'); }}
          >
            Peak week
          </button>
        </div>
        <div className="flex justify-end mb-2">
          <button
            type="button"
            className="text-xs font-medium underline"
            style={{ color: colors.primary }}
            onClick={() => { hapticLight(); navigate('/prep-dashboard/roster'); }}
          >
            Full prep roster
          </button>
        </div>
      </div>
      {tab === 'timeline' ? (
        <CoachPrepTimelineBoard embedded />
      ) : (
        <CoachPeakWeekDashboard embedded />
      )}
    </div>
  );
}
