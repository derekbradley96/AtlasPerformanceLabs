/**
 * DEV/demo only: role picker that routes to real auth or client code.
 * Production auth flow is unified through /auth. Legacy role-select pages are DEV/demo only.
 */
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { ChevronRight, User, Users, Dumbbell, Shield } from 'lucide-react';
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
      className="w-full text-left"
      style={{
        height: 64,
        minHeight: 64,
        borderRadius: 0,
        padding: '0 16px',
        background: CARD,
        border: 'none',
        borderBottom: isLast ? 'none' : `1px solid ${SEPARATOR}`,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: 12,
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

export default function RoleSelect() {
  const navigate = useNavigate();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const t = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(t);
  }, []);

  const handleRole = async (roleKey) => {
    await lightHaptic();
    if (roleKey === 'coach') navigate('/auth?mode=login&account=coach', { replace: true });
    else if (roleKey === 'personal') navigate('/auth?mode=login&account=personal', { replace: true });
    else if (roleKey === 'client') navigate('/client-code', { replace: true });
  };

  const handleAdminOpen = async () => {
    await lightHaptic();
    navigate('/admin-dev-panel');
  };

  return (
    <div
      style={{
        width: '100%',
        maxWidth: '100%',
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
        boxSizing: 'border-box',
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
        <p style={{ marginTop: 12, color: MUTED, fontSize: 15 }}>Choose your role</p>
        <div
          style={{
            marginTop: 16,
            overflow: 'hidden',
            borderRadius: 16,
            background: CARD,
          }}
        >
          <RoleRow
            title="Coach"
            icon={<Dumbbell size={20} color={ACCENT} />}
            onPress={() => handleRole('coach')}
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
            onPress={() => handleRole('personal')}
            isLast
          />
        </div>

        {isDev && (
          <button
            type="button"
            onClick={handleAdminOpen}
            style={{
              marginTop: 24,
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
            <Shield size={14} /> Admin (DEV)
          </button>
        )}
      </div>
    </div>
  );
}
