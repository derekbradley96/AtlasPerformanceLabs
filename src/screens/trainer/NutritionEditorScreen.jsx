/**
 * Nutrition editor: client-specific plan form. Upserts to public.nutrition_plans.
 * Route: /coach/nutrition/:clientId (legacy /trainer/nutrition/* redirects here).
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { useData } from '@/data/useData';
import { supabase, hasSupabase } from '@/lib/supabaseClient';
import { getDefaultDietType, canChooseDietType, getStarterMacros } from '@/lib/nutritionDefaults';
import { impactLight } from '@/lib/haptics';
import Card from '@/ui/Card';
import Button from '@/ui/Button';
import { colors, spacing, touchTargetMin } from '@/ui/tokens';
import { safeFormatDate } from '@/lib/format';
import { toast } from 'sonner';

const inputBase = {
  width: '100%',
  padding: `${spacing[12]}px ${spacing[16]}px`,
  borderRadius: 12,
  fontSize: 15,
  background: 'rgba(255,255,255,0.06)',
  border: `1px solid ${colors.border}`,
  color: colors.text,
};

export default function NutritionEditorScreen() {
  const { clientId } = useParams();
  const navigate = useNavigate();
  const { profile, supabaseUser, coachType } = useAuth();
  const data = useData();
  const trainerId = profile?.id ?? supabaseUser?.id ?? null;

  const [client, setClient] = useState(null);
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  const [dietType, setDietType] = useState('lifestyle');
  const [phase, setPhase] = useState('');
  const [calories, setCalories] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fats, setFats] = useState('');
  const [refeedDay, setRefeedDay] = useState(false);
  const [peakWeek, setPeakWeek] = useState(false);
  const [checkinAdjustment, setCheckinAdjustment] = useState('');
  const [notes, setNotes] = useState('');

  const effectiveCoachType = coachType ?? profile?.coach_type ?? null;
  const canChoose = canChooseDietType(effectiveCoachType);
  const defaultDiet = getDefaultDietType(effectiveCoachType);
  const transformationStarter = getStarterMacros('lifestyle');

  const loadClient = useCallback(async () => {
    if (!data?.getClient || !clientId) return null;
    try {
      const c = await data.getClient(clientId);
      return c ?? null;
    } catch {
      return null;
    }
  }, [data, clientId]);

  const loadPlan = useCallback(async () => {
    if (!hasSupabase || !supabase || !trainerId || !clientId) return null;
    try {
      let q = supabase
        .from('nutrition_plans')
        .select('*')
        .eq('trainer_id', trainerId)
        .eq('client_id', clientId)
        .order('created_at', { ascending: false });
      const { data: rows, error: err } = await q;
      if (err) throw err;
      const list = Array.isArray(rows) ? rows : [];
      const active = list.find((r) => r.is_active === true) ?? list[0] ?? null;
      return active;
    } catch {
      return null;
    }
  }, [trainerId, clientId]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      const [c, p] = await Promise.all([loadClient(), loadPlan()]);
      if (cancelled) return;
      setClient(c);
      setPlan(p);
      if (p) {
        setDietType(p.diet_type === 'prep' ? 'prep' : 'lifestyle');
        setPhase(p.phase ?? '');
        setCalories(p.calories != null ? String(p.calories) : '');
        setProtein(p.protein != null ? String(p.protein) : '');
        setCarbs(p.carbs != null ? String(p.carbs) : '');
        setFats(p.fats != null ? String(p.fats) : '');
        setRefeedDay(!!p.refeed_day);
        setPeakWeek(!!p.peak_week);
        setCheckinAdjustment(p.checkin_adjustment ?? '');
        setNotes(p.notes ?? '');
      } else {
        const starter = getStarterMacros(defaultDiet);
        setDietType(defaultDiet);
        setPhase('');
        setCalories(String(starter.calories));
        setProtein(String(starter.protein));
        setCarbs(String(starter.carbs));
        setFats(String(starter.fats));
        setRefeedDay(false);
        setPeakWeek(false);
        setCheckinAdjustment('');
        setNotes('');
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [clientId, loadClient, loadPlan, defaultDiet]);

  const handleSave = useCallback(async () => {
    if (!trainerId || !clientId || !hasSupabase || !supabase) {
      toast.error('Not signed in or Supabase not configured');
      return;
    }
    impactLight();
    setSaving(true);
    setError(null);
    try {
      const payload = {
        client_id: clientId,
        trainer_id: trainerId,
        diet_type: dietType,
        phase: phase || null,
        calories: calories ? parseInt(calories, 10) : null,
        protein: protein ? parseInt(protein, 10) : null,
        carbs: carbs ? parseInt(carbs, 10) : null,
        fats: fats ? parseInt(fats, 10) : null,
        refeed_day: refeedDay,
        peak_week: peakWeek,
        checkin_adjustment: checkinAdjustment || null,
        notes: notes || null,
      };
      let planId = plan?.id;
      if (planId) {
        const { error: err } = await supabase.from('nutrition_plans').update(payload).eq('id', planId);
        if (err) throw err;
      } else {
        const { data: inserted, error: insertErr } = await supabase.from('nutrition_plans').insert(payload).select('id').single();
        if (insertErr) throw insertErr;
        planId = inserted?.id;
      }
      if (planId) {
        try {
          await supabase.from('nutrition_plans').update({ is_active: false }).eq('client_id', clientId).neq('id', planId);
          await supabase.from('nutrition_plans').update({ is_active: true }).eq('id', planId);
        } catch (_) {
          // is_active column may not exist; ignore
        }
      }
      toast.success('Plan saved');
      setPlan((prev) => (prev ? { ...prev, ...payload } : { id: null, ...payload }));
    } catch (e) {
      const msg = e?.message ?? 'Failed to save';
      setError(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }, [trainerId, clientId, plan, dietType, phase, calories, protein, carbs, fats, refeedDay, peakWeek, checkinAdjustment, notes]);

  const handleCopyPreviousPlan = useCallback(async () => {
    if (!trainerId || !clientId || !hasSupabase || !supabase) return;
    setSaving(true);
    setError(null);
    try {
      const { data: rows, error: err } = await supabase
        .from('nutrition_plans')
        .select('*')
        .eq('trainer_id', trainerId)
        .neq('client_id', clientId)
        .order('updated_at', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(1);
      if (err) throw err;
      const source = Array.isArray(rows) ? rows[0] : null;
      if (!source) {
        toast.error('No previous nutrition plan found to copy');
        return;
      }
      setDietType(source.diet_type === 'prep' ? 'prep' : 'lifestyle');
      setPhase(source.phase ?? '');
      setCalories(source.calories != null ? String(source.calories) : '');
      setProtein(source.protein != null ? String(source.protein) : '');
      setCarbs(source.carbs != null ? String(source.carbs) : '');
      setFats(source.fats != null ? String(source.fats) : '');
      setRefeedDay(!!source.refeed_day);
      setPeakWeek(!!source.peak_week);
      setCheckinAdjustment(source.checkin_adjustment ?? '');
      setNotes(source.notes ?? '');
      toast.success('Copied previous plan values');
    } catch (e) {
      toast.error(e?.message || 'Could not copy previous plan');
    } finally {
      setSaving(false);
    }
  }, [trainerId, clientId]);

  if (!trainerId) {
    return (
      <div className="app-screen min-w-0 max-w-full overflow-x-hidden" style={{ padding: spacing[24] }}>
        <p className="text-sm" style={{ color: colors.muted }}>Loading…</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="app-screen min-w-0 max-w-full overflow-x-hidden" style={{ padding: spacing[24] }}>
        <div className="py-8 text-center text-sm" style={{ color: colors.muted }}>Loading…</div>
      </div>
    );
  }

  const clientName = client?.full_name || client?.name || 'Client';

  return (
    <div className="app-screen min-w-0 max-w-full overflow-x-hidden">
      <div style={{ padding: spacing[16], paddingBottom: spacing[24] }}>
        <h1 className="text-[22px] font-semibold mb-1" style={{ color: colors.text }}>
          {clientName}
        </h1>
        <p className="text-sm mb-4" style={{ color: colors.muted }}>
          Nutrition plan
        </p>
        {(plan?.updated_at || plan?.created_at) && (
          <p className="text-xs mb-4" style={{ color: colors.muted }}>
            Last updated {safeFormatDate(plan.updated_at || plan.created_at)}
          </p>
        )}
        <Card style={{ padding: spacing[12], marginBottom: spacing[12] }}>
          <p className="text-xs" style={{ color: colors.muted, margin: 0 }}>
            Saving this plan sets it as the active nutrition plan for this client.
          </p>
        </Card>

        {error && (
          <div className="mb-4 p-3 rounded-xl" style={{ background: 'rgba(239,68,68,0.12)', color: colors.destructive }}>
            {error}
          </div>
        )}

        <Card style={{ padding: spacing[16], marginBottom: spacing[16] }}>
          <label className="block text-xs font-medium mb-2" style={{ color: colors.muted }}>Diet type</label>
          <div className="flex rounded-xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)', border: `1px solid ${colors.border}` }}>
            <button
              type="button"
              onClick={() => canChoose && (impactLight(), setDietType('lifestyle'))}
              disabled={!canChoose}
              className="flex-1 py-3 text-sm font-medium"
              style={{
                minHeight: touchTargetMin,
                background: dietType === 'lifestyle' ? 'rgba(37, 99, 235, 0.2)' : 'transparent',
                color: dietType === 'lifestyle' ? colors.accent : colors.muted,
              }}
            >
              Lifestyle
            </button>
            <button
              type="button"
              onClick={() => canChoose && (impactLight(), setDietType('prep'))}
              disabled={!canChoose}
              className="flex-1 py-3 text-sm font-medium"
              style={{
                minHeight: touchTargetMin,
                background: dietType === 'prep' ? 'rgba(37, 99, 235, 0.2)' : 'transparent',
                color: dietType === 'prep' ? colors.accent : colors.muted,
              }}
            >
              Prep
            </button>
          </div>
        </Card>

        <Card style={{ padding: spacing[16], marginBottom: spacing[16] }}>
          <label className="block text-xs font-medium mb-2" style={{ color: colors.muted }}>Phase (optional)</label>
          <input
            type="text"
            value={phase}
            onChange={(e) => setPhase(e.target.value)}
            placeholder="e.g. Cut week 4"
            style={inputBase}
          />
        </Card>

        <Card style={{ padding: spacing[16], marginBottom: spacing[16] }}>
          <p className="text-xs font-medium mb-3" style={{ color: colors.muted }}>Macros</p>
          <div className="flex flex-wrap gap-2 mb-3">
            <button
              type="button"
              onClick={() => {
                setCalories(String(transformationStarter.calories));
                setProtein(String(transformationStarter.protein));
                setCarbs(String(transformationStarter.carbs));
                setFats(String(transformationStarter.fats));
              }}
              className="text-xs px-3 py-1.5 rounded-full"
              style={{ border: `1px solid ${colors.border}`, color: colors.text, background: colors.surface2 }}
            >
              Apply transformation starter
            </button>
            <button
              type="button"
              onClick={() => {
                const cals = Math.max(1000, Number(calories || transformationStarter.calories) - 200);
                setCalories(String(cals));
              }}
              className="text-xs px-3 py-1.5 rounded-full"
              style={{ border: `1px solid ${colors.border}`, color: colors.text, background: colors.surface2 }}
            >
              Quick cut -200 kcal
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {['calories', 'protein', 'carbs', 'fats'].map((key) => {
              const val = key === 'calories' ? calories : key === 'protein' ? protein : key === 'carbs' ? carbs : fats;
              const setVal = key === 'calories' ? setCalories : key === 'protein' ? setProtein : key === 'carbs' ? setCarbs : setFats;
              const label = key.charAt(0).toUpperCase() + key.slice(1);
              return (
                <div key={key}>
                  <label className="block text-[11px] mb-1" style={{ color: colors.muted }}>{label}</label>
                  <input
                    type="number"
                    inputMode="numeric"
                    value={val}
                    onChange={(e) => setVal(e.target.value)}
                    style={inputBase}
                  />
                </div>
              );
            })}
          </div>
        </Card>

        <Card style={{ padding: spacing[16], marginBottom: spacing[16] }}>
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={refeedDay} onChange={(e) => setRefeedDay(e.target.checked)} style={{ accentColor: colors.accent }} />
              <span className="text-sm" style={{ color: colors.text }}>Refeed day</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={peakWeek} onChange={(e) => setPeakWeek(e.target.checked)} style={{ accentColor: colors.accent }} />
              <span className="text-sm" style={{ color: colors.text }}>Peak week</span>
            </label>
          </div>
        </Card>

        <Card style={{ padding: spacing[16], marginBottom: spacing[16] }}>
          <label className="block text-xs font-medium mb-2" style={{ color: colors.muted }}>Check-in adjustment</label>
          <textarea
            value={checkinAdjustment}
            onChange={(e) => setCheckinAdjustment(e.target.value)}
            placeholder="If check-in is off-plan, adjust by …"
            rows={3}
            className="resize-none w-full focus:outline-none focus:ring-1 rounded-xl"
            style={{ ...inputBase, minHeight: 80 }}
          />
        </Card>

        <Card style={{ padding: spacing[16], marginBottom: spacing[16] }}>
          <label className="block text-xs font-medium mb-2" style={{ color: colors.muted }}>Notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Optional notes"
            rows={3}
            className="resize-none w-full focus:outline-none focus:ring-1 rounded-xl"
            style={{ ...inputBase, minHeight: 80 }}
          />
        </Card>

        <Button variant="secondary" onClick={handleCopyPreviousPlan} disabled={saving} style={{ width: '100%', minHeight: 44, marginBottom: spacing[12] }}>
          Copy previous nutrition plan
        </Button>

        <Button variant="primary" onClick={handleSave} disabled={saving} style={{ width: '100%', minHeight: 48 }}>
          {saving ? 'Saving…' : 'Save plan'}
        </Button>
      </div>
    </div>
  );
}
