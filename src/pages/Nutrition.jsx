import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/lib/emptyApi';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createPageUrl } from '@/utils';
import { Apple, Target, MessageSquare, UtensilsCrossed, Scale, TrendingUp, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PageLoader, EmptyState } from '@/components/ui/LoadingState';
import { motion } from 'framer-motion';
import MealLogForm from '@/components/nutrition/MealLogForm';
import DailyNutritionProgress from '@/components/nutrition/DailyNutritionProgress';
import MealLogList from '@/components/nutrition/MealLogList';
import CoachingUpgradeCard from '@/components/coaching/CoachingUpgradeCard';
import { useCoachingUpgradeTriggers } from '@/components/hooks/useCoachingUpgradeTriggers';
import { useAuth } from '@/lib/AuthContext';
import { toast } from 'sonner';
import { colors, shell, spacing } from '@/ui/tokens';
import Card from '@/ui/Card';

/** Trainer Nutrition placeholder: prep-native positioning + Coming soon cards */
function TrainerNutritionPlaceholder() {
  const cards = [
    { icon: Scale, title: 'Macros per phase', desc: 'Bulk, Cut & Peak Week targets' },
    { icon: UtensilsCrossed, title: 'Coach macro adjustments', desc: 'Update client macros by phase' },
    { icon: TrendingUp, title: 'Check-in weight vs macro correlation', desc: 'See trends across check-ins' },
    { icon: Zap, title: 'Peak week carb loading', desc: 'Protocols and timing' },
  ];
  return (
    <div
      className="min-h-screen min-w-0 max-w-full overflow-x-hidden"
      style={{
        background: colors.bg,
        paddingTop: spacing[16],
        paddingLeft: 'max(' + spacing[16] + 'px, env(safe-area-inset-left, 0px))',
        paddingRight: 'max(' + spacing[16] + 'px, env(safe-area-inset-right, 0px))',
        paddingBottom: 'calc(' + spacing[24] + 'px + env(safe-area-inset-bottom, 0px))',
      }}
    >
      <h1 className="text-[22px] font-bold mb-1" style={{ color: colors.text }}>Nutrition</h1>
      <p className="text-[14px] mb-6" style={{ color: colors.muted }}>Macros & meal plans</p>

      <section className="mb-8">
        <div
          className="rounded-[20px] border p-5"
          style={{ background: colors.card, borderColor: colors.border }}
        >
          <h2 className="text-[13px] font-semibold uppercase tracking-wider mb-3" style={{ color: colors.muted }}>Atlas nutrition is prep-native</h2>
          <p className="text-[15px] leading-relaxed mb-3" style={{ color: colors.text }}>
            Training and nutrition are inseparable—especially in bodybuilding and prep. Everfit treats nutrition as secondary. Atlas makes it prep-native: phases, check-ins, and peak week in one place.
          </p>
        </div>
      </section>

      <h2 className="text-[13px] font-semibold uppercase tracking-wider mb-3" style={{ color: colors.muted }}>Coming soon</h2>
      <div className="grid gap-3">
        {cards.map((item, i) => {
          const Icon = item.icon;
          return (
            <div
              key={item.title}
              className="rounded-[20px] border p-4 flex items-center gap-4"
              style={{ background: colors.card, borderColor: colors.border }}
            >
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(255,255,255,0.06)' }}>
                <Icon size={20} style={{ color: colors.muted }} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-medium truncate" style={{ color: colors.text }}>{item.title}</p>
                <p className="text-[13px] truncate mt-0.5" style={{ color: colors.muted }}>{item.desc}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function Nutrition() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { role } = useAuth();
  const [user, setUser] = useState(null);
  const [showTargetForm, setShowTargetForm] = useState(false);
  const [targetCalories, setTargetCalories] = useState('');
  const [targetProtein, setTargetProtein] = useState('');
  const [targetCarbs, setTargetCarbs] = useState('');
  const [targetFats, setTargetFats] = useState('');
  const [deleting, setDeleting] = useState(null);
  const { trigger, reason } = useCoachingUpgradeTriggers(null, null);

  useEffect(() => {
    const loadUser = async () => {
      const u = await base44.auth.me();
      setUser(u);
    };
    loadUser();
  }, []);

  // Update trigger when user is loaded
  const { trigger: coachTrigger, reason: coachReason } = useCoachingUpgradeTriggers(user?.id, user?.user_type);

  // Client/Trainer flow
  const { data: clientProfile } = useQuery({
    queryKey: ['client-profile', user?.id],
    queryFn: async () => {
      const profiles = await base44.entities.ClientProfile.filter({ user_id: user.id });
      return profiles[0];
    },
    enabled: !!user?.id && user?.user_type === 'client'
  });

  const { data: nutritionPlan } = useQuery({
    queryKey: ['nutrition-plan', clientProfile?.id],
    queryFn: async () => {
      const plans = await base44.entities.NutritionPlan.filter({
        client_id: clientProfile.id,
        is_active: true
      });
      return plans[0];
    },
    enabled: !!clientProfile?.id
  });

  // Solo user flow
  const { data: soloTarget } = useQuery({
    queryKey: ['solo-nutrition-target', user?.id],
    queryFn: async () => {
      const targets = await base44.entities.SoloNutritionTarget.filter({
        user_id: user.id,
        is_active: true
      });
      return targets[0];
    },
    enabled: !!user?.id && user?.user_type === 'solo'
  });

  const { data: todayMeals = [] } = useQuery({
    queryKey: ['today-meals', user?.id],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      return base44.entities.MealLog.filter({
        user_id: user.id,
        meal_date: today
      });
    },
    enabled: !!user?.id
  });

  const logMealMutation = useMutation({
    mutationFn: async (mealData) => {
      const today = new Date().toISOString().split('T')[0];
      return base44.entities.MealLog.create({
        user_id: user.id,
        meal_date: today,
        logged_at: new Date().toISOString(),
        ...mealData
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['today-meals'] });
      toast.success('Meal logged');
    }
  });

  const deleteMealMutation = useMutation({
    mutationFn: (mealId) => base44.entities.MealLog.delete(mealId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['today-meals'] });
      setDeleting(null);
    }
  });

  const createTargetMutation = useMutation({
    mutationFn: async (targetData) => {
      return base44.entities.SoloNutritionTarget.create({
        user_id: user.id,
        is_active: true,
        ...targetData
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['solo-nutrition-target'] });
      setShowTargetForm(false);
      setTargetCalories('');
      setTargetProtein('');
      setTargetCarbs('');
      setTargetFats('');
      toast.success('Nutrition target set');
    }
  });

  if (!user) return <PageLoader />;

  if (role === 'trainer') return <TrainerNutritionPlaceholder />;

  // Client with trainer
  if (user.user_type === 'client' && !clientProfile) return <PageLoader />;
  if (user.user_type === 'client' && clientProfile && !nutritionPlan) {
    return (
      <div style={{ minHeight: '100vh', background: colors.bg, padding: shell.pagePaddingH, paddingTop: spacing[24], paddingBottom: 96, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <EmptyState
          icon={Apple}
          title="No Nutrition Plan Yet"
          description="Your coach hasn't created a nutrition plan for you yet."
          action={
            <Button onClick={() => navigate(createPageUrl('Messages'))} style={{ background: colors.primary }}>
              <MessageSquare className="w-4 h-4 mr-2" />
              Ask Your Coach
            </Button>
          }
        />
      </div>
    );
  }

  // Determine which data to use
  const isClient = user.user_type === 'client';
  const activeTarget = isClient ? nutritionPlan : soloTarget;
  const showLogging = isClient || (user.user_type === 'solo' && soloTarget);

  // Solo user without target
  if (user.user_type === 'solo' && !soloTarget) {
    return (
      <div style={{ minHeight: '100vh', background: colors.bg, paddingBottom: 96, paddingLeft: shell.pagePaddingH, paddingRight: shell.pagePaddingH, paddingTop: spacing[16] }}>
        <div style={{ marginBottom: shell.sectionSpacing }}>
          <h1 style={{ fontSize: 22, fontWeight: 600, color: colors.text, margin: 0, marginBottom: 4 }}>Nutrition</h1>
          <p style={{ fontSize: 14, color: colors.muted, margin: 0 }}>Set your daily targets and log meals</p>
        </div>

        <div style={{ marginBottom: shell.sectionSpacing }}>
          <EmptyState
            icon={Apple}
            title="Set Your Nutrition Targets"
            description="Create daily calorie and macro goals to start tracking your nutrition."
            action={
              <Button
                onClick={() => setShowTargetForm(true)}
                style={{ background: colors.primary }}
              >
                <Target className="w-4 h-4 mr-2" />
                Set Targets
              </Button>
            }
          />
        </div>

        {/* Target Form */}
        {showTargetForm && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} style={{ marginTop: shell.sectionSpacing }}>
            <Card style={{ padding: spacing[24], maxWidth: 400, margin: '0 auto' }}>
              <h3 style={{ fontSize: 16, fontWeight: 600, color: colors.text, margin: 0, marginBottom: spacing[16] }}>Daily Nutrition Targets</h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: spacing[12], marginBottom: spacing[16] }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 500, color: colors.muted, marginBottom: 4, display: 'block' }}>Daily Calories *</label>
                  <Input
                    type="number"
                    value={targetCalories}
                    onChange={(e) => setTargetCalories(e.target.value)}
                    placeholder="e.g., 2000"
                    style={{ background: colors.surface2, borderColor: shell.cardBorder }}
                  />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 500, color: colors.muted, display: 'block', marginBottom: 4 }}>Protein (g)</label>
                    <Input type="number" value={targetProtein} onChange={(e) => setTargetProtein(e.target.value)} placeholder="Optional" style={{ background: colors.surface2, borderColor: shell.cardBorder }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 500, color: colors.muted, display: 'block', marginBottom: 4 }}>Carbs (g)</label>
                    <Input type="number" value={targetCarbs} onChange={(e) => setTargetCarbs(e.target.value)} placeholder="Optional" style={{ background: colors.surface2, borderColor: shell.cardBorder }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 500, color: colors.muted, display: 'block', marginBottom: 4 }}>Fats (g)</label>
                    <Input type="number" value={targetFats} onChange={(e) => setTargetFats(e.target.value)} placeholder="Optional" style={{ background: colors.surface2, borderColor: shell.cardBorder }} />
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <Button
                  onClick={() => createTargetMutation.mutate({
                    target_calories: parseFloat(targetCalories),
                    target_protein_g: targetProtein ? parseFloat(targetProtein) : null,
                    target_carbs_g: targetCarbs ? parseFloat(targetCarbs) : null,
                    target_fats_g: targetFats ? parseFloat(targetFats) : null
                  })}
                  disabled={createTargetMutation.isPending || !targetCalories}
                  style={{ flex: 1, background: colors.primary }}
                >
                  Save Targets
                </Button>
                <Button variant="outline" onClick={() => setShowTargetForm(false)} style={{ flex: 1, borderColor: shell.cardBorder }}>
                  Cancel
                </Button>
              </div>
            </Card>
          </motion.div>
        )}
      </div>
    );
  }

  const goalLabels = {
    cut: 'Fat Loss',
    maintain: 'Maintenance',
    bulk: 'Muscle Gain'
  };

  // Calculate daily totals from logged meals
  const dailyTotals = {
    calories: todayMeals.reduce((sum, m) => sum + (m.calories || 0), 0),
    protein_g: todayMeals.reduce((sum, m) => sum + (m.protein_g || 0), 0),
    carbs_g: todayMeals.reduce((sum, m) => sum + (m.carbs_g || 0), 0),
    fats_g: todayMeals.reduce((sum, m) => sum + (m.fats_g || 0), 0)
  };

  return (
    <div style={{ minHeight: '100vh', background: colors.bg, paddingBottom: 96, paddingLeft: shell.pagePaddingH, paddingRight: shell.pagePaddingH, paddingTop: spacing[16] }}>
      <div style={{ marginBottom: shell.sectionSpacing }}>
        <h1 style={{ fontSize: 22, fontWeight: 600, color: colors.text, margin: 0, marginBottom: 4 }}>Nutrition</h1>
        <p style={{ fontSize: 14, color: colors.muted, margin: 0 }}>
          {isClient ? 'Your daily targets from your coach' : 'Track your daily nutrition'}
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: shell.sectionSpacing }}>
        {/* Client: Goal Card */}
        {isClient && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <Card style={{ padding: spacing[20], background: colors.surface, border: `1px solid ${shell.cardBorder}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: spacing[12], marginBottom: 8 }}>
                <span style={{ width: 40, height: 40, borderRadius: shell.iconContainerRadius, background: colors.primarySubtle, color: colors.primary, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Target size={20} strokeWidth={2} />
                </span>
                <h2 style={{ fontSize: 18, fontWeight: 600, color: colors.text, margin: 0 }}>Your Goal</h2>
              </div>
              <p style={{ fontSize: 22, fontWeight: 700, color: colors.text, margin: 0, marginBottom: 4 }}>{goalLabels[nutritionPlan.goal]}</p>
              <p style={{ fontSize: 14, color: colors.muted, margin: 0 }}>This is what your coach wants you to follow</p>
            </Card>
          </motion.div>
        )}

        {/* Progress Bars */}
        {showLogging && (
          <DailyNutritionProgress target={activeTarget} logged={dailyTotals} />
        )}

        {/* Meal Logging for Solo */}
        {user.user_type === 'solo' && soloTarget && (
          <>
            <MealLogForm onSubmit={(data) => logMealMutation.mutate(data)} isLoading={logMealMutation.isPending} />
            <div>
              <h3 className="font-semibold text-white mb-3">Today's Meals</h3>
              <MealLogList
                meals={todayMeals}
                onDelete={async (id) => {
                  setDeleting(id);
                  await deleteMealMutation.mutateAsync(id);
                }}
                isDeleting={deleting}
              />
            </div>
          </>
        )}

        {/* Client: Daily Calories */}
        {isClient && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6"
          >
            <h3 className="font-semibold text-white mb-4">Daily Calorie Target</h3>
            <div className="text-center py-6 bg-slate-900/50 rounded-xl">
              <p className="text-5xl font-bold text-white mb-2">{nutritionPlan.target_calories}</p>
              <p className="text-sm text-slate-400">calories per day</p>
            </div>
          </motion.div>
        )}

        {/* Client: Macros */}
        {isClient && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6"
          >
            <h3 className="font-semibold text-white mb-4">Macronutrient Breakdown</h3>
            <div className="space-y-4">
              {[
                { name: 'Protein', percent: nutritionPlan.protein_percent, g: nutritionPlan.protein_g, color: 'bg-blue-500' },
                { name: 'Carbs', percent: nutritionPlan.carbs_percent, g: nutritionPlan.carbs_g, color: 'bg-green-500' },
                { name: 'Fats', percent: nutritionPlan.fats_percent, g: nutritionPlan.fats_g, color: 'bg-yellow-500' }
              ].map(macro => (
                <div key={macro.name}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-white">{macro.name}</span>
                    <span className="text-sm text-slate-400">{macro.percent}%</span>
                  </div>
                  <div className="bg-slate-900 rounded-full h-3 overflow-hidden">
                    <div className={`${macro.color} h-full rounded-full`} style={{ width: `${macro.percent}%` }} />
                  </div>
                  <p className="text-lg font-bold text-white mt-2">{macro.g}g</p>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Client: Coach Notes */}
        {isClient && nutritionPlan.trainer_notes && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-blue-500/10 border border-blue-500/20 rounded-2xl p-6"
          >
            <h3 className="font-semibold text-white mb-3">Coach's Notes</h3>
            <p className="text-sm text-slate-200 leading-relaxed">{nutritionPlan.trainer_notes}</p>
          </motion.div>
        )}

        {/* Solo: Helpful Tips */}
        {user.user_type === 'solo' && soloTarget && (
          <>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6"
            >
              <h3 className="font-semibold text-white mb-3">Quick Tips</h3>
              <ul className="space-y-2 text-sm text-slate-300">
                <li className="flex items-start gap-2">
                  <span className="text-blue-400 mt-1">•</span>
                  <span>Log meals as you eat to stay accurate</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-400 mt-1">•</span>
                  <span>Use a food scale for precision (optional)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-400 mt-1">•</span>
                  <span>Consistency matters more than perfection</span>
                </li>
              </ul>
            </motion.div>

            {/* Coaching Upgrade Prompt */}
            {coachTrigger && (
              <CoachingUpgradeCard trigger={coachTrigger} reason={coachReason} variant="banner" />
            )}
          </>
        )}

        {/* Contact Coach - Client only */}
        {isClient && (
          <Button
            onClick={() => navigate(createPageUrl('Messages'))}
            variant="outline"
            className="w-full border-slate-700"
          >
            <MessageSquare className="w-4 h-4 mr-2" />
            Message Your Coach
          </Button>
        )}
      </div>
    </div>
  );
}