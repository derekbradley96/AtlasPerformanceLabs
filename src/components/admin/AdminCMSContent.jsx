import React, { useState } from 'react';
import { base44 } from '@/lib/emptyApi';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { CardSkeleton } from '@/components/ui/LoadingState';
import { toast } from 'sonner';
import { Save } from 'lucide-react';

export default function AdminCMSContent({ adminEmail }) {
  const isAdmin = adminEmail?.toLowerCase() === 'derekbradley96@gmail.com';

  const queryClient = useQueryClient();

  const { data: content, isLoading } = useQuery({
    queryKey: ['app-content'],
    queryFn: async () => {
      const all = await base44.entities.AppContent.list();
      return all[0] || null;
    },
    enabled: isAdmin,
  });

  const [form, setForm] = useState({
    landing_headline: 'Transform Your Training',
    landing_subheadline: 'Connect with expert coaches or train solo',
    landing_primary_cta_text: 'Get Started',
    announcement_banner_text: '',
    announcement_banner_enabled: false
  });

  React.useEffect(() => {
    if (content) {
      setForm({
        landing_headline: content.landing_headline || 'Transform Your Training',
        landing_subheadline: content.landing_subheadline || 'Connect with expert coaches or train solo',
        landing_primary_cta_text: content.landing_primary_cta_text || 'Get Started',
        announcement_banner_text: content.announcement_banner_text || '',
        announcement_banner_enabled: content.announcement_banner_enabled || false
      });
    }
  }, [content]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (content) {
        await base44.entities.AppContent.update(content.id, form);
      } else {
        await base44.entities.AppContent.create(form);
      }
      await base44.entities.AdminAuditLog.create({
        admin_email: adminEmail,
        action_type: 'content_updated',
        target_type: 'AppContent',
        old_value: JSON.stringify(content),
        new_value: JSON.stringify(form),
        timestamp: new Date().toISOString()
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['app-content'] });
      toast.success('Content saved');
    }
  });

  if (!isAdmin) {
    return null;
  }

  if (isLoading) return <CardSkeleton count={1} />;

  return (
    <div className="space-y-6">
      <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6">
        <h3 className="font-semibold text-white mb-4">Landing Page Content</h3>
        <div className="space-y-4">
          <div>
            <label className="text-sm text-slate-400 mb-2 block">Headline</label>
            <Input
              value={form.landing_headline}
              onChange={(e) => setForm({ ...form, landing_headline: e.target.value })}
              className="bg-slate-900 border-slate-700"
            />
          </div>

          <div>
            <label className="text-sm text-slate-400 mb-2 block">Subheadline</label>
            <Input
              value={form.landing_subheadline}
              onChange={(e) => setForm({ ...form, landing_subheadline: e.target.value })}
              className="bg-slate-900 border-slate-700"
            />
          </div>

          <div>
            <label className="text-sm text-slate-400 mb-2 block">Primary CTA Button Text</label>
            <Input
              value={form.landing_primary_cta_text}
              onChange={(e) => setForm({ ...form, landing_primary_cta_text: e.target.value })}
              className="bg-slate-900 border-slate-700"
            />
          </div>
        </div>
      </div>

      <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6">
        <h3 className="font-semibold text-white mb-4">Announcement Banner</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <label className="text-sm text-slate-400">Enable Banner</label>
            <Switch
              checked={form.announcement_banner_enabled}
              onCheckedChange={(checked) => setForm({ ...form, announcement_banner_enabled: checked })}
            />
          </div>

          <div>
            <label className="text-sm text-slate-400 mb-2 block">Banner Text</label>
            <Textarea
              value={form.announcement_banner_text}
              onChange={(e) => setForm({ ...form, announcement_banner_text: e.target.value })}
              placeholder="🎉 New feature launched!"
              className="bg-slate-900 border-slate-700"
            />
          </div>
        </div>
      </div>

      <Button
        onClick={() => saveMutation.mutate()}
        disabled={saveMutation.isPending}
        className="w-full bg-blue-500 hover:bg-blue-600"
      >
        <Save className="w-4 h-4 mr-2" />
        {saveMutation.isPending ? 'Saving...' : 'Save Content'}
      </Button>
    </div>
  );
}