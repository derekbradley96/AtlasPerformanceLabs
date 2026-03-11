import React, { useState } from 'react';
import { base44 } from '@/lib/emptyApi';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { CardSkeleton } from '@/components/ui/LoadingState';
import { toast } from 'sonner';
import { Save, AlertTriangle } from 'lucide-react';

export default function AdminFeatureFlags({ adminEmail }) {
  const isAdmin = adminEmail?.toLowerCase() === 'derekbradley96@gmail.com';

  const queryClient = useQueryClient();

  const { data: flags, isLoading } = useQuery({
    queryKey: ['feature-flags'],
    queryFn: async () => {
      const all = await base44.entities.FeatureFlags.list();
      return all[0] || null;
    },
    enabled: isAdmin,
  });

  const [form, setForm] = useState({
    marketplace_enabled: true,
    solo_workouts_enabled: true,
    nutrition_enabled: true,
    check_ins_enabled: true,
    messaging_enabled: true,
    pro_plan_enabled: true,
    analytics_enabled: true
  });

  React.useEffect(() => {
    if (flags) {
      setForm({
        marketplace_enabled: flags.marketplace_enabled ?? true,
        solo_workouts_enabled: flags.solo_workouts_enabled ?? true,
        nutrition_enabled: flags.nutrition_enabled ?? true,
        check_ins_enabled: flags.check_ins_enabled ?? true,
        messaging_enabled: flags.messaging_enabled ?? true,
        pro_plan_enabled: flags.pro_plan_enabled ?? true,
        analytics_enabled: flags.analytics_enabled ?? true
      });
    }
  }, [flags]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (flags) {
        await base44.entities.FeatureFlags.update(flags.id, form);
      } else {
        await base44.entities.FeatureFlags.create(form);
      }
      await base44.entities.AdminAuditLog.create({
        admin_email: adminEmail,
        action_type: 'feature_flags_updated',
        target_type: 'FeatureFlags',
        old_value: JSON.stringify(flags),
        new_value: JSON.stringify(form),
        timestamp: new Date().toISOString()
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feature-flags'] });
      toast.success('Feature flags saved (refresh app to see changes)');
    }
  });

  if (!isAdmin) {
    return null;
  }

  if (isLoading) return <CardSkeleton count={1} />;

  const features = [
    { key: 'marketplace_enabled', label: 'Trainer Marketplace', description: 'Browse and find trainers' },
    { key: 'solo_workouts_enabled', label: 'Personal Workouts', description: 'Track workouts without a trainer' },
    { key: 'nutrition_enabled', label: 'Nutrition', description: 'Macro tracking and meal plans' },
    { key: 'check_ins_enabled', label: 'Check-ins', description: 'Client progress check-ins' },
    { key: 'messaging_enabled', label: 'Messaging', description: 'Trainer-client communication' },
    { key: 'pro_plan_enabled', label: 'Pro Plan', description: 'Trainer Pro subscriptions' },
    { key: 'analytics_enabled', label: 'Analytics', description: 'Track events and user behavior' }
  ];

  return (
    <div className="space-y-6">
      <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 flex gap-3">
        <AlertTriangle className="w-5 h-5 text-yellow-400 flex-shrink-0" />
        <div>
          <p className="text-sm text-yellow-400 font-medium">Warning</p>
          <p className="text-xs text-slate-300">Disabling features may break existing user workflows. Test carefully.</p>
        </div>
      </div>

      <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6">
        <h3 className="font-semibold text-white mb-4">Feature Toggles</h3>
        <div className="space-y-4">
          {features.map((feature) => (
            <div key={feature.key} className="flex items-center justify-between">
              <div>
                <label className="text-sm text-white">{feature.label}</label>
                <p className="text-xs text-slate-500">{feature.description}</p>
              </div>
              <Switch
                checked={form[feature.key]}
                onCheckedChange={(checked) => setForm({ ...form, [feature.key]: checked })}
              />
            </div>
          ))}
        </div>
      </div>

      <Button
        onClick={() => saveMutation.mutate()}
        disabled={saveMutation.isPending}
        className="w-full bg-blue-500 hover:bg-blue-600"
      >
        <Save className="w-4 h-4 mr-2" />
        {saveMutation.isPending ? 'Saving...' : 'Save Feature Flags'}
      </Button>
    </div>
  );
}