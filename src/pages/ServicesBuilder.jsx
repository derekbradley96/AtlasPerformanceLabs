/**
 * Services builder: coaching packages mapped to Stripe Prices.
 * List from Supabase (or mock), add/edit with name, monthly price, description, active toggle.
 * Save calls stripe-service-upsert.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/AuthContext';
import Card from '@/ui/Card';
import Button from '@/ui/Button';
import { colors, spacing } from '@/ui/tokens';
import { toast } from 'sonner';
import { impactLight } from '@/lib/haptics';
import { Plus, Pencil, Loader2 } from 'lucide-react';
import { listServices, stripeServiceUpsert, getCoach, MOCK_SERVICES } from '@/lib/supabaseStripeApi';

const getFunctionsUrl = () => (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_URL) ? 'yes' : null;
const useSupabase = !!getFunctionsUrl();

function formatPrice(amount, currency = 'gbp') {
  if (amount == null) return '—';
  const value = currency.toLowerCase() === 'gbp' ? amount / 100 : amount / 100;
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: currency.toUpperCase(), minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);
}

export default function ServicesBuilder() {
  const { user, isDemoMode } = useAuth();
  const userId = isDemoMode ? 'demo-trainer' : (user?.id ?? '');
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ name: '', description: '', price_amount: 12000, currency: 'gbp', interval: 'month', active: true });
  const [coachId, setCoachId] = useState(null);

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const { coach } = await getCoach(userId);
      if (coach?.id) setCoachId(coach.id);
      const { services: list } = useSupabase ? await listServices(userId) : { services: MOCK_SERVICES };
      setServices(Array.isArray(list) ? list : MOCK_SERVICES);
    } catch (e) {
      setServices(MOCK_SERVICES);
      toast.error('Could not load services');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSave = useCallback(async () => {
    if (!form.name?.trim()) {
      toast.error('Name required');
      return;
    }
    const amount = Number(form.price_amount);
    if (!Number.isFinite(amount) || amount < 0) {
      toast.error('Valid price required');
      return;
    }
    setSavingId(editingId ?? 'new');
    try {
      const payload = {
        user_id: userId,
        coach_id: coachId ?? undefined,
        service_id: editingId || undefined,
        name: form.name.trim(),
        description: (form.description || '').trim() || undefined,
        price_amount: Math.round(amount),
        currency: form.currency || 'gbp',
        interval: form.interval || 'month',
        active: !!form.active,
      };
      const { service, error } = await stripeServiceUpsert(payload);
      if (error) {
        toast.error(error);
        return;
      }
      toast.success(editingId ? 'Service updated' : 'Service created');
      setEditingId(null);
      setForm({ name: '', description: '', price_amount: 12000, currency: 'gbp', interval: 'month', active: true });
      load();
    } catch (e) {
      toast.error(e?.message ?? 'Save failed');
    } finally {
      setSavingId(null);
    }
  }, [userId, coachId, editingId, form, load]);

  const startEdit = useCallback((s) => {
    impactLight();
    setEditingId(s.id);
    setForm({
      name: s.name ?? '',
      description: s.description ?? '',
      price_amount: s.price_amount ?? 12000,
      currency: s.currency ?? 'gbp',
      interval: s.interval ?? 'month',
      active: s.active !== false,
    });
  }, []);

  const cancelEdit = useCallback(() => {
    impactLight();
    setEditingId(null);
    setForm({ name: '', description: '', price_amount: 12000, currency: 'gbp', interval: 'month', active: true });
  }, []);

  return (
    <div
      className="app-screen min-w-0 max-w-full overflow-x-hidden"
      style={{
        paddingLeft: spacing[16],
        paddingRight: spacing[16],
        paddingBottom: `calc(${spacing[16]} + env(safe-area-inset-bottom, 0px))`,
        background: colors.bg,
        color: colors.text,
      }}
    >
      <h1 className="text-[22px] font-semibold mb-1" style={{ color: colors.text }}>Coaching packages</h1>
      <p className="text-sm mb-6" style={{ color: colors.muted }}>Services map to Stripe prices. Lead checkout uses these.</p>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 size={24} className="animate-spin" style={{ color: colors.muted }} />
        </div>
      ) : (
        <>
          {services.map((s) => (
            <Card key={s.id} style={{ marginBottom: spacing[12], padding: spacing[16] }}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium" style={{ color: colors.text }}>{s.name}</span>
                    {!s.active && <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(255,255,255,0.1)', color: colors.muted }}>Inactive</span>}
                  </div>
                  <p className="text-sm mt-0.5" style={{ color: colors.muted }}>{formatPrice(s.price_amount, s.currency)}/{s.interval || 'month'}</p>
                  {s.description ? <p className="text-[13px] mt-1" style={{ color: colors.muted }}>{s.description}</p> : null}
                </div>
                <Button variant="secondary" onClick={() => startEdit(s)} disabled={!!editingId}>
                  <Pencil size={14} style={{ marginRight: 6 }} /> Edit
                </Button>
              </div>
            </Card>
          ))}

          {editingId && (
            <Card style={{ marginBottom: spacing[16], padding: spacing[16] }}>
              <p className="text-sm font-medium mb-3" style={{ color: colors.muted }}>Edit service</p>
              <div className="space-y-3">
                <input
                  type="text"
                  placeholder="Name"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full rounded-lg px-3 py-2 text-[15px] border-none"
                  style={{ background: 'rgba(255,255,255,0.08)', color: colors.text }}
                />
                <input
                  type="number"
                  placeholder="Price (pence, e.g. 12000 = £120)"
                  value={form.price_amount}
                  onChange={(e) => setForm((f) => ({ ...f, price_amount: Number(e.target.value) || 0 }))}
                  className="w-full rounded-lg px-3 py-2 text-[15px] border-none"
                  style={{ background: 'rgba(255,255,255,0.08)', color: colors.text }}
                />
                <input
                  type="text"
                  placeholder="Description"
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  className="w-full rounded-lg px-3 py-2 text-[15px] border-none"
                  style={{ background: 'rgba(255,255,255,0.08)', color: colors.text }}
                />
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={form.active} onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))} />
                  <span className="text-sm" style={{ color: colors.text }}>Active</span>
                </label>
              </div>
              <div className="flex gap-2 mt-4">
                <Button variant="primary" onClick={handleSave} disabled={savingId !== null}>
                  {savingId !== null ? <Loader2 size={16} className="animate-spin" /> : null}
                  Save
                </Button>
                <Button variant="secondary" onClick={cancelEdit}>Cancel</Button>
              </div>
            </Card>
          )}

          {!editingId && (
            <Card style={{ padding: spacing[16] }}>
              <p className="text-sm font-medium mb-3" style={{ color: colors.muted }}>Add package</p>
              <div className="space-y-3">
                <input
                  type="text"
                  placeholder="Name"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full rounded-lg px-3 py-2 text-[15px] border-none"
                  style={{ background: 'rgba(255,255,255,0.08)', color: colors.text }}
                />
                <input
                  type="number"
                  placeholder="Price in pence (e.g. 12000 = £120)"
                  value={form.price_amount}
                  onChange={(e) => setForm((f) => ({ ...f, price_amount: Number(e.target.value) || 0 }))}
                  className="w-full rounded-lg px-3 py-2 text-[15px] border-none"
                  style={{ background: 'rgba(255,255,255,0.08)', color: colors.text }}
                />
                <input
                  type="text"
                  placeholder="Description"
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  className="w-full rounded-lg px-3 py-2 text-[15px] border-none"
                  style={{ background: 'rgba(255,255,255,0.08)', color: colors.text }}
                />
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={form.active} onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))} />
                  <span className="text-sm" style={{ color: colors.text }}>Active</span>
                </label>
              </div>
              <Button variant="primary" onClick={handleSave} disabled={savingId !== null} className="mt-4">
                {savingId === 'new' ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} style={{ marginRight: 6 }} />}
                Add package
              </Button>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
