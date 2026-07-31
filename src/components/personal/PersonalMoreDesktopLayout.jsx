import React, { useState, useCallback, useEffect } from 'react';
import {
  User,
  UserCircle,
  Settings,
  Bell,
  HelpCircle,
  UtensilsCrossed,
  Trophy,
  Target,
  Users,
  ChevronRight,
} from 'lucide-react';
import Card from '@/ui/Card';
import { colors, spacing, radii, shell, touchTargetMin } from '@/ui/tokens';

const SIDEBAR_WIDTH = 240;

const NAV_GROUPS = [
  {
    items: [
      { id: 'profile', label: 'Profile', Icon: User },
      { id: 'account', label: 'Account', Icon: Settings },
      { id: 'training', label: 'Training', Icon: Target },
      { id: 'nutrition', label: 'Nutrition', Icon: UtensilsCrossed },
      { id: 'achievements', label: 'Achievements', Icon: Trophy },
    ],
  },
  { divider: true },
  {
    items: [
      { id: 'coaching', label: 'Coaching', Icon: Users },
      { id: 'support', label: 'Support', Icon: HelpCircle },
    ],
  },
];

function scrollToSection(id) {
  const el = document.getElementById(`more-desktop-${id}`);
  el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function SettingsCard({ title, description, onClick, icon: Icon }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group text-left rounded-2xl border transition-all duration-150 w-full"
      style={{
        padding: spacing[20],
        borderColor: colors.border,
        background: colors.surface1,
        color: colors.text,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = '0 8px 28px rgba(0,0,0,0.22)';
        e.currentTarget.style.transform = 'translateY(-1px)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = 'none';
        e.currentTarget.style.transform = 'none';
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            {Icon ? <Icon size={18} style={{ color: colors.primary, flexShrink: 0 }} aria-hidden /> : null}
            <span className="font-semibold text-[15px]" style={{ color: colors.text }}>
              {title}
            </span>
          </div>
          <p className="text-sm leading-snug" style={{ color: colors.muted }}>
            {description}
          </p>
        </div>
        <ChevronRight size={20} className="shrink-0 opacity-50 group-hover:opacity-90 transition-opacity" style={{ color: colors.muted }} />
      </div>
    </button>
  );
}

function SectionTitle({ children }) {
  return (
    <h2 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: colors.muted, letterSpacing: '0.08em' }}>
      {children}
    </h2>
  );
}

/**
 * Personal More — desktop website shell: sticky sidebar + sectioned content.
 */
