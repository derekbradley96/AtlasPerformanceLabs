import React, { useState } from 'react';
import { base44 } from '@/lib/emptyApi';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { CardSkeleton } from '@/components/ui/LoadingState';
import { toast } from 'sonner';
import { Save, Plus, X } from 'lucide-react';

export default function AdminMarketplaceSettings({ adminEmail }) {
  const isAdmin = adminEmail?.toLowerCase() === 'derekbradley96@gmail.com';

  const queryClient = useQueryClient();

  const { data: settings, isLoading } = useQuery({
    queryKey: ['marketplace-settings'],
    queryFn: async () => {
      const all = await base44.entities.MarketplaceSettings.list();
      return all[0] || null;
    },
    enabled: isAdmin,
  });

  const [form, setForm] = useState({
    verification_enabled: true,
    new_trainer_boost_days: 30,
    specialties_list: ["Strength", "Hypertrophy", "Fat Loss", "Nutrition", "Powerlifting", "Bodybuilding", "CrossFit", "Olympic Lifting", "Rehabilitation", "Sports Performance"]
  });

  const [newSpecialty, setNewSpecialty] = useState('');

  React.useEffect(() => {
    if (settings) {
      setForm({
        verification_enabled: settings.verification_enabled ?? true,
        new_trainer_boost_days: settings.new_trainer_boost_days || 30,
        specialties_list: settings.specialties_list || []
      });
    }
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (settings) {
        await base44.entities.MarketplaceSettings.update(settings.id, form);
      } else {
        await base44.entities.MarketplaceSettings.create(form);
      }
      await base44.entities.AdminAuditLog.create({
        admin_email: adminEmail,
        action_type: 'marketplace_settings_updated',
        target_type: 'MarketplaceSettings',
        old_value: JSON.stringify(settings),
        new_value: JSON.stringify(form),
        timestamp: new Date().toISOString()
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['marketplace-settings'] });
      toast.success('Marketplace settings saved');
    }
  });

  const addSpecialty = () => {
    if (newSpecialty.trim() && !form.specialties_list.includes(newSpecialty.trim())) {
      setForm({ ...form, specialties_list: [...form.specialties_list, newSpecialty.trim()] });
      setNewSpecialty('');
    }
  };

  const removeSpecialty = (specialty) => {
    setForm({ ...form, specialties_list: form.specialties_list.filter(s => s !== specialty) });
  };

  if (!isAdmin) {
    return null;
  }

  if (isLoading) return <CardSkeleton count={1} />;

  return (
    <div className="space-y-6">
      <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6">
        <h3 className="font-semibold text-white mb-4">Marketplace Configuration</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm text-white">Verification Badges</label>
              <p className="text-xs text-slate-500">Show verification checkmarks</p>
            </div>
            <Switch
              checked={form.verification_enabled}
              onCheckedChange={(checked) => setForm({ ...form, verification_enabled: checked })}
            />
          </div>

          <div>
            <label className="text-sm text-slate-400 mb-2 block">New Trainer Boost (Days)</label>
            <Input
              type="number"
              min="0"
              value={form.new_trainer_boost_days}
              onChange={(e) => setForm({ ...form, new_trainer_boost_days: parseInt(e.target.value) })}
              className="bg-slate-900 border-slate-700"
            />
            <p className="text-xs text-slate-500 mt-1">Days to prioritize new trainers in search</p>
          </div>
        </div>
      </div>

      <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6">
        <h3 className="font-semibold text-white mb-4">Specialties</h3>
        <div className="space-y-3">
          <div className="flex gap-2">
            <Input
              value={newSpecialty}
              onChange={(e) => setNewSpecialty(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && addSpecialty()}
              placeholder="Add specialty..."
              className="bg-slate-900 border-slate-700"
            />
            <Button onClick={addSpecialty} size="sm">
              <Plus className="w-4 h-4" />
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {form.specialties_list.map((specialty) => (
              <div key={specialty} className="bg-slate-700 rounded-lg px-3 py-1.5 flex items-center gap-2">
                <span className="text-sm text-white">{specialty}</span>
                <button onClick={() => removeSpecialty(specialty)} className="text-slate-400 hover:text-white">
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
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
  );
}