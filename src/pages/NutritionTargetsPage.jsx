import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import TopBar from '@/components/ui/TopBar';
import PersonalNutritionTargetsPanel from '@/components/nutrition/PersonalNutritionTargetsPanel';
import { PersonalCanvas, PersonalColumn } from '@/components/personal/PersonalSurface';
import { personalColumnInnerBodyStyle } from '@/lib/personalShellLayout';
import { colors, spacing } from '@/ui/tokens';

export default function NutritionTargetsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  if (!user) {
    return (
      <PersonalCanvas>
        <div style={{ minHeight: '100vh', color: colors.text }}>
          <TopBar title="Nutrition Targets" onBack={() => navigate(-1)} />
          <PersonalColumn variant="default">
            <div style={personalColumnInnerBodyStyle()}>
              <p style={{ color: colors.muted, fontSize: 14 }}>Sign in to set targets.</p>
            </div>
          </PersonalColumn>
        </div>
      </PersonalCanvas>
    );
  }

  return (
    <PersonalCanvas>
      <div style={{ minHeight: '100vh', color: colors.text }}>
        <TopBar title="Nutrition Targets" onBack={() => navigate(-1)} />
        <PersonalColumn variant="default">
          <div style={personalColumnInnerBodyStyle()}>
            <p style={{ margin: 0, fontSize: 14, color: colors.muted, marginBottom: spacing[16] }}>
              Same editor as Nutrition — calories, presets, and macros stay in sync everywhere.
            </p>
            <PersonalNutritionTargetsPanel user={user} variant="full" />
            <button
              type="button"
              onClick={() => navigate('/nutrition')}
              style={{
                width: '100%',
                marginTop: spacing[16],
                padding: spacing[14],
                borderRadius: 12,
                border: `1px solid ${colors.border}`,
                background: 'transparent',
                color: colors.text,
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Back to Nutrition hub
            </button>
          </div>
        </PersonalColumn>
      </div>
    </PersonalCanvas>
  );
}
