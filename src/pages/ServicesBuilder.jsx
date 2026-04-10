/**
 * Coaching packages: card-based composer + Stripe-backed save (stripe-service-upsert).
 */
import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/AuthContext';
import Card from '@/ui/Card';
import Button from '@/ui/Button';
import { colors, spacing, touchTargetMin } from '@/ui/tokens';
import { toast } from 'sonner';
import { impactLight } from '@/lib/haptics';
import { Plus, Pencil, Loader2 } from 'lucide-react';
import { listServices, stripeServiceUpsert, getCoach, MOCK_SERVICES } from '@/lib/supabaseStripeApi';
import CoachPlanPackageEditor from '@/components/coaching/CoachPlanPackageEditor';
import { buildPlanDescriptionForStripe, splitPlanDescription } from '@/lib/coachPlanTemplates';

const getFunctionsUrl = () => (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_URL ? 'yes' : null);
const useSupabase = !!getFunctionsUrl();

function formatPrice(amount, currency = 'gbp') {
  if (amount == null) return '—';
  const value = amount / 100;
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: currency.toUpperCase(),
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function emptyComposer() {
  return {
    name: '',
    shortDescription: '',
    includes: '',
    priceMajor: '',
    interval: 'month',
    currency: 'gbp',
    active: true,
  };
}

function majorToCents(major) {
  const n = Number(major);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}

export default function ServicesBuilder() {
  const { user, isDemoMode } = useAuth();
  const userId = isDemoMode ? 'demo-trainer' : (user?.id ?? '');
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [composer, setComposer] = useState(() => emptyComposer());
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

  const mergeComposer = useCallback((patch) => {
    setComposer((c) => ({ ...c, ...patch }));
  }, []);

  const handleSave = useCallback(async () => {
    if (!composer.name?.trim()) {
      toast.error('Add a plan name');
      return;
    }
    const cents = majorToCents(composer.priceMajor);
    if (cents == null || cents < 50) {
      toast.error('Set a price (minimum about 0.50 in your currency)');
      return;
    }
    setSavingId(editingId ?? 'new');
    try {
      const description = buildPlanDescriptionForStripe(composer.shortDescription, composer.includes);
      const payload = {
        user_id: userId,
        coach_id: coachId ?? undefined,
        service_id: editingId || undefined,
        name: composer.name.trim(),
        description,
        price_amount: cents,
        currency: composer.currency || 'gbp',
        interval: composer.interval || 'month',
        active: composer.active !== false,
      };
      const { error } = await stripeServiceUpsert(payload);
      if (error) {
        toast.error(error);
        return;
      }
      toast.success(editingId ? 'Plan updated' : 'Plan created');
      setEditingId(null);
      setComposer(emptyComposer());
      load();
    } catch (e) {
      toast.error(e?.message ?? 'Save failed');
    } finally {
      setSavingId(null);
    }
  }, [userId, coachId, editingId, composer, load]);

  const startEdit = useCallback((s) => {
    impactLight();
    setEditingId(s.id);
    const { shortDescription, includes } = splitPlanDescription(s.description);
    setComposer({
      name: s.name ?? '',
      shortDescription,
      includes,
      priceMajor: s.price_amount != null ? String(s.price_amount / 100) : '',
      currency: s.currency ?? 'gbp',
      interval: s.interval === 'year' ? 'year' : 'month',
      active: s.active !== false,
    });
  }, []);

  const cancelEdit = useCallback(() => {
    impactLight();
    setEditingId(null);
    setComposer(emptyComposer());
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
        maxWidth: 520,
        marginLeft: 'auto',
        marginRight: 'auto',
      }}
    >
      <h1 className="text-[22px] font-semibold mb-1" style={{ color: colors.text }}>
        Plans &amp; packages
      </h1>
      <p className="text-sm mb-6" style={{ color: colors.muted }}>
        Pick a template, set your price, save. Clients see this on checkout.
      </p>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 size={24} className="animate-spin" style={{ color: colors.muted }} />
        </div>
      ) : (
        <>
          {services.map((s) => {
            const { shortDescription } = splitPlanDescription(s.description);
            return (
              <Card
                key={s.id}
                style={{
                  marginBottom: spacing[12],
                  padding: spacing[16],
                  border: `1px solid ${colors.border}`,
                  background: colors.surface1,
                }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-[16px]" style={{ color: colors.text }}>
                        {s.name}
                      </span>
                      {s.active === false && (
                        <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(255,255,255,0.1)', color: colors.muted }}>
                          Inactive
                        </span>
                      )}
                    </div>
                    <p className="text-sm mt-1 font-medium" style={{ color: colors.accent }}>
                      {formatPrice(s.price_amount, s.currency)} / {s.interval || 'month'}
                    </p>
                    {shortDescription ? (
                      <p className="text-[13px] mt-1 leading-snug line-clamp-2" style={{ color: colors.muted }}>
                        {shortDescription}
                      </p>
                    ) : null}
                  </div>
                  <Button variant="secondary" onClick={() => startEdit(s)} disabled={!!editingId} style={{ flexShrink: 0 }}>
                    <Pencil size={14} style={{ marginRight: 6 }} /> Edit
                  </Button>
                </div>
              </Card>
            );
          })}

          <div style={{ marginTop: spacing[8], marginBottom: spacing[16] }}>
            <p className="text-[13px] font-semibold mb-3" style={{ color: colors.muted }}>
              {editingId ? 'Edit plan' : 'New plan'}
            </p>
            <CoachPlanPackageEditor
              value={{
                name: composer.name,
                shortDescription: composer.shortDescription,
                includes: composer.includes,
                priceMajor: composer.priceMajor,
                interval: composer.interval,
                currency: composer.currency,
              }}
              onChange={mergeComposer}
              footerActions={
                <div className="flex flex-col gap-2">
                  {editingId ? (
                    <label className="flex items-center gap-2 px-1 py-2 text-[14px]" style={{ color: colors.text }}>
                      <input
                        type="checkbox"
                        checked={composer.active !== false}
                        onChange={(e) => mergeComposer({ active: e.target.checked })}
                      />
                      Active (show in checkout)
                    </label>
                  ) : null}
                  <Button variant="primary" onClick={handleSave} disabled={savingId !== null} style={{ width: '100%', minHeight: touchTargetMin }}>
                    {savingId !== null ? <Loader2 size={18} className="animate-spin" /> : null}
                    {editingId ? 'Save changes' : 'Create plan'}
                  </Button>
                  {editingId ? (
                    <Button variant="secondary" onClick={cancelEdit} style={{ width: '100%', minHeight: touchTargetMin }}>
                      Cancel
                    </Button>
                  ) : null}
                </div>
              }
            />
          </div>

          {!editingId && services.length > 0 && (
            <p className="text-center text-xs mb-4" style={{ color: colors.muted }}>
              <Plus size={12} className="inline mr-1" />
              Use the card above to add another package
            </p>
          )}
        </>
      )}
    </div>
  );
}
