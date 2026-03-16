import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { isPersonal } from '@/lib/roles';
import { getClientByUserId } from '@/data/selectors';
import { getAchievementsList } from '@/lib/milestonesStore';
import Card from '@/ui/Card';
import { colors, spacing } from '@/ui/tokens';
import { Trophy } from 'lucide-react';

function formatDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function Achievements() {
  const navigate = useNavigate();
  const { user: authUser, effectiveRole, role, isDemoMode } = useAuth();
  const userId = authUser?.id;
  const clientForUser = userId ? getClientByUserId(userId) : null;
  const byUser = true;
  const achievements = userId ? getAchievementsList(userId, { byUser }) : [];
  const showFindCoach = isPersonal(effectiveRole ?? role);

  return (
    <div
      className="app-screen min-w-0 max-w-full overflow-x-hidden"
      style={{
        paddingBottom: `calc(${spacing[16]} + env(safe-area-inset-bottom, 0px))`,
      }}
    >
      {achievements.length === 0 ? (
        <Card style={{ padding: spacing[32], textAlign: 'center' }}>
          <Trophy size={48} style={{ color: colors.muted, margin: '0 auto 16px' }} />
          <p className="text-[15px] font-medium" style={{ color: colors.text }}>No achievements yet</p>
          <p className="text-sm mt-2" style={{ color: colors.muted }}>
            Complete check-ins and hit goals to unlock achievements.
          </p>
          {showFindCoach && (
            <p className="text-sm mt-4" style={{ color: colors.muted }}>
              Want a program built for you?{' '}
              <button type="button" onClick={() => navigate('/discover')} style={{ background: 'none', border: 'none', padding: 0, color: colors.primary, fontWeight: 500, cursor: 'pointer', textDecoration: 'underline' }}>
                Find a coach
              </button>
            </p>
          )}
        </Card>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing[12] }}>
          {achievements.map((a) => (
            <Card key={a.id} style={{ padding: spacing[16] }}>
              <div className="flex items-start gap-3">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ background: 'rgba(234,179,8,0.2)', color: '#EAB308' }}
                >
                  <Trophy size={20} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-semibold" style={{ color: colors.text }}>{a.title}</p>
                  {a.description && (
                    <p className="text-sm mt-0.5" style={{ color: colors.muted }}>{a.description}</p>
                  )}
                  <p className="text-xs mt-2" style={{ color: colors.muted }}>{formatDate(a.unlockedAt)}</p>
                </div>
              </div>
            </Card>
          ))}
          {showFindCoach && (
            <p className="text-sm text-center mt-4" style={{ color: colors.muted }}>
              Want to level up with a coach?{' '}
              <button type="button" onClick={() => navigate('/discover')} style={{ background: 'none', border: 'none', padding: 0, color: colors.primary, fontWeight: 500, cursor: 'pointer', textDecoration: 'underline' }}>
                Find a coach
              </button>
            </p>
          )}
        </div>
      )}
    </div>
  );
}
