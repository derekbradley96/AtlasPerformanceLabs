import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { ChevronRight, User, Users, Dumbbell, Shield } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import AtlasLogo from '@/components/Brand/AtlasLogo';

import { colors as atlasColors } from '@/ui/tokens';
const BG = atlasColors.bg;
const CARD = atlasColors.surface1;
const BADGE = '#111C33';
const ACCENT = atlasColors.primary;
const TEXT = atlasColors.text;
const MUTED = 'rgba(229,231,235,0.65)';
const SEPARATOR = 'rgba(255,255,255,0.06)';
const isDev = import.meta.env.DEV;

async function lightHaptic() {
  try {
    if (Capacitor.isNativePlatform()) {
      await Haptics.impact({ style: ImpactStyle.Light });
      return;
    }
  } catch (e) {}
  if (navigator.vibrate) navigator.vibrate(10);
}

function RoleRow({ icon, title, onPress, isLast }) {
  return (
    <button
      type="button"
      onClick={onPress}
      className="w-full text-left min-h-[44px]"
      style={{
        height: 64,
        borderRadius: 0,
        padding: 16,
        background: CARD,
        border: 'none',
        borderBottom: isLast ? 'none' : `1px solid ${SEPARATOR}`,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        WebkitTapHighlightColor: 'transparent',
      }}
      onMouseDown={(e) => {
        e.currentTarget.style.background = '#111C33';
      }}
      onMouseUp={(e) => {
        e.currentTarget.style.background = CARD;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = CARD;
      }}
    >
      <div
        style={{
          width: 42,
          height: 42,
          borderRadius: 14,
          background: BADGE,
          display: 'grid',
          placeItems: 'center',
          flex: '0 0 auto',
        }}
      >
        {icon}
      </div>
      <span style={{ flex: 1, color: TEXT, fontWeight: 600, fontSize: 16 }}>{title}</span>
      <ChevronRight size={20} color={MUTED} />
    </button>
  );
}

export default function RoleLogin() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { role, selectRole, logout, enterAdmin, isHydratingAppState } = useAuth();
  const [mounted, setMounted] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const allowAdminBypass = isDev && searchParams.get('admin') === '1';

  useEffect(() => {
    const t = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(t);
  }, []);

  if (isHydratingAppState) return null;

  const handleRole = async (roleKey) => {
    await lightHaptic();
    selectRole(roleKey);
    if (roleKey === 'trainer') navigate('/trainer');
    if (roleKey === 'client') navigate('/client');
    if (roleKey === 'solo') navigate('/solo');
  };

  const handleLogout = async () => {
    await lightHaptic();
    logout(false);
  };

  const handleAdminJump = async (dashboard) => {
    await lightHaptic();
    setAdminOpen(false);
    enterAdmin(dashboard);
    navigate(`/${dashboard}`);
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: BG,
        color: TEXT,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        paddingTop: 'max(24px, env(safe-area-inset-top, 0))',
        paddingBottom: 'max(24px, env(safe-area-inset-bottom, 0))',
        paddingLeft: 'max(20px, env(safe-area-inset-left, 0))',
        paddingRight: 'max(20px, env(safe-area-inset-right, 0))',
      }}
    >
      <div
        style={{
          width: '100%',
          opacity: mounted ? 1 : 0,
          transform: mounted ? 'translateY(0)' : 'translateY(6px)',
          transition: 'opacity 240ms ease-out, transform 240ms ease-out',
        }}
      >
        <div style={{ marginTop: 24 }}>
          <AtlasLogo variant="auth" />
        </div>
        <p style={{ marginTop: 12, color: MUTED, fontSize: 15 }}>Choose your login</p>
        <div
          style={{
            marginTop: 16,
            overflow: 'hidden',
            borderRadius: 16,
            background: CARD,
          }}
        >
          <RoleRow
            title="Trainer"
            icon={<Dumbbell size={20} color={ACCENT} />}
            onPress={() => handleRole('trainer')}
            isLast={false}
          />
          <RoleRow
            title="Client"
            icon={<Users size={20} color={ACCENT} />}
            onPress={() => handleRole('client')}
            isLast={false}
          />
          <RoleRow
            title="Personal"
            icon={<User size={20} color={ACCENT} />}
            onPress={() => handleRole('solo')}
            isLast
          />
        </div>

        {role && (
          <button
            type="button"
            onClick={handleLogout}
            style={{
              marginTop: 18,
              width: '100%',
              minHeight: 44,
              background: 'transparent',
              border: 'none',
              color: MUTED,
              padding: 12,
              fontSize: 14,
            }}
          >
            Log out
          </button>
        )}

        {allowAdminBypass && (
          <>
            <button
              type="button"
              onClick={() => { lightHaptic(); setAdminOpen(true); }}
              style={{
                marginTop: 12,
                width: '100%',
                minHeight: 44,
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.1)',
                color: MUTED,
                padding: 10,
                fontSize: 12,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
              }}
            >
              <Shield size={14} /> Admin Mode
            </button>
            {adminOpen && (
              <div
                style={{
                  marginTop: 12,
                  padding: 12,
                  background: CARD,
                  borderRadius: 12,
                  border: '1px solid rgba(255,255,255,0.06)',
                }}
              >
                <p style={{ fontSize: 11, color: MUTED, marginBottom: 8 }}>Jump to dashboard (no login)</p>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {['trainer', 'client', 'solo'].map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => handleAdminJump(d)}
                      style={{
                        padding: '8px 12px',
                        background: BADGE,
                        border: 'none',
                        borderRadius: 8,
                        color: TEXT,
                        fontSize: 12,
                        textTransform: 'capitalize',
                      }}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
