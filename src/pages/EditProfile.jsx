import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PageLoader } from '@/components/ui/LoadingState';
import { useAuth } from '@/lib/AuthContext';
import { invokeSupabaseFunction } from '@/lib/supabaseApi';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { toast } from 'sonner';
import TrainerProfileSettings from '@/pages/settings/TrainerProfileSettings';
import { useTrainerPermissions } from '@/components/hooks/useTrainerPermissions';
import AccessDenied from '@/components/AccessDenied';

export default function EditProfile() {
  const navigate = useNavigate();
  const { user: authUser, isDemoMode, role: authRole, isLoadingAuth } = useAuth();
  const { isAssistant } = useTrainerPermissions();
  const isTrainer = authRole === 'trainer';
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [formData, setFormData] = useState({
    full_name: '',
    username: '',
    bio: '',
  });

  useEffect(() => {
    if (authUser) {
      setFormData({
        full_name: authUser.full_name || authUser.name || '',
        username: authUser.username || '',
        bio: authUser.bio || '',
      });
    }
  }, [authUser]);

  const displayUser = authUser;
  const loading = !isDemoMode && isLoadingAuth;

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    if (isDemoMode) {
      toast.success('Demo mode: changes not saved.');
      return;
    }
    if (!formData.full_name.trim()) {
      toast.error('Full name is required');
      return;
    }
    setSaving(true);
    try {
      await invokeSupabaseFunction('user-update-profile', formData);
      toast.success('Profile saved successfully!');
      setHasChanges(false);
      navigate(createPageUrl('Profile'));
    } catch (error) {
      toast.error('Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  if (!isDemoMode && loading) return <PageLoader />;
  if (isTrainer && isAssistant) return <AccessDenied message="Coach profile editing is only available to the account owner." title="Access limited" />;
  if (isTrainer) return <TrainerProfileSettings />;
  if (!displayUser) return <PageLoader />;

  const ACTION_BAR_HEIGHT = 72;
  const safeBottom = 'env(safe-area-inset-bottom, 0px)';

  return (
    <div className="app-screen min-w-0 max-w-full overflow-x-hidden bg-[#0B1220]">
      <div
        className="overflow-y-auto overflow-x-hidden flex-1 min-h-0"
        style={{
          paddingBottom: `calc(${ACTION_BAR_HEIGHT}px + ${safeBottom} + 24px)`,
          paddingLeft: 16,
          paddingRight: 16,
          paddingTop: 8,
        }}
      >
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="bg-atlas-surface/50 border border-atlas-border/50 rounded-2xl p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Full Name *</label>
            <Input
              value={formData.full_name}
              onChange={(e) => handleChange('full_name', e.target.value)}
              placeholder="Your full name"
              className="bg-atlas-primary border-atlas-border"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Username</label>
            <Input
              value={formData.username}
              onChange={(e) => handleChange('username', e.target.value)}
              placeholder="Optional username"
              className="bg-atlas-primary border-atlas-border"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Bio</label>
            <textarea
              value={formData.bio}
              onChange={(e) => handleChange('bio', e.target.value)}
              placeholder="Tell us about yourself"
              className="w-full bg-atlas-primary border border-atlas-border rounded-lg px-3 py-2 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-atlas-accent"
              rows={3}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Email</label>
            <Input
              value={displayUser?.email || ''}
              disabled
              className="bg-atlas-primary border-atlas-border"
            />
            <p className="text-xs text-slate-500 mt-1">Email cannot be changed here</p>
          </div>
        </div>
      </div>
      </div>

      <div
        className="fixed left-0 right-0 z-40 flex gap-3 items-center px-4 border-t"
        style={{
          bottom: 0,
          minHeight: ACTION_BAR_HEIGHT,
          paddingBottom: `max(12px, ${safeBottom})`,
          paddingTop: 12,
          background: 'rgba(11, 18, 32, 0.92)',
          borderColor: 'rgba(255,255,255,0.06)',
          WebkitBackdropFilter: 'blur(18px) saturate(180%)',
          backdropFilter: 'blur(18px) saturate(180%)',
        }}
      >
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="flex-1 rounded-[18px] min-h-[50px] font-semibold transition-colors flex items-center justify-center"
          style={{
            background: '#DC2626',
            border: 'none',
            color: '#fff',
          }}
        >
          Cancel
        </button>
        <Button
          onClick={handleSave}
          disabled={saving || !hasChanges}
          className="flex-1 rounded-[18px] min-h-[50px] font-semibold bg-atlas-accent hover:bg-atlas-accent/90 disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>
    </div>
  );
}