import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { PageLoader } from '@/components/ui/LoadingState';
import SkeletonCard from '@/components/ui/SkeletonCard';
import { useAuth, ADMIN_EMAIL } from '@/lib/AuthContext';
import { invokeSupabaseFunction } from '@/lib/supabaseApi';
import { Button } from '@/components/ui/button';
import { Edit2, LogOut, Mail, Zap, Shield } from 'lucide-react';
import { getUserRole } from '@/lib/roles';
import { toast } from 'sonner';

export default function Profile() {
  const navigate = useNavigate();
  const { user: authUser, profile, isDemoMode, logout, isLoadingAuth, coachFocus } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);

  const displayUser = authUser;
  const isDev = typeof import.meta !== 'undefined' && import.meta.env?.DEV;

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      logout();
    } catch (error) {
      setLoggingOut(false);
    }
  };

  const roles = ['trainer', 'client', 'solo'];
  const roleLabels = { trainer: 'Coach', client: 'Client', solo: 'Personal' };
  const currentRole = getUserRole(profile ?? displayUser);
  const currentRoleIndex = roles.indexOf(currentRole);

  const handleRoleSwitch = async () => {
    if (isDemoMode) return;
    const nextRole = roles[(currentRoleIndex + 1) % roles.length];
    try {
      await invokeSupabaseFunction('user-update-role', { user_type: nextRole });
      window.location.reload();
    } catch (error) {
      console.error('Failed to switch role:', error);
      toast.error('Failed to switch role. Try again.');
    }
  };

  const rawRole = profile?.role ?? displayUser?.role ?? '';
  const coachFocusLabel = coachFocus ?? profile?.coach_focus ?? '—';

  if (isLoadingAuth && !isDemoMode) {
    return (
      <div className="app-screen p-4">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-16 h-16 rounded-full bg-slate-700/50 animate-pulse" />
          <div className="flex-1 space-y-2">
            <div className="h-5 w-32 bg-slate-700/50 rounded animate-pulse" />
            <div className="h-4 w-48 bg-slate-700/50 rounded animate-pulse" />
          </div>
        </div>
        <SkeletonCard lines={3} />
        <div className="mt-4"><SkeletonCard lines={2} /></div>
      </div>
    );
  }
  if (!displayUser) return <PageLoader />;

  return (
    <div className="app-screen">
      <div className="app-section">
        {isDev && (
          <div
            className="mb-4 rounded-lg border px-3 py-2 text-xs font-mono"
            style={{
              background: 'rgba(59, 130, 246, 0.08)',
              borderColor: 'rgba(59, 130, 246, 0.3)',
              color: 'var(--atlas-text-secondary, #9CA3AF)',
            }}
            role="status"
            aria-label="Debug: role and coach focus"
          >
            <div><strong>role</strong> (profiles.role): {rawRole || '—'}</div>
            <div><strong>resolved</strong>: {currentRole}</div>
            {(currentRole === 'trainer') && <div><strong>coach_focus</strong>: {String(coachFocusLabel)}</div>}
          </div>
        )}
        {/* Profile Card */}
        <div className="app-card p-6">
          {/* User Info */}
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-400 rounded-full flex items-center justify-center text-2xl font-bold text-white">
              {displayUser.full_name?.[0] || displayUser.name?.[0]?.toUpperCase() || 'U'}
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-bold text-white">{displayUser.full_name || displayUser.name || 'User'}</h2>
              <p className="text-sm text-slate-400 flex items-center gap-2">
                <Mail className="w-4 h-4" />
                {displayUser.email}
              </p>
            </div>
          </div>

          {/* Info Grid */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            {displayUser.units && (
              <div className="bg-slate-900/50 rounded-lg p-3">
                <p className="text-xs text-slate-400 mb-1">Units</p>
                <p className="font-semibold text-white">{displayUser.units === 'lb' ? 'lbs' : 'kg'}</p>
              </div>
            )}
            {displayUser.fitness_goal && currentRole === 'client' && (
              <div className="bg-slate-900/50 rounded-lg p-3">
                <p className="text-xs text-slate-400 mb-1">Goal</p>
                <p className="font-semibold text-white capitalize">{displayUser.fitness_goal}</p>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <Button
              onClick={() => navigate(createPageUrl('EditProfile'))}
              className="flex-1 bg-blue-500 hover:bg-blue-600"
            >
              <Edit2 className="w-4 h-4 mr-2" />
              Edit Profile
            </Button>
            <Button
              onClick={handleLogout}
              disabled={loggingOut}
              variant="outline"
              className="flex-1 border-red-500/30 text-red-400 hover:bg-red-500/10"
            >
              <LogOut className="w-4 h-4 mr-2" />
              {loggingOut ? '...' : 'Log Out'}
            </Button>
          </div>
        </div>

        {/* Account Details */}
        <div className="app-card p-6">
          <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-4">Account</h3>
          <div className="space-y-3 text-sm text-slate-400">
            <div className="flex justify-between">
              <span>Email</span>
              <span className="text-white">{displayUser.email}</span>
            </div>
            <div className="flex justify-between">
              <span>Role</span>
              <span className="text-white capitalize">{currentRole || '—'}</span>
            </div>
            {displayUser.created_date && (
              <div className="flex justify-between">
                <span>Member Since</span>
                <span className="text-white">
                  {new Date(displayUser.created_date).toLocaleDateString('en-GB', { 
                    year: 'numeric', 
                    month: 'short' 
                  })}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Admin / Dev Panel: always visible for admin email, plus dev tools in dev */}
        {(isDev || displayUser?.email === ADMIN_EMAIL) && (
          <div className="app-card p-6 border-purple-500/30 bg-purple-500/10">
            <h3 className="text-sm font-semibold text-purple-400 uppercase tracking-wide mb-4 flex items-center gap-2">
              <Shield className="w-4 h-4" />
              {displayUser?.email === ADMIN_EMAIL ? 'Admin' : 'Dev Tools'}
            </h3>
            <Button
              onClick={() => navigate('/admin-dev-panel')}
              className="w-full bg-purple-600 hover:bg-purple-700 text-white mb-3"
            >
              <Shield className="w-4 h-4 mr-2" />
              Open Admin Panel
            </Button>
            {isDev && (
              <Button
                onClick={handleRoleSwitch}
                variant="outline"
                className="w-full border-purple-500/50 text-purple-300"
              >
                Switch Role → {roleLabels[roles[(currentRoleIndex + 1) % roles.length]] ?? roles[(currentRoleIndex + 1) % roles.length]}
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}