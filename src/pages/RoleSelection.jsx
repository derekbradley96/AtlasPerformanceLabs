import React, { useState, useCallback } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { invokeSupabaseFunction } from '@/lib/supabaseApi';
import { createPageUrl } from '@/utils';
import { Dumbbell, Users, User, ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import AtlasLogo from '@/components/Brand/AtlasLogo';

import { colors as tokenColors } from '@/ui/tokens';
const colors = {
  background: tokenColors.bg,
  surface: tokenColors.surface1,
  surfacePressed: '#111C33',
  accent: tokenColors.primary,
  text: tokenColors.text,
  muted: tokenColors.muted,
  badgeBg: 'rgba(59,130,246,0.18)',
};

function triggerHaptic() {
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    navigator.vibrate(10);
  }
}

function RoleRow({ icon: Icon, title, onSelect, disabled }) {
  const [pressed, setPressed] = useState(false);

  const handlePress = useCallback(() => {
    if (disabled) return;
    triggerHaptic();
    onSelect();
  }, [disabled, onSelect]);

  return (
    <button
      type="button"
      onClick={handlePress}
      disabled={disabled}
      onPointerDown={() => setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onPointerLeave={() => setPressed(false)}
      className="w-full flex items-center gap-4 rounded-2xl transition-all duration-100 ease-out outline-none border-0 text-left disabled:opacity-60"
      style={{
        height: 64,
        paddingLeft: 16,
        paddingRight: 16,
        background: pressed ? colors.surfacePressed : colors.surface,
        transform: pressed ? 'scale(0.99)' : 'scale(1)',
      }}
      aria-label={`Select ${title}`}
    >
      <div
        className="flex items-center justify-center flex-shrink-0"
        style={{
          width: 42,
          height: 42,
          borderRadius: 14,
          background: colors.badgeBg,
        }}
      >
        <Icon className="flex-shrink-0" size={22} style={{ color: colors.accent }} strokeWidth={2} />
      </div>
      <span
        className="flex-1 font-semibold"
        style={{ color: colors.text, fontSize: 16 }}
      >
        {title}
      </span>
      <ChevronRight className="flex-shrink-0 w-5 h-5" style={{ color: colors.muted }} />
    </button>
  );
}

export default function RoleSelection() {
  const navigate = useNavigate();
  const { isDemoMode, setRole, exitDemo } = useAuth();
  const [loading, setLoading] = useState(false);

  const handleExitDemo = useCallback(() => {
    exitDemo();
    navigate(createPageUrl('Login'), { replace: true });
  }, [exitDemo, navigate]);

  if (isDemoMode) return <Navigate to="/home" replace />;

  const handleRoleSelect = async (roleKey) => {
    if (loading) return;
    setLoading(true);

    try {
      const user_type = roleKey;
      await invokeSupabaseFunction('user-update-role', { user_type });
      setRole(roleKey);

      if (roleKey === 'trainer') {
        toast.success('Welcome, Trainer');
        navigate(createPageUrl('Home'), { replace: true });
      } else if (roleKey === 'client') {
        toast.success('Welcome');
        navigate(createPageUrl('MyProgram'), { replace: true });
      } else {
        toast.success('Welcome');
        navigate(createPageUrl('Home'), { replace: true });
      }
    } catch (error) {
      toast.error('Failed to set role. Please try again.');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const roles = [
    { key: 'trainer', title: 'Trainer', icon: Dumbbell },
    { key: 'client', title: 'Client', icon: Users },
    { key: 'solo', title: 'Personal', icon: User },
  ];

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{
        background: colors.background,
        paddingTop: 'env(safe-area-inset-top, 0)',
        paddingLeft: 'env(safe-area-inset-left, 0)',
        paddingRight: 'env(safe-area-inset-right, 0)',
        paddingBottom: 'env(safe-area-inset-bottom, 0)',
      }}
    >
      <motion.div
        className="relative flex flex-col flex-1 px-4 pt-6 pb-6"
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.24, ease: [0, 0, 0.2, 1] }}
      >
        <div className="mb-6">
          <AtlasLogo variant="auth" />
        </div>
        <p className="text-sm mb-4" style={{ color: colors.muted }}>
          Choose your login
        </p>

        {/* Role list */}
        <div className="flex flex-col gap-3 w-full">
          {roles.map((role) => (
            <RoleRow
              key={role.key}
              icon={role.icon}
              title={role.title}
              onSelect={() => handleRoleSelect(role.key)}
              disabled={loading}
            />
          ))}
        </div>

        {/* Exit Demo link (only when demo mode is active) */}
        {isDemoMode && (
          <button
            type="button"
            onClick={handleExitDemo}
            className="mt-auto pt-8 text-center text-sm bg-transparent border-0 cursor-pointer w-full"
            style={{ color: colors.muted }}
          >
            Exit Demo
          </button>
        )}
      </motion.div>
    </div>
  );
}
