import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import Card from '@/ui/Card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { impactLight } from '@/lib/haptics';
import { PageLoader } from '@/components/ui/LoadingState';
import {
  fetchNutritionTargetsPageContext,
  nutritionTargetsPageQueryKey,
  personalNutritionTargetsQueryKey,
  savePersonalNutritionTargets,
} from '@/lib/personalNutritionProfile';
import {
  MACRO_PRESETS,
  computePersonalMacroGrams,
  macroCaloriesFromGrams,
  rebalancePersonalMacros,
} from '@/lib/personalMacroSplit';
import { colors, shell, spacing, radii, touchTargetMin } from '@/ui/tokens';
import { formatCalories } from '@/lib/format';
import { ChevronDown, ChevronUp, Target } from 'lucide-react';

const DEFAULT_LOCKS = { protein: false, carbs: false, fats: false };

function applyRebalanceToSetters({
  totalCalories,
  weightKg,
  presetId,
  locks,
  grams,
  setProtein,
  setCarbs,
  setFats,
}) {
  const res = rebalancePersonalMacros({
    totalCalories,
    weightKg,
    presetId,
    locks,
    lockedGrams: grams,
  });
  if (!locks.protein) setProtein(String(res.protein_g));
  if (!locks.carbs) setCarbs(String(res.carbs_g));
  if (!locks.fats) setFats(String(res.fats_g));
}

/**
 * Targets + macro presets (shared by /nutrition-targets and Personal Nutrition hub).
 * @param {{ user: object, variant?: 'full'|'setup'|'compact', onSaved?: () => void }} props
 */
