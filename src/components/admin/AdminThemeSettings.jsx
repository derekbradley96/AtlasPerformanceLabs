import React, { useState } from 'react';
import { base44 } from '@/lib/emptyApi';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CardSkeleton } from '@/components/ui/LoadingState';
import { toast } from 'sonner';
import { Save } from 'lucide-react';

export default function AdminThemeSettings({ adminEmail }) {
  const isAdmin = adminEmail?.toLowerCase() === 'derekbradley96@gmail.com';

  const queryClient = useQueryClient();

  const { data: theme, isLoading } = useQuery({
    queryKey: ['theme-settings'],
    queryFn: async () => {
      const all = await base44.entities.ThemeSettings.list();
      return all[0] || null;
    },
    enabled: isAdmin,
  });

  const [form, setForm] = useState({
    app_name: 'Atlas Performance Labs',
    logo_url: '',
    primary_color: '#3B82F6',
    accent_color: '#3B82F6',
    background_gradient: 'from-atlas-surfaceAlt via-atlas-primary to-atlas-surfaceAlt',
    card_style: 'rounded'
  });

  React.useEffect(() => {
    if (theme) {
      setForm({
        app_name: theme.app_name || 'Atlas Performance Labs',
        logo_url: theme.logo_url || '',
        primary_color: theme.primary_color || '#3B82F6',
        accent_color: theme.accent_color || '#3B82F6',
        background_gradient: theme.background_gradient || 'from-atlas-surfaceAlt via-atlas-primary to-atlas-surfaceAlt',
        card_style: theme.card_style || 'rounded'
      });
    }
  }, [theme]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (theme) {
        await base44.entities.ThemeSettings.update(theme.id, form);
      } else {
        await base44.entities.ThemeSettings.create(form);
      }
      await base44.entities.AdminAuditLog.create({
        admin_email: adminEmail,
        action_type: 'theme_updated',
        target_type: 'ThemeSettings',
        old_value: JSON.stringify(theme),
        new_value: JSON.stringify(form),
        timestamp: new Date().toISOString()
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['theme-settings'] });
      toast.success('Theme saved (refresh to see changes)');
    }
  });

  if (!isAdmin) {
    return null;
  }

  if (isLoading) return <CardSkeleton count={1} />;

  return (
    <div className="space-y-6">
      <div className="bg-atlas-surface/50 border border-atlas-border/50 rounded-2xl p-6">
        <h3 className="font-semibold text-white mb-4">Brand Settings</h3>
        <div className="space-y-4">
          <div>
            <label className="text-sm text-slate-400 mb-2 block">App Name</label>
            <Input
              value={form.app_name}
              onChange={(e) => setForm({ ...form, app_name: e.target.value })}
              className="bg-atlas-primary border-atlas-border"
            />
          </div>

          <div>
            <label className="text-sm text-slate-400 mb-2 block">Logo URL</label>
            <Input
              value={form.logo_url}
              onChange={(e) => setForm({ ...form, logo_url: e.target.value })}
              placeholder="https://..."
              className="bg-atlas-primary border-atlas-border"
            />
          </div>
        </div>
      </div>

      <div className="bg-atlas-surface/50 border border-atlas-border/50 rounded-2xl p-6">
        <h3 className="font-semibold text-white mb-4">Colors</h3>
        <div className="space-y-4">
          <div>
            <label className="text-sm text-slate-400 mb-2 block">Primary Color</label>
            <div className="flex gap-2">
              <Input
                type="color"
                value={form.primary_color}
                onChange={(e) => setForm({ ...form, primary_color: e.target.value })}
                className="w-20 h-10 bg-atlas-primary border-atlas-border"
              />
              <Input
                value={form.primary_color}
                onChange={(e) => setForm({ ...form, primary_color: e.target.value })}
                className="flex-1 bg-atlas-primary border-atlas-border"
              />
            </div>
          </div>

          <div>
            <label className="text-sm text-slate-400 mb-2 block">Accent Color</label>
            <div className="flex gap-2">
              <Input
                type="color"
                value={form.accent_color}
                onChange={(e) => setForm({ ...form, accent_color: e.target.value })}
                className="w-20 h-10 bg-atlas-primary border-atlas-border"
              />
              <Input
                value={form.accent_color}
                onChange={(e) => setForm({ ...form, accent_color: e.target.value })}
                className="flex-1 bg-atlas-primary border-atlas-border"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="bg-atlas-surface/50 border border-atlas-border/50 rounded-2xl p-6">
        <h3 className="font-semibold text-white mb-4">Card Style</h3>
        <select
          value={form.card_style}
          onChange={(e) => setForm({ ...form, card_style: e.target.value })}
          className="w-full bg-atlas-primary border border-atlas-border rounded-lg px-3 py-2 text-white"
        >
          <option value="rounded">Rounded (2xl)</option>
          <option value="sharp">Sharp (no radius)</option>
          <option value="soft">Soft (xl)</option>
        </select>
      </div>

      <Button
        onClick={() => saveMutation.mutate()}
        disabled={saveMutation.isPending}
        className="w-full bg-atlas-accent hover:bg-atlas-accent/90"
      >
        <Save className="w-4 h-4 mr-2" />
        {saveMutation.isPending ? 'Saving...' : 'Save Theme'}
      </Button>
    </div>
  );
}