import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createPageUrl } from '@/utils';
import { ArrowLeft, Save, Calculator } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PageLoader } from '@/components/ui/LoadingState';
import { toast } from 'sonner';
import NotAuthorized from '@/components/NotAuthorized';

export default function NutritionBuilder() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const clientId = searchParams.get('clientId');

  const [formData, setFormData] = useState({
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
    trainer_notes: ''
  });

  const { data: profile } = useQuery({
    queryKey: ['trainer-profile', user?.id],
    queryFn: async () => null,
    enabled: !!user?.id && (user?.user_type === 'coach' || user?.user_type === 'trainer')
  });

  const { data: client } = useQuery({
    queryKey: ['client', clientId],
    queryFn: async () => null,
    enabled: !!clientId
  });

  const { data: clientUser } = useQuery({
    queryKey: ['client-user', client?.user_id],
    queryFn: async () => null,
    enabled: !!client?.user_id
  });

  const { data: existingPlan } = useQuery({
    queryKey: ['nutrition-plan', clientId],
    queryFn: async () => null,
    enabled: !!clientId
  });

  const calculateNutrition = () => {
    const { sex, height_cm, weight_kg, age, activity_level, goal } = formData;
    
    if (!height_cm || !weight_kg || !age) {
      toast.error('Please fill in all body metrics');
      return;
    }

    // Calculate BMR using Mifflin-St Jeor
    let bmr;
    if (sex === 'male') {
      bmr = (10 * parseFloat(weight_kg)) + (6.25 * parseFloat(height_cm)) - (5 * parseInt(age)) + 5;
    } else {
      bmr = (10 * parseFloat(weight_kg)) + (6.25 * parseFloat(height_cm)) - (5 * parseInt(age)) - 161;
    }

    // Activity multipliers
    const activityMultipliers = {
      sedentary: 1.2,
      lightly_active: 1.375,
      moderately_active: 1.55,
      very_active: 1.725,
      extra_active: 1.9
    };

    const maintenance = Math.round(bmr * activityMultipliers[activity_level]);

    // Goal adjustments
    let target;
    if (goal === 'cut') {
      target = Math.round(maintenance * 0.8); // 20% deficit
    } else if (goal === 'bulk') {
      target = Math.round(maintenance * 1.1); // 10% surplus
    } else {
      target = maintenance;
    }

    // Calculate macros based on percentages
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
      fats_g: fatsG
    });

    toast.success('Nutrition calculated!');
  };

  const saveMutation = useMutation({
    mutationFn: async () => ({}),
    onSuccess: () => {
      queryClient.invalidateQueries(['nutrition-plan']);
      toast.success('Nutrition plan saved!');
      navigate(createPageUrl('ClientDetail') + `?id=${clientId}`);
    }
  });

  const handleSave = () => {
    if (!formData.target_calories || !formData.protein_g || !formData.carbs_g || !formData.fats_g) {
      toast.error('Please calculate nutrition first');
      return;
    }

    saveMutation.mutate(formData);
  };

  if (!user) return <PageLoader />;
  if (user.user_type !== 'coach' && user.user_type !== 'trainer') return <NotAuthorized />;
  if (clientId && !client) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
        <p className="text-slate-400">Client not found.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 pb-24">
      <div className="sticky top-0 z-10 bg-slate-900/95 backdrop-blur border-b border-slate-800 p-4">
        <div className="flex items-center justify-between">
          <button 
            onClick={() => navigate(-1)}
            className="text-slate-400 hover:text-white flex items-center gap-2"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Back</span>
          </button>
          <Button
            onClick={handleSave}
            disabled={saveMutation.isPending}
            className="bg-blue-500 hover:bg-blue-600"
          >
            <Save className="w-4 h-4 mr-2" />
            Save Plan
          </Button>
        </div>
      </div>

      <div className="p-4 md:p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">Nutrition Plan Builder</h1>
          <p className="text-slate-400">For {clientUser?.full_name}</p>
        </div>

        {/* Body Metrics */}
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Body Metrics</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-white mb-2">Sex</label>
              <Select value={formData.sex} onValueChange={(v) => setFormData({...formData, sex: v})}>
                <SelectTrigger className="bg-slate-900/50 border-slate-700">
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
                onChange={(e) => setFormData({...formData, age: e.target.value})}
                placeholder="25"
                className="bg-slate-900/50 border-slate-700"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-white mb-2">Height (cm)</label>
              <Input
                type="number"
                value={formData.height_cm}
                onChange={(e) => setFormData({...formData, height_cm: e.target.value})}
                placeholder="175"
                className="bg-slate-900/50 border-slate-700"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-white mb-2">Weight (kg)</label>
              <Input
                type="number"
                step="0.1"
                value={formData.weight_kg}
                onChange={(e) => setFormData({...formData, weight_kg: e.target.value})}
                placeholder="75.5"
                className="bg-slate-900/50 border-slate-700"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-white mb-2">Activity Level</label>
              <Select value={formData.activity_level} onValueChange={(v) => setFormData({...formData, activity_level: v})}>
                <SelectTrigger className="bg-slate-900/50 border-slate-700">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sedentary">Sedentary (little/no exercise)</SelectItem>
                  <SelectItem value="lightly_active">Lightly Active (1-3 days/week)</SelectItem>
                  <SelectItem value="moderately_active">Moderately Active (3-5 days/week)</SelectItem>
                  <SelectItem value="very_active">Very Active (6-7 days/week)</SelectItem>
                  <SelectItem value="extra_active">Extra Active (2x per day)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="block text-sm font-medium text-white mb-2">Goal</label>
              <Select value={formData.goal} onValueChange={(v) => setFormData({...formData, goal: v})}>
                <SelectTrigger className="bg-slate-900/50 border-slate-700">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cut">Fat Loss (-20%)</SelectItem>
                  <SelectItem value="maintain">Maintain Weight</SelectItem>
                  <SelectItem value="bulk">Muscle Gain (+10%)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button
            onClick={calculateNutrition}
            className="w-full mt-6 bg-green-500 hover:bg-green-600"
          >
            <Calculator className="w-4 h-4 mr-2" />
            Calculate Nutrition
          </Button>
        </div>

        {/* Calculated Targets */}
        {formData.target_calories && (
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Targets (Editable)</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-white mb-2">Daily Calories</label>
                <Input
                  type="number"
                  value={formData.target_calories}
                  onChange={(e) => setFormData({...formData, target_calories: parseInt(e.target.value)})}
                  className="bg-slate-900/50 border-slate-700"
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-white mb-2">Protein (%)</label>
                  <Input
                    type="number"
                    value={formData.protein_percent}
                    onChange={(e) => {
                      const percent = parseInt(e.target.value);
                      const grams = Math.round((formData.target_calories * (percent / 100)) / 4);
                      setFormData({...formData, protein_percent: percent, protein_g: grams});
                    }}
                    className="bg-slate-900/50 border-slate-700 mb-2"
                  />
                  <Input
                    type="number"
                    value={formData.protein_g}
                    onChange={(e) => setFormData({...formData, protein_g: parseInt(e.target.value)})}
                    placeholder="g"
                    className="bg-slate-900/50 border-slate-700"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-white mb-2">Carbs (%)</label>
                  <Input
                    type="number"
                    value={formData.carbs_percent}
                    onChange={(e) => {
                      const percent = parseInt(e.target.value);
                      const grams = Math.round((formData.target_calories * (percent / 100)) / 4);
                      setFormData({...formData, carbs_percent: percent, carbs_g: grams});
                    }}
                    className="bg-slate-900/50 border-slate-700 mb-2"
                  />
                  <Input
                    type="number"
                    value={formData.carbs_g}
                    onChange={(e) => setFormData({...formData, carbs_g: parseInt(e.target.value)})}
                    placeholder="g"
                    className="bg-slate-900/50 border-slate-700"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-white mb-2">Fats (%)</label>
                  <Input
                    type="number"
                    value={formData.fats_percent}
                    onChange={(e) => {
                      const percent = parseInt(e.target.value);
                      const grams = Math.round((formData.target_calories * (percent / 100)) / 9);
                      setFormData({...formData, fats_percent: percent, fats_g: grams});
                    }}
                    className="bg-slate-900/50 border-slate-700 mb-2"
                  />
                  <Input
                    type="number"
                    value={formData.fats_g}
                    onChange={(e) => setFormData({...formData, fats_g: parseInt(e.target.value)})}
                    placeholder="g"
                    className="bg-slate-900/50 border-slate-700"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Trainer Notes */}
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Notes for Client</h2>
          <Textarea
            value={formData.trainer_notes}
            onChange={(e) => setFormData({...formData, trainer_notes: e.target.value})}
            placeholder="e.g., High carbs on training days, track your macros closely..."
            className="bg-slate-900/50 border-slate-700"
            rows={4}
          />
        </div>
      </div>
    </div>
  );
}