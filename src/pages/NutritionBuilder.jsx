import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Save, Calculator } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PageLoader } from '@/components/ui/LoadingState';
import { toast } from 'sonner';
import NotAuthorized from '@/components/NotAuthorized';
import { hasRole, Roles } from '@/lib/roles';
import { getSupabase, hasSupabase } from '@/lib/supabaseClient';
import { getActiveNutritionPlan, upsertNutritionPlan } from '@/data/nutritionPlansService';
import { trackFirstNutritionPlanCreated } from '@/services/firstSessionTracker';

export default function NutritionBuilder() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, effectiveRole } = useAuth();
  const [searchParams] = useSearchParams();
  const clientId = searchParams.get('clientId');
  const trainerId = user?.id ?? null;

  const [formData, setFormData] = useState({
    plan_type: 'macros',
    experience_level: 'intermediate',
    sex: 'male',
    height_cm: '',
    weight_kg: '',
    age: '',
    activity_level: 'moderately_active',
    goal: 'maintain',
    target_calories: '',
    protein_g: '',
    protein_percent: 30,
    carbs_g: '',
    carbs_percent: 40,
    fats_g: '',
    fats_percent: 30,
    trainer_notes: '',
  });

  const planHydratedRef = useRef(false);
  useEffect(() => {
    planHydratedRef.current = false;
  }, [clientId]);

  const { data: clientRow, isLoading: clientLoading, error: clientError } = useQuery({
    queryKey: ['nutrition-builder-client', clientId, trainerId],
    queryFn: async () => {
      if (!hasSupabase || !clientId || !trainerId) return null;
      const supabase = getSupabase();
      if (!supabase) return null;
      const { data, error } = await supabase
        .from('clients')
        .select('id, name, full_name, trainer_id, coach_id')
        .eq('id', clientId)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const mine = data.trainer_id === trainerId || data.coach_id === trainerId;
      if (!mine) throw new Error('This client is not on your roster.');
      return data;
    },
    enabled: !!clientId && !!trainerId && hasSupabase,
  });

  const { data: activePlan, isLoading: planLoading } = useQuery({
    queryKey: ['nutrition-plan-active', trainerId, clientId],
    queryFn: () => getActiveNutritionPlan(trainerId, clientId),
    enabled: !!clientId && !!trainerId && hasSupabase,
  });

  useEffect(() => {
    if (!activePlan || planHydratedRef.current) return;
    planHydratedRef.current = true;
    const im =
      activePlan.intake_metrics && typeof activePlan.intake_metrics === 'object'
        ? activePlan.intake_metrics
        : {};
    setFormData((prev) => ({
      ...prev,
      target_calories: activePlan.calories != null ? activePlan.calories : prev.target_calories,
      protein_g: activePlan.protein != null ? activePlan.protein : prev.protein_g,
      carbs_g: activePlan.carbs != null ? activePlan.carbs : prev.carbs_g,
      fats_g: activePlan.fats != null ? activePlan.fats : prev.fats_g,
      trainer_notes: activePlan.notes != null ? String(activePlan.notes) : prev.trainer_notes,
      goal:
        activePlan.diet_type === 'cut' || activePlan.diet_type === 'bulk' || activePlan.diet_type === 'maintain'
          ? activePlan.diet_type
          : prev.goal,
      sex: typeof im.sex === 'string' ? im.sex : prev.sex,
      age: im.age != null && im.age !== '' ? String(im.age) : prev.age,
      height_cm: im.height_cm != null && im.height_cm !== '' ? String(im.height_cm) : prev.height_cm,
      weight_kg: im.weight_kg != null && im.weight_kg !== '' ? String(im.weight_kg) : prev.weight_kg,
      activity_level: typeof im.activity_level === 'string' ? im.activity_level : prev.activity_level,
      protein_percent: typeof im.protein_percent === 'number' ? im.protein_percent : prev.protein_percent,
      carbs_percent: typeof im.carbs_percent === 'number' ? im.carbs_percent : prev.carbs_percent,
      fats_percent: typeof im.fats_percent === 'number' ? im.fats_percent : prev.fats_percent,
      plan_type: typeof im.plan_type === 'string' ? im.plan_type : prev.plan_type,
      experience_level: typeof im.experience_level === 'string' ? im.experience_level : prev.experience_level,
    }));
  }, [activePlan]);

  const clientDisplayName =
    clientRow?.full_name?.trim() || clientRow?.name?.trim() || (clientId ? 'Client' : '');

  const calculateNutrition = () => {
    const { sex, height_cm, weight_kg, age, activity_level, goal } = formData;

    if (!height_cm || !weight_kg || !age) {
      toast.error('Please fill in all body metrics');
      return;
    }

    let bmr;
    if (sex === 'male') {
      bmr = 10 * parseFloat(weight_kg) + 6.25 * parseFloat(height_cm) - 5 * parseInt(age, 10) + 5;
    } else {
      bmr = 10 * parseFloat(weight_kg) + 6.25 * parseFloat(height_cm) - 5 * parseInt(age, 10) - 161;
    }

    const activityMultipliers = {
      sedentary: 1.2,
      lightly_active: 1.375,
      moderately_active: 1.55,
      very_active: 1.725,
      extra_active: 1.9,
    };

    const maintenance = Math.round(bmr * (activityMultipliers[activity_level] ?? 1.55));

    let target;
    if (goal === 'cut') target = Math.round(maintenance * 0.8);
    else if (goal === 'bulk') target = Math.round(maintenance * 1.1);
    else target = maintenance;

    const proteinCals = Math.round(target * (formData.protein_percent / 100));
    const carbsCals = Math.round(target * (formData.carbs_percent / 100));
    const fatsCals = Math.round(target * (formData.fats_percent / 100));

    const proteinG = Math.round(proteinCals / 4);
    const carbsG = Math.round(carbsCals / 4);
    const fatsG = Math.round(fatsCals / 9);

    setFormData({
      ...formData,
      target_calories: target,
      protein_g: proteinG,
      carbs_g: carbsG,
      fats_g: fatsG,
    });

    toast.success('Nutrition calculated');
  };

  const autoCalculateQuickSetup = () => {
    const weight = Number(formData.weight_kg);
    if (!Number.isFinite(weight) || weight <= 0) {
      toast.error('Enter bodyweight first for quick auto-calc.');
      return;
    }
    const goal = formData.goal;
    const exp = formData.experience_level;
    let kcalPerKg = 32;
    if (goal === 'cut') kcalPerKg = 27;
    if (goal === 'bulk') kcalPerKg = 36;
    if (exp === 'beginner') kcalPerKg += 1;
    if (exp === 'advanced') kcalPerKg -= 1;
    const target = Math.round(weight * kcalPerKg);
    const proteinMult = goal === 'cut' ? 2.2 : goal === 'bulk' ? 1.9 : 2.0;
    const fatMult = goal === 'cut' ? 0.7 : goal === 'bulk' ? 0.9 : 0.8;
    const proteinG = Math.round(weight * proteinMult);
    const fatsG = Math.max(35, Math.round(weight * fatMult));
    const carbsG = Math.max(40, Math.round((target - (proteinG * 4 + fatsG * 9)) / 4));
    setFormData((prev) => ({
      ...prev,
      target_calories: target,
      protein_g: proteinG,
      carbs_g: carbsG,
      fats_g: fatsG,
    }));
    toast.success('Quick setup auto-calculated');
  };

  const saveMutation = useMutation({
    mutationFn: async ({ planId }) => {
      if (!hasSupabase) throw new Error('Supabase is not configured');
      if (!trainerId || !clientId) throw new Error('Select a client to save this plan');
      const calories = Number(formData.target_calories);
      const protein = Number(formData.protein_g);
      const carbs = Number(formData.carbs_g);
      const fats = Number(formData.fats_g);
      if (!Number.isFinite(calories) || !Number.isFinite(protein) || !Number.isFinite(carbs) || !Number.isFinite(fats)) {
        throw new Error('Calculate or enter valid numbers for calories and macros');
      }
      const phase =
        formData.goal === 'cut' ? 'Cut' : formData.goal === 'bulk' ? 'Bulk' : 'Maintenance';
      const intake_metrics = {
        plan_type: formData.plan_type,
        experience_level: formData.experience_level,
        sex: formData.sex,
        age: formData.age === '' ? null : Number(formData.age),
        height_cm: formData.height_cm === '' ? null : Number(formData.height_cm),
        weight_kg: formData.weight_kg === '' ? null : Number(formData.weight_kg),
        activity_level: formData.activity_level,
        goal: formData.goal,
        protein_percent: formData.protein_percent,
        carbs_percent: formData.carbs_percent,
        fats_percent: formData.fats_percent,
        saved_at: new Date().toISOString(),
      };
      return upsertNutritionPlan({
        id: planId,
        client_id: clientId,
        trainer_id: trainerId,
        calories,
        protein,
        carbs,
        fats,
        notes: (formData.trainer_notes || '').trim() || null,
        phase,
        diet_type: formData.goal,
        intake_metrics,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['nutrition-plan-active', trainerId, clientId] });
      queryClient.invalidateQueries({ queryKey: ['nutrition-plan'] });
      queryClient.invalidateQueries({ queryKey: ['active-nutrition-plan'] });
      queryClient.invalidateQueries({ queryKey: ['today-active-nutrition-plan'] });
      queryClient.invalidateQueries({ queryKey: ['client-nutrition'] });
      if (trainerId) trackFirstNutritionPlanCreated(trainerId, { client_id: clientId });
      toast.success('Nutrition plan saved');
      if (clientId) navigate(`/clients/${clientId}`);
      else navigate(-1);
    },
    onError: (e) => {
      toast.error(e?.message ?? 'Failed to save');
    },
  });

  const handleSave = () => {
    if (!clientId) {
      toast.error('Open this screen with a client selected (from the client profile or add ?clientId=…)');
      return;
    }
    if (!formData.target_calories || !formData.protein_g || !formData.carbs_g || !formData.fats_g) {
      toast.error('Calculate nutrition first or enter calories and macros');
      return;
    }
    saveMutation.mutate({ planId: activePlan?.id });
  };

  if (!user) return <PageLoader message="Loading…" />;
  if (!hasRole(effectiveRole, [Roles.COACH, Roles.ADMIN])) return <NotAuthorized />;

  if (clientId && hasSupabase && (clientLoading || planLoading)) {
    return <PageLoader message="Loading plan…" hint="Fetching client and saved targets." />;
  }

  if (clientId && hasSupabase && clientError) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 gap-4">
        <p className="text-slate-400 text-center">{clientError?.message ?? 'Could not load client'}</p>
        <Button variant="outline" onClick={() => navigate('/clients')}>
          Back to Clients
        </Button>
      </div>
    );
  }

  if (clientId && hasSupabase && !clientLoading && !clientRow) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 gap-4">
        <p className="text-slate-400 text-center">Client not found or not linked to your account.</p>
        <Button variant="outline" onClick={() => navigate('/clients')}>
          Back to Clients
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 pb-24">
      <div className="sticky top-0 z-10 bg-slate-900/95 backdrop-blur border-b border-slate-800 p-4">
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="text-slate-400 hover:text-white flex items-center gap-2 rounded-lg shrink-0"
            style={{ minHeight: 44, minWidth: 44, padding: '0 8px' }}
            aria-label="Go back"
          >
            <ArrowLeft className="w-5 h-5 shrink-0" aria-hidden />
            <span className="text-sm font-medium">Back</span>
          </button>
          <Button
            onClick={handleSave}
            disabled={
              saveMutation.isPending || !hasSupabase || !clientId || (clientId && hasSupabase && !clientRow)
            }
            className="bg-blue-500 hover:bg-blue-600 min-h-11"
          >
            <Save className="w-4 h-4 mr-2 shrink-0" aria-hidden />
            Save plan
          </Button>
        </div>
      </div>

      <div className="p-4 md:p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">Nutrition plan builder</h1>
          <p className="text-slate-400 text-sm leading-relaxed">
            {!hasSupabase
              ? 'Connect Supabase to save plans. You can still use the calculator offline.'
              : clientId
                ? `Targets and calculator inputs for ${clientDisplayName} save to the active nutrition_plans row (intake_metrics + macros).`
                : 'Add ?clientId=… to the URL from a client profile, or open from the client’s page when linked.'}
          </p>
        </div>

        {!clientId && (
          <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-amber-100 text-sm">
            Select a client to enable saving. From a client profile, use a link that includes their ID, e.g.{' '}
            <span className="font-mono text-xs">/nutrition-builder?clientId=…</span>
          </div>
        )}

        <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Step 1: Select type</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {[
              { id: 'macros', label: 'Macros' },
              { id: 'meal_plan', label: 'Meal plan' },
              { id: 'hybrid', label: 'Hybrid' },
            ].map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setFormData((prev) => ({ ...prev, plan_type: opt.id }))}
                className="min-h-11 rounded-xl border text-sm font-semibold"
                style={{
                  background: formData.plan_type === opt.id ? 'rgba(59,130,246,0.14)' : 'rgba(15,23,42,0.5)',
                  borderColor: formData.plan_type === opt.id ? '#3B82F6' : 'rgba(148,163,184,0.22)',
                  color: '#fff',
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Body Metrics */}
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Step 2: Quick setup</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-white mb-2">Sex</label>
              <Select value={formData.sex} onValueChange={(v) => setFormData({ ...formData, sex: v })}>
                <SelectTrigger className="bg-slate-900/50 border-slate-700 min-h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="block text-sm font-medium text-white mb-2">Age</label>
              <Input
                type="number"
                value={formData.age}
                onChange={(e) => setFormData({ ...formData, age: e.target.value })}
                placeholder="25"
                className="bg-slate-900/50 border-slate-700 min-h-11"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-white mb-2">Height (cm)</label>
              <Input
                type="number"
                value={formData.height_cm}
                onChange={(e) => setFormData({ ...formData, height_cm: e.target.value })}
                placeholder="175"
                className="bg-slate-900/50 border-slate-700 min-h-11"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-white mb-2">Weight (kg)</label>
              <Input
                type="number"
                step="0.1"
                value={formData.weight_kg}
                onChange={(e) => setFormData({ ...formData, weight_kg: e.target.value })}
                placeholder="75.5"
                className="bg-slate-900/50 border-slate-700 min-h-11"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-white mb-2">Activity level</label>
              <Select
                value={formData.activity_level}
                onValueChange={(v) => setFormData({ ...formData, activity_level: v })}
              >
                <SelectTrigger className="bg-slate-900/50 border-slate-700 min-h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sedentary">Sedentary (little/no exercise)</SelectItem>
                  <SelectItem value="lightly_active">Lightly active (1–3 days/week)</SelectItem>
                  <SelectItem value="moderately_active">Moderately active (3–5 days/week)</SelectItem>
                  <SelectItem value="very_active">Very active (6–7 days/week)</SelectItem>
                  <SelectItem value="extra_active">Extra active (2× per day)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="block text-sm font-medium text-white mb-2">Goal</label>
              <Select value={formData.goal} onValueChange={(v) => setFormData({ ...formData, goal: v })}>
                <SelectTrigger className="bg-slate-900/50 border-slate-700 min-h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cut">Fat loss (~20% deficit)</SelectItem>
                  <SelectItem value="maintain">Maintain weight</SelectItem>
                  <SelectItem value="bulk">Muscle gain (~10% surplus)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-sm font-medium text-white mb-2">Experience</label>
              <Select
                value={formData.experience_level}
                onValueChange={(v) => setFormData({ ...formData, experience_level: v })}
              >
                <SelectTrigger className="bg-slate-900/50 border-slate-700 min-h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="beginner">Beginner</SelectItem>
                  <SelectItem value="intermediate">Intermediate</SelectItem>
                  <SelectItem value="advanced">Advanced</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-6">
            <Button
              type="button"
              onClick={autoCalculateQuickSetup}
              className="w-full bg-blue-500 hover:bg-blue-600 min-h-11 text-[15px] font-semibold"
            >
              <Calculator className="w-4 h-4 mr-2 shrink-0" aria-hidden />
              Auto-calculate
            </Button>
            <Button
              type="button"
              onClick={calculateNutrition}
              className="w-full bg-green-500 hover:bg-green-600 min-h-11 text-[15px] font-semibold"
            >
              <Calculator className="w-4 h-4 mr-2 shrink-0" aria-hidden />
              Full calculator
            </Button>
          </div>
        </div>

        {/* Calculated Targets */}
        {formData.target_calories ? (
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Targets (editable)</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-white mb-2">Daily calories</label>
                <Input
                  type="number"
                  value={formData.target_calories}
                  onChange={(e) =>
                    setFormData({ ...formData, target_calories: parseInt(e.target.value, 10) || '' })
                  }
                  className="bg-slate-900/50 border-slate-700 min-h-11"
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-white mb-2">Protein (%)</label>
                  <Input
                    type="number"
                    value={formData.protein_percent}
                    onChange={(e) => {
                      const percent = parseInt(e.target.value, 10);
                      const tc = Number(formData.target_calories) || 0;
                      const grams = tc ? Math.round((tc * (percent / 100)) / 4) : '';
                      setFormData({ ...formData, protein_percent: percent, protein_g: grams });
                    }}
                    className="bg-slate-900/50 border-slate-700 mb-2 min-h-11"
                  />
                  <Input
                    type="number"
                    value={formData.protein_g}
                    onChange={(e) =>
                      setFormData({ ...formData, protein_g: parseInt(e.target.value, 10) || '' })
                    }
                    placeholder="g"
                    className="bg-slate-900/50 border-slate-700 min-h-11"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-white mb-2">Carbs (%)</label>
                  <Input
                    type="number"
                    value={formData.carbs_percent}
                    onChange={(e) => {
                      const percent = parseInt(e.target.value, 10);
                      const tc = Number(formData.target_calories) || 0;
                      const grams = tc ? Math.round((tc * (percent / 100)) / 4) : '';
                      setFormData({ ...formData, carbs_percent: percent, carbs_g: grams });
                    }}
                    className="bg-slate-900/50 border-slate-700 mb-2 min-h-11"
                  />
                  <Input
                    type="number"
                    value={formData.carbs_g}
                    onChange={(e) =>
                      setFormData({ ...formData, carbs_g: parseInt(e.target.value, 10) || '' })
                    }
                    placeholder="g"
                    className="bg-slate-900/50 border-slate-700 min-h-11"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-white mb-2">Fats (%)</label>
                  <Input
                    type="number"
                    value={formData.fats_percent}
                    onChange={(e) => {
                      const percent = parseInt(e.target.value, 10);
                      const tc = Number(formData.target_calories) || 0;
                      const grams = tc ? Math.round((tc * (percent / 100)) / 9) : '';
                      setFormData({ ...formData, fats_percent: percent, fats_g: grams });
                    }}
                    className="bg-slate-900/50 border-slate-700 mb-2 min-h-11"
                  />
                  <Input
                    type="number"
                    value={formData.fats_g}
                    onChange={(e) =>
                      setFormData({ ...formData, fats_g: parseInt(e.target.value, 10) || '' })
                    }
                    placeholder="g"
                    className="bg-slate-900/50 border-slate-700 min-h-11"
                  />
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {/* Trainer Notes */}
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Notes for client</h2>
          <Textarea
            value={formData.trainer_notes}
            onChange={(e) => setFormData({ ...formData, trainer_notes: e.target.value })}
            placeholder="e.g. High carbs on training days, hit protein daily…"
            className="bg-slate-900/50 border-slate-700"
            rows={4}
          />
        </div>
      </div>
    </div>
  );
}
