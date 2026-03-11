import React, { useState } from 'react';
import { base44 } from '@/lib/emptyApi';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CardSkeleton } from '@/components/ui/LoadingState';
import { toast } from 'sonner';
import { Save } from 'lucide-react';

export default function AdminBillingSettings({ adminEmail }) {
  const isAdmin = adminEmail?.toLowerCase() === 'derekbradley96@gmail.com';

  const queryClient = useQueryClient();

  const { data: settings, isLoading } = useQuery({
    queryKey: ['billing-settings'],
    queryFn: async () => {
      const all = await base44.entities.BillingSettings.list();
      return all[0] || null;
    },
    enabled: isAdmin,
  });

  const [form, setForm] = useState({
    platform_fee_default_percent: 0.10,
    pro_monthly_price_gbp: 59,
    pro_platform_fee_percent: 0.05,
    early_access_fee_percent: 0.07
  });

  React.useEffect(() => {
    if (settings) {
      setForm({
        platform_fee_default_percent: settings.platform_fee_default_percent || 0.10,
        pro_monthly_price_gbp: settings.pro_monthly_price_gbp || 59,
        pro_platform_fee_percent: settings.pro_platform_fee_percent || 0.05,
        early_access_fee_percent: settings.early_access_fee_percent || 0.07
      });
    }
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (settings) {
        await base44.entities.BillingSettings.update(settings.id, form);
      } else {
        await base44.entities.BillingSettings.create(form);
      }
      await base44.entities.AdminAuditLog.create({
        admin_email: adminEmail,
        action_type: 'billing_settings_updated',
        target_type: 'BillingSettings',
        old_value: JSON.stringify(settings),
        new_value: JSON.stringify(form),
        timestamp: new Date().toISOString()
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['billing-settings'] });
      toast.success('Billing settings saved');
    }
  });

  if (!isAdmin) {
    return null;
  }

  if (isLoading) return <CardSkeleton count={1} />;

  return (
    <div className="space-y-6">
      <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6">
        <h3 className="font-semibold text-white mb-4">Billing Configuration</h3>
        <div className="space-y-4">
          <div>
            <label className="text-sm text-slate-400 mb-2 block">Default Platform Fee (%)</label>
            <Input
              type="number"
              step="0.01"
              min="0"
              max="1"
              value={form.platform_fee_default_percent}
              onChange={(e) => setForm({ ...form, platform_fee_default_percent: parseFloat(e.target.value) })}
              className="bg-slate-900 border-slate-700"
            />
            <p className="text-xs text-slate-500 mt-1">Free tier fee (0.10 = 10%)</p>
          </div>

          <div>
            <label className="text-sm text-slate-400 mb-2 block">Pro Monthly Price (GBP)</label>
            <Input
              type="number"
              min="0"
              value={form.pro_monthly_price_gbp}
              onChange={(e) => setForm({ ...form, pro_monthly_price_gbp: parseInt(e.target.value) })}
              className="bg-slate-900 border-slate-700"
            />
          </div>

          <div>
            <label className="text-sm text-slate-400 mb-2 block">Pro Platform Fee (%)</label>
            <Input
              type="number"
              step="0.01"
              min="0"
              max="1"
              value={form.pro_platform_fee_percent}
              onChange={(e) => setForm({ ...form, pro_platform_fee_percent: parseFloat(e.target.value) })}
              className="bg-slate-900 border-slate-700"
            />
            <p className="text-xs text-slate-500 mt-1">Pro tier fee (0.05 = 5%)</p>
          </div>

          <div>
            <label className="text-sm text-slate-400 mb-2 block">Early Access Fee (%)</label>
            <Input
              type="number"
              step="0.01"
              min="0"
              max="1"
              value={form.early_access_fee_percent}
              onChange={(e) => setForm({ ...form, early_access_fee_percent: parseFloat(e.target.value) })}
              className="bg-slate-900 border-slate-700"
            />
            <p className="text-xs text-slate-500 mt-1">Early access tier fee (0.07 = 7%)</p>
          </div>

          <Button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
            className="w-full bg-blue-500 hover:bg-blue-600"
          >
            <Save className="w-4 h-4 mr-2" />
            {saveMutation.isPending ? 'Saving...' : 'Save Settings'}
          </Button>
        </div>
      </div>
    </div>
  );
}