import React, { useState, useEffect } from 'react';
import { PageLoader } from '@/components/ui/LoadingState';
import { useAuth } from '@/lib/AuthContext';
import { invokeSupabaseFunction } from '@/lib/supabaseApi';
import { ArrowLeft, Moon, Sun, Monitor } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { toast } from 'sonner';

export default function Appearance() {
  const navigate = useNavigate();
  const { isDemoMode, user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [theme, setTheme] = useState('dark');

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme_preference');
    if (savedTheme) setTheme(savedTheme);
    if (user?.theme_preference) {
      setTheme(user.theme_preference);
      localStorage.setItem('theme_preference', user.theme_preference);
    }
    setLoading(false);
  }, [isDemoMode, user]);

  const handleThemeChange = async (newTheme) => {
    setTheme(newTheme);
    localStorage.setItem('theme_preference', newTheme);
    if (isDemoMode) {
      toast.success('Theme updated! (Demo)');
      return;
    }
    setSaving(true);
    try {
      await invokeSupabaseFunction('user-update-role', { theme_preference: newTheme });
      toast.success('Theme updated!');
    } catch (error) {
      toast.error('Failed to save theme preference');
    } finally {
      setSaving(false);
    }
  };

  const themes = [
    {
      id: 'dark',
      label: 'Dark',
      description: 'Easy on the eyes',
      icon: Moon,
      colors: 'from-slate-950 via-slate-900 to-slate-950'
    },
    {
      id: 'light',
      label: 'Light',
      description: 'Classic light theme',
      icon: Sun,
      colors: 'from-white via-gray-50 to-white',
      disabled: true
    },
    {
      id: 'system',
      label: 'System',
      description: 'Match your device settings',
      icon: Monitor,
      colors: 'from-slate-800 via-slate-700 to-slate-800',
      disabled: true
    }
  ];

  if (!isDemoMode && loading) return <PageLoader />;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 pb-24 p-4 md:p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button 
          onClick={() => navigate(createPageUrl('Profile'))}
          className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-slate-400" />
        </button>
        <h1 className="text-2xl font-bold text-white">Appearance</h1>
      </div>

      {/* Theme Selection */}
      <div className="max-w-md mx-auto space-y-4">
        <p className="text-sm text-slate-400 mb-4">Choose your preferred theme</p>
        {themes.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => !t.disabled && handleThemeChange(t.id)}
              disabled={t.disabled || saving}
              className={`w-full text-left p-4 rounded-2xl border-2 transition-all ${
                theme === t.id
                  ? 'border-blue-500 bg-slate-800/50'
                  : 'border-slate-700/50 bg-slate-800/30 hover:bg-slate-800/50'
              } ${t.disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 rounded-lg bg-gradient-to-br ${t.colors} flex items-center justify-center border border-slate-700`}>
                  <Icon className="w-6 h-6 text-slate-400" />
                </div>
                <div>
                  <p className="font-medium text-white">{t.label}</p>
                  <p className="text-xs text-slate-500">
                    {t.disabled ? 'Coming soon' : t.description}
                  </p>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Info */}
      <div className="max-w-md mx-auto mt-8 p-4 bg-slate-800/30 border border-slate-700/50 rounded-2xl">
        <p className="text-sm text-slate-400">
          Theme preference is saved to your profile and synced across devices.
        </p>
      </div>
    </div>
  );
}