export default function PersonalMoreDesktopLayout({
  displayUser,
  profile,
  trainerProfile,
  previewIdentityLine,
  previewModeActive,
  navigate,
  onLogout,
}) {
  const [activeNav, setActiveNav] = useState('profile');

  const handleNav = useCallback((id) => {
    setActiveNav(id);
    scrollToSection(id);
  }, []);

  useEffect(() => {
    const ids = ['profile', 'account', 'training', 'nutrition', 'achievements', 'coaching', 'support'];
    const els = ids.map((id) => document.getElementById(`more-desktop-${id}`)).filter(Boolean);
    if (!els.length) return undefined;
    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible[0]?.target?.id) {
          const raw = visible[0].target.id.replace('more-desktop-', '');
          if (ids.includes(raw)) setActiveNav(raw);
        }
      },
      { rootMargin: '-20% 0px -55% 0px', threshold: [0, 0.25, 0.5] }
    );
    els.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, []);

  const email = displayUser?.email ?? displayUser?.user_metadata?.email ?? '';
  const name =
    profile?.full_name ||
    profile?.display_name ||
    displayUser?.full_name ||
    displayUser?.name ||
    displayUser?.user_metadata?.full_name ||
    'Your name';
  const initials = name.slice(0, 2).toUpperCase();
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: spacing[24],
        maxWidth: 1100,
        marginLeft: 'auto',
        marginRight: 'auto',
        width: '100%',
      }}
    >
      {/* Sidebar */}
      <nav
        aria-label="Account sections"
        style={{
          width: SIDEBAR_WIDTH,
          flexShrink: 0,
          position: 'sticky',
          top: spacing[16],
          alignSelf: 'flex-start',
        }}
      >
        <p className="text-[11px] font-bold uppercase tracking-wider px-2 mb-3" style={{ color: colors.muted }}>
          More
        </p>
        {NAV_GROUPS.map((group, gi) => (
          <React.Fragment key={gi}>
            {group.divider ? (
              <div style={{ height: 1, background: colors.border, margin: `${spacing[12]}px ${spacing[8]}px` }} />
            ) : (
              <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                {group.items.map(({ id, label, Icon }) => {
                  const active = activeNav === id;
                  return (
                    <li key={id} style={{ marginBottom: 2 }}>
                      <button
                        type="button"
                        onClick={() => handleNav(id)}
                        className="w-full flex items-center gap-3 rounded-xl text-left transition-colors duration-100"
                        style={{
                          padding: '10px 12px',
                          background: active ? colors.primarySubtle : 'transparent',
                          color: active ? colors.primary : colors.text,
                          border: 'none',
                          cursor: 'pointer',
                          fontWeight: active ? 700 : 500,
                          fontSize: 14,
                        }}
                        onMouseEnter={(e) => {
                          if (!active) e.currentTarget.style.background = colors.surface2;
                        }}
                        onMouseLeave={(e) => {
                          if (!active) e.currentTarget.style.background = 'transparent';
                        }}
                      >
                        <Icon size={18} style={{ opacity: active ? 1 : 0.85 }} aria-hidden />
                        {label}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </React.Fragment>
        ))}
      </nav>

      {/* Main */}
      <div style={{ flex: 1, minWidth: 0, maxWidth: 860 }}>
        {/* Profile */}
        <section id="more-desktop-profile" style={{ scrollMarginTop: spacing[16] }}>
          <Card
            style={{
              padding: spacing[24],
              marginBottom: spacing[24],
              border: `1px solid ${shell.cardBorder}`,
              background: colors.surface1,
            }}
          >
            <div className="flex flex-wrap items-start gap-5">
              <div
                className="rounded-full flex items-center justify-center text-xl font-bold flex-shrink-0 overflow-hidden"
                style={{
                  width: 72,
                  height: 72,
                  background: colors.primarySubtle,
                  color: colors.text,
                }}
              >
                {trainerProfile?.profileImage ? (
                  <img src={trainerProfile.profileImage} alt="" className="w-full h-full object-cover" />
                ) : (
                  initials
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2 gap-y-1">
                  <h1 className="text-xl font-bold m-0" style={{ color: colors.text }}>
                    {name}
                  </h1>
                  {previewModeActive ? (
                    <span className="rounded-full px-2.5 py-0.5 text-xs font-semibold" style={{ background: colors.primarySubtle, color: colors.primary }}>
                      Preview
                    </span>
                  ) : null}
                </div>
                {email ? (
                  <p className="text-sm mt-1 m-0" style={{ color: colors.muted }}>
                    {email}
                  </p>
                ) : null}
                <p className="text-sm mt-1 m-0" style={{ color: colors.muted }}>
                  {previewIdentityLine}
                </p>
              </div>
            </div>
          </Card>
        </section>

        {/* Coaching */}
        <section id="more-desktop-coaching" style={{ scrollMarginTop: spacing[16] }}>
          <SectionTitle>Coaching</SectionTitle>
          <div className="grid gap-4 md:gap-6 mb-8" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
            <SettingsCard
              title="Work with a coach"
              description="Browse coaches and matching"
              icon={Users}
              onClick={() => navigate('/personal/coach-transition')}
            />
          </div>
        </section>

        {/* Account */}
        <section id="more-desktop-account" style={{ scrollMarginTop: spacing[16] }}>
          <SectionTitle>Account</SectionTitle>
          <div
            className="grid gap-4 md:gap-6 mb-8"
            style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}
          >
            <SettingsCard
              title="Account & settings"
              description="Profile, goals, units, and preferences"
              icon={UserCircle}
              onClick={() => navigate('/profile-account')}
            />
            <SettingsCard
              title="Activity & alerts"
              description="Notification list and delivery settings"
              icon={Bell}
              onClick={() => navigate('/notifications')}
            />
            <div id="more-desktop-support" style={{ scrollMarginTop: spacing[16] }}>
              <SettingsCard
                title="Help & support"
                description="Get help and contact support"
                icon={HelpCircle}
                onClick={() => navigate('/helpsupport')}
              />
            </div>
          </div>
        </section>

        {/* Training + Nutrition */}
        <section id="more-desktop-training" style={{ scrollMarginTop: spacing[16] }}>
          <SectionTitle>Training</SectionTitle>
          <div className="grid gap-4 md:gap-6 mb-8" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
            <SettingsCard
              title="Goals & preferences"
              description="Training goals and personal preferences"
              icon={Target}
              onClick={() => navigate('/profile-account')}
            />
          </div>
        </section>

        <section id="more-desktop-nutrition" style={{ scrollMarginTop: spacing[16] }}>
          <SectionTitle>Nutrition</SectionTitle>
          <div className="grid gap-4 md:gap-6 mb-8" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
            <SettingsCard
              title="Nutrition targets"
              description="Calories and macros"
              icon={UtensilsCrossed}
              onClick={() => navigate('/nutrition-targets')}
            />
          </div>
        </section>

        {/* Achievements */}
        <section id="more-desktop-achievements" style={{ scrollMarginTop: spacing[16] }}>
          <SectionTitle>Achievements</SectionTitle>
          <div className="grid gap-4 md:gap-6 mb-8" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
            <SettingsCard
              title="Achievements"
              description="Milestones and progress unlocks"
              icon={Trophy}
              onClick={() => navigate('/achievements')}
            />
          </div>
        </section>

        {/* Log out */}
        <div
          style={{
            marginTop: spacing[32],
            paddingTop: spacing[24],
            borderTop: `1px solid ${colors.border}`,
          }}
        >
          <button
            type="button"
            onClick={() => onLogout(true)}
            style={{
              width: '100%',
              maxWidth: 320,
              minHeight: touchTargetMin,
              borderRadius: radii.button,
              border: `1px solid rgba(239, 68, 68, 0.35)`,
              background: 'rgba(239, 68, 68, 0.08)',
              color: colors.destructive,
              fontSize: 15,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Log out
          </button>
        </div>
      </div>
    </div>
  );
}
