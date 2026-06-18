import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import TopBar from '@/components/ui/TopBar';
import Button from '@/ui/Button';
import { colors, spacing, touchTargetMin } from '@/ui/tokens';
import { FileText, Layers } from 'lucide-react';

export default function PersonalPlanBuilderPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [showWelcomeBanner, setShowWelcomeBanner] = useState(() => {
    if (searchParams.get('source') !== 'onboarding') return false;
    try {
      return !localStorage.getItem('atlas_personal_onboarding_plan_banner_seen');
    } catch {
      return true;
    }
  });

  const dismissWelcomeBanner = () => {
    setShowWelcomeBanner(false);
    try {
      localStorage.setItem('atlas_personal_onboarding_plan_banner_seen', '1');
    } catch {}
  };

  const cardBtn = (selected) => ({
    width: '100%',
    textAlign: 'left',
    borderRadius: 16,
    border: `2px solid ${selected ? colors.primary : colors.border}`,
    background: selected ? colors.primarySubtle : colors.surface1,
    color: colors.text,
    padding: spacing[16],
    minHeight: 120,
    cursor: 'pointer',
  });

  return (
    <div className="min-h-screen" style={{ background: colors.bg, color: colors.text }}>
      <TopBar title="Build your programme" onBack={() => navigate(-1)} />
      <div style={{ padding: spacing[16], maxWidth: 720, margin: '0 auto', display: 'grid', gap: spacing[16] }}>
        {showWelcomeBanner && (
          <div
            style={{
              margin: '0 0 16px',
              padding: '12px 16px',
              background: 'rgba(59,130,246,0.12)',
              borderRadius: 10,
              border: '1px solid rgba(59,130,246,0.25)',
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              gap: 12,
            }}
          >
            <div>
              <p style={{ margin: '0 0 2px', fontSize: 14, fontWeight: 600, color: '#93c5fd' }}>Your programme is ready</p>
              <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>Pick a day and tap Start workout to log your first session.</p>
            </div>
            <button
              type="button"
              onClick={dismissWelcomeBanner}
              style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: 0, flexShrink: 0 }}
            >
              ×
            </button>
          </div>
        )}
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>Build your programme</h1>
          <p style={{ margin: `${spacing[8]}px 0 0`, fontSize: 14, color: colors.muted, lineHeight: 1.5 }}>
            Create your training plan manually. You decide the exercises, sets, and reps.
          </p>
        </div>

        <button type="button" style={cardBtn(true)} onClick={() => navigate('/programs/new')}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: spacing[12] }}>
            <FileText size={28} style={{ color: colors.primary, flexShrink: 0 }} />
            <div>
              <p style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>Build from scratch</p>
              <p style={{ margin: `${spacing[6]}px 0 0`, fontSize: 13, color: colors.muted, lineHeight: 1.45 }}>
                Choose your own exercises, set your own targets. Full control.
              </p>
              <div style={{ marginTop: spacing[12] }}>
                <Button type="button" variant="primary" onClick={(e) => { e.stopPropagation(); navigate('/programs/new'); }} style={{ minHeight: touchTargetMin }}>
                  Start building →
                </Button>
              </div>
            </div>
          </div>
        </button>

        <button type="button" style={cardBtn(false)} onClick={() => navigate('/programs/templates')}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: spacing[12] }}>
            <Layers size={28} style={{ color: colors.primary, flexShrink: 0 }} />
            <div>
              <p style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>Start from a template</p>
              <p style={{ margin: `${spacing[6]}px 0 0`, fontSize: 13, color: colors.muted, lineHeight: 1.45 }}>
                Pick a proven programme structure — push/pull/legs, upper/lower, full body. You customise from there.
              </p>
              <div style={{ marginTop: spacing[12] }}>
                <Button type="button" variant="secondary" onClick={(e) => { e.stopPropagation(); navigate('/programs/templates'); }} style={{ minHeight: touchTargetMin }}>
                  Browse templates →
                </Button>
              </div>
            </div>
          </div>
        </button>

        <p style={{ margin: 0, fontSize: 12, color: colors.muted, lineHeight: 1.5, textAlign: 'center' }}>
          Atlas builds the framework — you fill in the exercises and weights you want to use.
        </p>
      </div>
    </div>
  );
}