export default function PersonalNutritionTargetsPanel({ user, variant = 'full', onSaved }) {
  const queryClient = useQueryClient();
  const [calories, setCalories] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fats, setFats] = useState('');
  const [locks, setLocks] = useState(DEFAULT_LOCKS);
  const [presetId, setPresetId] = useState('balanced');
  const [hydrated, setHydrated] = useState(false);
  const [compactOpen, setCompactOpen] = useState(variant !== 'compact');
  const [caloriesFieldError, setCaloriesFieldError] = useState('');
  const [saveSuccessGlow, setSaveSuccessGlow] = useState(false);

  const latest = useRef({
    calories: '',
    protein: '',
    carbs: '',
    fats: '',
    locks: DEFAULT_LOCKS,
    presetId: 'balanced',
    weightKg: null,
  });
  const calDebounceRef = useRef(null);
  const hydrateKeyRef = useRef(null);

  const { data: pageData, isLoading } = useQuery({
    queryKey: nutritionTargetsPageQueryKey(user?.id),
    queryFn: () => fetchNutritionTargetsPageContext(user?.id),
    enabled: !!user?.id,
  });

  const merged = pageData?.merged ?? null;
  const weightKg = pageData?.weightKg ?? null;

  useLayoutEffect(() => {
    Object.assign(latest.current, {
      calories,
      protein,
      carbs,
      fats,
      locks,
      presetId,
      weightKg: weightKg ?? null,
    });
  }, [calories, protein, carbs, fats, locks, presetId, weightKg]);

  useEffect(() => {
    hydrateKeyRef.current = null;
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    if (isLoading) return;

    const key = merged
      ? `${merged.calories}|${merged.protein_g ?? ''}|${merged.carbs_g ?? ''}|${merged.fats_g ?? ''}`
      : 'empty';
    if (hydrateKeyRef.current === key) return;
    hydrateKeyRef.current = key;

    if (!merged) {
      setCalories('');
      setProtein('');
      setCarbs('');
      setFats('');
      setLocks(DEFAULT_LOCKS);
      setHydrated(true);
      return;
    }

    const calStr = merged.calories > 0 ? String(merged.calories) : '';
    const pStr = merged.protein_g != null && Number(merged.protein_g) > 0 ? String(merged.protein_g) : '';
    const cStr = merged.carbs_g != null && Number(merged.carbs_g) > 0 ? String(merged.carbs_g) : '';
    const fStr = merged.fats_g != null && Number(merged.fats_g) > 0 ? String(merged.fats_g) : '';

    setCalories(calStr);
    setProtein(pStr);
    setCarbs(cStr);
    setFats(fStr);

    const nextLocks = {
      protein: pStr !== '',
      carbs: cStr !== '',
      fats: fStr !== '',
    };
    setLocks(nextLocks);

    if (merged.calories > 0 && !pStr && !cStr && !fStr) {
      const m = computePersonalMacroGrams(merged.calories, pageData?.weightKg ?? null, 'balanced');
      setProtein(String(m.protein_g));
      setCarbs(String(m.carbs_g));
      setFats(String(m.fats_g));
      setLocks(DEFAULT_LOCKS);
    }

    setHydrated(true);
  }, [user?.id, isLoading, merged, pageData?.weightKg]);

  useEffect(() => {
    return () => {
      if (calDebounceRef.current) clearTimeout(calDebounceRef.current);
    };
  }, []);

  const runCalorieRebalance = useCallback(() => {
    const s = latest.current;
    const c = parseFloat(s.calories, 10);
    if (!s.calories?.trim() || !Number.isFinite(c) || c <= 0) return;
    const grams = {
      protein: parseFloat(s.protein, 10) || 0,
      carbs: parseFloat(s.carbs, 10) || 0,
      fats: parseFloat(s.fats, 10) || 0,
    };
    applyRebalanceToSetters({
      totalCalories: c,
      weightKg: s.weightKg,
      presetId: s.presetId,
      locks: s.locks,
      grams,
      setProtein,
      setCarbs,
      setFats,
    });
  }, []);

  const handleCaloriesChange = (v) => {
    setCalories(v);
    Object.assign(latest.current, { calories: v });
    if (calDebounceRef.current) clearTimeout(calDebounceRef.current);
    calDebounceRef.current = setTimeout(() => {
      const s = latest.current;
      const c = parseFloat(s.calories, 10);
      if (!s.calories?.trim() || !Number.isFinite(c) || c <= 0) return;
      const grams = {
        protein: parseFloat(s.protein, 10) || 0,
        carbs: parseFloat(s.carbs, 10) || 0,
        fats: parseFloat(s.fats, 10) || 0,
      };
      applyRebalanceToSetters({
        totalCalories: c,
        weightKg: s.weightKg,
        presetId: s.presetId,
        locks: s.locks,
        grams,
        setProtein,
        setCarbs,
        setFats,
      });
    }, 220);
  };

  const handleCaloriesBlur = () => {
    if (calDebounceRef.current) clearTimeout(calDebounceRef.current);
    runCalorieRebalance();
  };

  const handlePreset = (id) => {
    setPresetId(id);
    setLocks(DEFAULT_LOCKS);
    Object.assign(latest.current, { presetId: id, locks: { ...DEFAULT_LOCKS } });
    const s = latest.current;
    const c = parseFloat(s.calories, 10);
    if (!s.calories?.trim() || !Number.isFinite(c) || c <= 0) return;
    const m = computePersonalMacroGrams(c, s.weightKg, id);
    setProtein(String(m.protein_g));
    setCarbs(String(m.carbs_g));
    setFats(String(m.fats_g));
  };

  const handleProteinChange = (v) => {
    setProtein(v);
    const lockP = v.trim() !== '';
    setLocks((L) => {
      const next = { ...L, protein: lockP };
      Object.assign(latest.current, { protein: v, locks: next });
      return next;
    });
    const s = latest.current;
    const c = parseFloat(s.calories, 10);
    if (!s.calories?.trim() || !Number.isFinite(c) || c <= 0) return;
    if (!lockP) {
      const nextLocks = { ...s.locks, protein: false };
      Object.assign(latest.current, { locks: nextLocks });
      applyRebalanceToSetters({
        totalCalories: c,
        weightKg: s.weightKg,
        presetId: s.presetId,
        locks: nextLocks,
        lockedGrams: {
          protein: 0,
          carbs: parseFloat(s.carbs, 10) || 0,
          fats: parseFloat(s.fats, 10) || 0,
        },
        setProtein,
        setCarbs,
        setFats,
      });
      return;
    }
    const grams = {
      protein: parseFloat(v, 10) || 0,
      carbs: parseFloat(s.carbs, 10) || 0,
      fats: parseFloat(s.fats, 10) || 0,
    };
    const nextLocks = { ...s.locks, protein: true };
    applyRebalanceToSetters({
      totalCalories: c,
      weightKg: s.weightKg,
      presetId: s.presetId,
      locks: nextLocks,
      lockedGrams: grams,
      setProtein,
      setCarbs,
      setFats,
    });
  };

  const handleCarbsChange = (v) => {
    setCarbs(v);
    const lockC = v.trim() !== '';
    setLocks((L) => {
      const next = { ...L, carbs: lockC };
      Object.assign(latest.current, { carbs: v, locks: next });
      return next;
    });
    const s = latest.current;
    const c = parseFloat(s.calories, 10);
    if (!s.calories?.trim() || !Number.isFinite(c) || c <= 0) return;
    if (!lockC) {
      const nextLocks = { ...s.locks, carbs: false };
      Object.assign(latest.current, { locks: nextLocks });
      applyRebalanceToSetters({
        totalCalories: c,
        weightKg: s.weightKg,
        presetId: s.presetId,
        locks: nextLocks,
        lockedGrams: {
          protein: parseFloat(s.protein, 10) || 0,
          carbs: 0,
          fats: parseFloat(s.fats, 10) || 0,
        },
        setProtein,
        setCarbs,
        setFats,
      });
      return;
    }
    const grams = {
      protein: parseFloat(s.protein, 10) || 0,
      carbs: parseFloat(v, 10) || 0,
      fats: parseFloat(s.fats, 10) || 0,
    };
    const nextLocks = { ...s.locks, carbs: true };
    applyRebalanceToSetters({
      totalCalories: c,
      weightKg: s.weightKg,
      presetId: s.presetId,
      locks: nextLocks,
      lockedGrams: grams,
      setProtein,
      setCarbs,
      setFats,
    });
  };

  const handleFatsChange = (v) => {
    setFats(v);
    const lockF = v.trim() !== '';
    setLocks((L) => {
      const next = { ...L, fats: lockF };
      Object.assign(latest.current, { fats: v, locks: next });
      return next;
    });
    const s = latest.current;
    const c = parseFloat(s.calories, 10);
    if (!s.calories?.trim() || !Number.isFinite(c) || c <= 0) return;
    if (!lockF) {
      const nextLocks = { ...s.locks, fats: false };
      Object.assign(latest.current, { locks: nextLocks });
      applyRebalanceToSetters({
        totalCalories: c,
        weightKg: s.weightKg,
        presetId: s.presetId,
        locks: nextLocks,
        lockedGrams: {
          protein: parseFloat(s.protein, 10) || 0,
          carbs: parseFloat(s.carbs, 10) || 0,
          fats: 0,
        },
        setProtein,
        setCarbs,
        setFats,
      });
      return;
    }
    const grams = {
      protein: parseFloat(s.protein, 10) || 0,
      carbs: parseFloat(s.carbs, 10) || 0,
      fats: parseFloat(v, 10) || 0,
    };
    const nextLocks = { ...s.locks, fats: true };
    applyRebalanceToSetters({
      totalCalories: c,
      weightKg: s.weightKg,
      presetId: s.presetId,
      locks: nextLocks,
      lockedGrams: grams,
      setProtein,
      setCarbs,
      setFats,
    });
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      setCaloriesFieldError('');
      const c = parseFloat(calories, 10);
      if (!calories?.trim() || !Number.isFinite(c) || c <= 0) {
        setCaloriesFieldError('Add a daily calorie target to continue.');
        throw new Error('validation');
      }
      const payload = {
        target_calories: c,
        target_protein_g: protein ? parseFloat(protein, 10) : null,
        target_carbs_g: carbs ? parseFloat(carbs, 10) : null,
        target_fats_g: fats ? parseFloat(fats, 10) : null,
      };
      return savePersonalNutritionTargets(user.id, payload);
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: personalNutritionTargetsQueryKey(user.id) });
      queryClient.invalidateQueries({ queryKey: nutritionTargetsPageQueryKey(user.id) });
      const msg = res?.remote === false ? 'Saved on this device' : 'Targets set. You’re ready to log.';
      toast.success(msg);
      impactLight();
      setSaveSuccessGlow(true);
      window.setTimeout(() => setSaveSuccessGlow(false), 1400);
      if (variant === 'compact') setCompactOpen(false);
      onSaved?.();
    },
    onError: (err) => {
      if (err?.message === 'validation' || err?.message === 'Enter a daily calorie target') return;
      toast.error(err?.message || 'Could not save targets');
    },
  });

  const calNum = parseFloat(calories, 10);
  const allLocked = locks.protein && locks.carbs && locks.fats;
  const macroKcal =
    allLocked && Number.isFinite(calNum) && calNum > 0
      ? macroCaloriesFromGrams(
          parseFloat(protein, 10) || 0,
          parseFloat(carbs, 10) || 0,
          parseFloat(fats, 10) || 0
        )
      : null;

  if (!user?.id) return null;
  if (isLoading) {
    return <PageLoader message="Loading targets…" />;
  }

  const setupHint =
    variant === 'setup' ? (
      <p style={{ margin: `0 0 ${spacing[12]}px`, fontSize: 13, color: colors.muted, lineHeight: 1.45 }}>
        Enter calories — macros auto-fill from your preset (and bodyweight when we have it). Edit any number anytime. You can log meals below whenever you’re ready.
      </p>
    ) : null;

  const compactSummary =
    variant === 'compact' && merged && merged.calories > 0 ? (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: spacing[12],
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing[10], minWidth: 0 }}>
          <span
            style={{
              width: 36,
              height: 36,
              borderRadius: radii.md,
              background: colors.primarySubtle,
              color: colors.primary,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Target size={18} />
          </span>
          <div style={{ minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: colors.text, lineHeight: 1.35 }}>
              Daily targets: {formatCalories(merged.calories)}
              {merged.protein_g != null && Number(merged.protein_g) > 0 ? ` · P ${Math.round(Number(merged.protein_g))}g` : ''}
              {merged.carbs_g != null && Number(merged.carbs_g) > 0 ? ` · C ${Math.round(Number(merged.carbs_g))}g` : ''}
              {merged.fats_g != null && Number(merged.fats_g) > 0 ? ` · F ${Math.round(Number(merged.fats_g))}g` : ''}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setCompactOpen((o) => !o)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            minHeight: touchTargetMin - 4,
            padding: `0 ${spacing[12]}px`,
            borderRadius: radii.button,
            border: `1px solid ${colors.border}`,
            background: 'transparent',
            color: colors.text,
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          {compactOpen ? 'Collapse' : 'Adjust'}
          {compactOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
      </div>
    ) : null;

  const showForm = variant !== 'compact' || compactOpen || !merged;

  return (
    <Card
      style={{
        padding: spacing[20],
        border: `1px solid ${shell.cardBorder}`,
        boxShadow: saveSuccessGlow ? '0 0 0 1px rgba(59,130,246,0.45), 0 8px 32px rgba(59,130,246,0.2)' : undefined,
        transition: 'box-shadow 0.35s ease',
      }}
    >
      {variant === 'setup' ? (
        <h2 style={{ margin: `0 0 ${spacing[10]}px`, fontSize: 16, fontWeight: 700, color: colors.text }}>1 · Targets</h2>
      ) : null}
      {variant === 'compact' && compactSummary && !compactOpen ? (
        compactSummary
      ) : (
        <>
          {variant === 'compact' && compactSummary && compactOpen ? (
            <div style={{ marginBottom: spacing[14] }}>{compactSummary}</div>
          ) : null}
          {setupHint}
          {showForm ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: spacing[14] }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: colors.muted }}>Calories (kcal) *</span>
                <Input
                  type="number"
                  inputMode="numeric"
                  value={calories}
                  onChange={(e) => {
                    setCaloriesFieldError('');
                    handleCaloriesChange(e.target.value);
                  }}
                  onBlur={handleCaloriesBlur}
                  placeholder="e.g. 2200"
                  aria-invalid={!!caloriesFieldError}
                  style={{
                    background: colors.surface2,
                    borderColor: caloriesFieldError ? colors.warning : shell.cardBorder,
                    minHeight: touchTargetMin,
                  }}
                />
                {caloriesFieldError ? (
                  <span style={{ fontSize: 12, color: colors.warning, marginTop: 4 }}>{caloriesFieldError}</span>
                ) : null}
              </label>

              <div style={{ display: 'flex', flexDirection: 'column', gap: spacing[8] }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: colors.muted }}>Macro split</span>
                <div
                  role="tablist"
                  aria-label="Macro split preset"
                  style={{ display: 'flex', flexWrap: 'wrap', gap: spacing[8] }}
                >
                  {Object.values(MACRO_PRESETS).map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      role="tab"
                      aria-selected={presetId === p.id}
                      onClick={() => handlePreset(p.id)}
                      style={{
                        minHeight: touchTargetMin - 4,
                        padding: `0 ${spacing[12]}px`,
                        borderRadius: radii.button,
                        border: `1px solid ${presetId === p.id ? colors.primary : colors.border}`,
                        background: presetId === p.id ? `${colors.primary}22` : 'transparent',
                        color: colors.text,
                        fontSize: 13,
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              <p style={{ margin: 0, fontSize: 12, color: colors.muted, lineHeight: 1.45 }}>
                Calories drive the budget; presets set sensible protein, carbs, and fats. Override any field — it stays yours until you change it.
              </p>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(92px, 1fr))',
                  gap: spacing[10],
                }}
              >
                <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: colors.muted }}>
                    Protein (g){locks.protein ? ' · custom' : ''}
                  </span>
                  <Input
                    type="number"
                    inputMode="decimal"
                    value={protein}
                    onChange={(e) => handleProteinChange(e.target.value)}
                    placeholder="—"
                    style={{ background: colors.surface2, borderColor: shell.cardBorder, minHeight: touchTargetMin }}
                  />
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: colors.muted }}>
                    Carbs (g){locks.carbs ? ' · custom' : ''}
                  </span>
                  <Input
                    type="number"
                    inputMode="decimal"
                    value={carbs}
                    onChange={(e) => handleCarbsChange(e.target.value)}
                    placeholder="—"
                    style={{ background: colors.surface2, borderColor: shell.cardBorder, minHeight: touchTargetMin }}
                  />
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: colors.muted }}>
                    Fats (g){locks.fats ? ' · custom' : ''}
                  </span>
                  <Input
                    type="number"
                    inputMode="decimal"
                    value={fats}
                    onChange={(e) => handleFatsChange(e.target.value)}
                    placeholder="—"
                    style={{ background: colors.surface2, borderColor: shell.cardBorder, minHeight: touchTargetMin }}
                  />
                </label>
              </div>

              {allLocked && macroKcal != null && Number.isFinite(calNum) ? (
                <p style={{ margin: 0, fontSize: 12, color: colors.muted }}>
                  Macros add up to ~{Math.round(macroKcal)} kcal (target {formatCalories(calories || 0)}).
                </p>
              ) : null}
            </div>
          ) : null}

          {showForm ? (
            <motion.div whileTap={{ scale: 0.97 }} style={{ width: '100%', marginTop: spacing[18] }}>
              <Button
                type="button"
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending || !hydrated}
                style={{
                  width: '100%',
                  minHeight: touchTargetMin + 4,
                  background: colors.primary,
                  boxShadow: saveSuccessGlow ? '0 4px 24px rgba(59,130,246,0.45)' : undefined,
                  transition: 'box-shadow 0.3s ease',
                }}
              >
                {saveMutation.isPending ? 'Saving…' : 'Save targets'}
              </Button>
            </motion.div>
          ) : null}
        </>
      )}
    </Card>
  );
}
