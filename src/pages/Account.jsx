import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { PageLoader } from '@/components/ui/LoadingState';
import { UserCircle, Mail, Award, MessageSquare, HelpCircle } from 'lucide-react';
import { getRouteTitle } from '@/lib/routeMeta';
import { useFeedbackModal } from '@/contexts/FeedbackContext';
import { createPageUrl } from '@/utils';
import Row from '@/ui/Row';
import { colors, spacing, touchTargetMin } from '@/ui/tokens';
import { pageContainer, standardCard } from '@/ui/pageLayout';
import { impactLight } from '@/lib/haptics';
import { toast } from 'sonner';
import { COACH_FOCUS_OPTIONS, coachFocusLabel } from '@/lib/data/coachTypeHelpers';

/**
 * Account hub: iOS list style. No in-page header (AppShell provides back + title).
 * Edit Profile and other account settings linked from here.
 * Coach focus is the single source of truth (transformation | competition | integrated).
 */
export default function Account() {
  const navigate = useNavigate();
  const location = useLocation();
  const { openFeedback, openSupport } = useFeedbackModal();
  const { user: authUser, role, profile, coachFocus, updateProfile, isDemoMode, isLoadingAuth, supabaseUser } = useAuth();
  const displayUser = authUser;
  const [updatingFocus, setUpdatingFocus] = useState(false);

  const displayFocus = (profile?.coach_focus ?? coachFocus ?? 'transformation').toLowerCase();
  const effectiveFocus = ['transformation', 'competition', 'integrated'].includes(displayFocus) ? displayFocus : 'transformation';
  const canUpdateProfile = !!supabaseUser?.id && typeof updateProfile === 'function';

  const handleCoachFocusChange = async (focus) => {
    if (!canUpdateProfile || focus === effectiveFocus) return;
    impactLight();
    setUpdatingFocus(true);
    try {
      const result = await updateProfile({ coach_focus: focus });
      if (result?.error) {
        toast.error(result.error.message || 'Could not update coaching focus');
        return;
      }
      toast.success('Coaching focus updated');
    } finally {
      setUpdatingFocus(false);
    }
  };

  if (!isDemoMode && isLoadingAuth) return <PageLoader />;

  return (
    <div className="app-screen min-w-0 max-w-full overflow-x-hidden" style={pageContainer}>
      <div className="overflow-hidden" style={standardCard}>
        <Row
          left={<UserCircle size={20} style={{ color: colors.muted }} />}
          title="Edit Profile"
          showChevron={true}
          onPress={() => navigate(createPageUrl('EditProfile'))}
        />
        <Row
          left={<MessageSquare size={20} style={{ color: colors.muted }} />}
          title="Send feedback"
          showChevron={true}
          onPress={() => { impactLight(); openFeedback(getRouteTitle(location.pathname)); }}
        />
        <Row
          left={<HelpCircle size={20} style={{ color: colors.muted }} />}
          title="Get help"
          showChevron={true}
          onPress={() => { impactLight(); openSupport(); }}
        />
        {displayUser?.email && (
          <div
            className="flex items-center gap-3 w-full"
            style={{
              minHeight: 68,
              paddingLeft: 16,
              paddingRight: 16,
              borderBottom: `1px solid ${colors.border}`,
            }}
          >
            <Mail size={20} style={{ color: colors.muted }} />
            <div className="flex-1 min-w-0">
              <p className="text-xs" style={{ color: colors.muted }}>Email</p>
              <p className="text-[15px] font-medium truncate" style={{ color: colors.text }}>{displayUser.email}</p>
            </div>
          </div>
        )}

        {role === 'trainer' && (
          <div
            style={{
              padding: spacing[16],
              borderBottom: `1px solid ${colors.border}`,
            }}
          >
            <div className="flex items-center justify-between gap-3 mb-3">
              <div className="flex items-center gap-3">
                <Award size={20} style={{ color: colors.muted }} />
                <p className="text-xs font-medium" style={{ color: colors.muted }}>Coaching focus</p>
              </div>
              <p className="text-sm font-medium" style={{ color: colors.text }}>{coachFocusLabel(effectiveFocus)}</p>
            </div>
            <div
              className="flex rounded-xl overflow-hidden"
              style={{ background: 'rgba(255,255,255,0.06)', border: `1px solid ${colors.border}` }}
            >
              {COACH_FOCUS_OPTIONS.map(({ focus, label }) => (
                <button
                  key={focus}
                  type="button"
                  disabled={updatingFocus || !canUpdateProfile}
                  aria-label={label}
                  aria-pressed={effectiveFocus === focus}
                  onClick={() => handleCoachFocusChange(focus)}
                  className="flex-1 py-3 text-sm font-medium transition-colors duration-200 disabled:opacity-60"
                  style={{
                    minHeight: touchTargetMin,
                    background: effectiveFocus === focus ? 'rgba(37, 99, 235, 0.2)' : 'transparent',
                    color: effectiveFocus === focus ? colors.accent : colors.muted,
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
