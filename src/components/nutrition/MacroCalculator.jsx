import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calculator, TrendingUp, TrendingDown } from 'lucide-react';

export default function MacroCalculator({ targetCalories, targetProtein, targetCarbs, targetFats }) {
  const [foodItem, setFoodItem] = useState({
    name: '',
    calories_per_100g: '',
    protein_per_100g: '',
    carbs_per_100g: '',
    fats_per_100g: ''
  });

  const [targetMacro, setTargetMacro] = useState('calories');
  const [targetAmount, setTargetAmount] = useState('');

  // Calculate portion size based on target
  const calculatePortion = () => {
    if (!targetAmount || !foodItem[`${targetMacro}_per_100g`]) return null;

    const perHundredGrams = parseFloat(foodItem[`${targetMacro}_per_100g`]);
    if (perHundredGrams === 0) return null;

    const portionGrams = (parseFloat(targetAmount) / perHundredGrams) * 100;
    
    // Calculate resulting macros
    const multiplier = portionGrams / 100;
    return {
      portion_grams: Math.round(portionGrams),
      resulting_calories: Math.round((foodItem.calories_per_100g || 0) * multiplier),
      resulting_protein: Math.round((foodItem.protein_per_100g || 0) * multiplier),
      resulting_carbs: Math.round((foodItem.carbs_per_100g || 0) * multiplier),
      resulting_fats: Math.round((foodItem.fats_per_100g || 0) * multiplier)
    };
  };

  const result = calculatePortion();

  const targets = {
    calories: targetCalories,
    protein: targetProtein,
    carbs: targetCarbs,
    fats: targetFats
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <Calculator className="w-5 h-5 text-blue-400" />
        <h3 className="font-semibold text-white">Macro Calculator</h3>
      </div>

      {/* Food Input */}
      <Card className="bg-slate-800/50 border-slate-700 p-4">
        <div className="space-y-3">
          <div>
            <Label className="text-slate-400 text-xs">Food Item (optional)</Label>
            <Input
              value={foodItem.name}
              onChange={(e) => setFoodItem({...foodItem, name: e.target.value})}
              placeholder="e.g. Chicken breast"
              className="bg-slate-900 border-slate-700 h-9 text-sm mt-1"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-slate-400 text-xs">Calories per 100g</Label>
              <Input
                type="number"
                value={foodItem.calories_per_100g}
                onChange={(e) => setFoodItem({...foodItem, calories_per_100g: e.target.value})}
                placeholder="165"
                className="bg-slate-900 border-slate-700 h-9 text-sm mt-1"
              />
            </div>
            <div>
              <Label className="text-slate-400 text-xs">Protein per 100g</Label>
              <Input
                type="number"
                value={foodItem.protein_per_100g}
                onChange={(e) => setFoodItem({...foodItem, protein_per_100g: e.target.value})}
                placeholder="31"
                className="bg-slate-900 border-slate-700 h-9 text-sm mt-1"
              />
            </div>
            <div>
              <Label className="text-slate-400 text-xs">Carbs per 100g</Label>
              <Input
                type="number"
                value={foodItem.carbs_per_100g}
                onChange={(e) => setFoodItem({...foodItem, carbs_per_100g: e.target.value})}
                placeholder="0"
                className="bg-slate-900 border-slate-700 h-9 text-sm mt-1"
              />
            </div>
            <div>
              <Label className="text-slate-400 text-xs">Fats per 100g</Label>
              <Input
                type="number"
                value={foodItem.fats_per_100g}
                onChange={(e) => setFoodItem({...foodItem, fats_per_100g: e.target.value})}
                placeholder="3.6"
                className="bg-slate-900 border-slate-700 h-9 text-sm mt-1"
              />
            </div>
          </div>
        </div>
      </Card>

      {/* Target Selection */}
      <Card className="bg-slate-800/50 border-slate-700 p-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-slate-400 text-xs">I want to hit</Label>
            <select
              value={targetMacro}
              onChange={(e) => setTargetMacro(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-md px-3 h-9 text-sm text-white mt-1"
            >
              <option value="calories">Calories</option>
              <option value="protein">Protein (g)</option>
              <option value="carbs">Carbs (g)</option>
              <option value="fats">Fats (g)</option>
            </select>
          </div>
          <div>
            <Label className="text-slate-400 text-xs">Target Amount</Label>
            <Input
              type="number"
              value={targetAmount}
              onChange={(e) => setTargetAmount(e.target.value)}
              placeholder={targets[targetMacro] || "Enter amount"}
              className="bg-slate-900 border-slate-700 h-9 text-sm mt-1"
            />
          </div>
        </div>
      </Card>

      {/* Results */}
      {result && (
        <Card className="bg-gradient-to-br from-blue-500/10 to-purple-500/10 border-blue-500/30 p-4">
          <div className="text-center mb-4">
            <p className="text-sm text-slate-400 mb-1">You need</p>
            <p className="text-4xl font-bold text-white">{result.portion_grams}g</p>
            <p className="text-sm text-slate-400 mt-1">{foodItem.name || 'of this food'}</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-800/50 rounded-lg p-3">
              <p className="text-xs text-slate-400 mb-1">Calories</p>
              <p className="text-lg font-semibold text-white">{result.resulting_calories}</p>
              {targetCalories && (
                <div className={`flex items-center gap-1 text-xs mt-1 ${
                  result.resulting_calories <= targetCalories ? 'text-green-400' : 'text-orange-400'
                }`}>
                  {result.resulting_calories <= targetCalories ? <TrendingDown className="w-3 h-3" /> : <TrendingUp className="w-3 h-3" />}
                  <span>{targetCalories - result.resulting_calories} from target</span>
                </div>
              )}
            </div>
            <div className="bg-slate-800/50 rounded-lg p-3">
              <p className="text-xs text-slate-400 mb-1">Protein</p>
              <p className="text-lg font-semibold text-white">{result.resulting_protein}g</p>
              {targetProtein && (
                <div className={`flex items-center gap-1 text-xs mt-1 ${
                  result.resulting_protein <= targetProtein ? 'text-green-400' : 'text-orange-400'
                }`}>
                  {result.resulting_protein <= targetProtein ? <TrendingDown className="w-3 h-3" /> : <TrendingUp className="w-3 h-3" />}
                  <span>{targetProtein - result.resulting_protein}g from target</span>
                </div>
              )}
            </div>
            <div className="bg-slate-800/50 rounded-lg p-3">
              <p className="text-xs text-slate-400 mb-1">Carbs</p>
              <p className="text-lg font-semibold text-white">{result.resulting_carbs}g</p>
              {targetCarbs && (
                <div className={`flex items-center gap-1 text-xs mt-1 ${
                  result.resulting_carbs <= targetCarbs ? 'text-green-400' : 'text-orange-400'
                }`}>
                  {result.resulting_carbs <= targetCarbs ? <TrendingDown className="w-3 h-3" /> : <TrendingUp className="w-3 h-3" />}
                  <span>{targetCarbs - result.resulting_carbs}g from target</span>
                </div>
              )}
            </div>
            <div className="bg-slate-800/50 rounded-lg p-3">
              <p className="text-xs text-slate-400 mb-1">Fats</p>
              <p className="text-lg font-semibold text-white">{result.resulting_fats}g</p>
              {targetFats && (
                <div className={`flex items-center gap-1 text-xs mt-1 ${
                  result.resulting_fats <= targetFats ? 'text-green-400' : 'text-orange-400'
                }`}>
                  {result.resulting_fats <= targetFats ? <TrendingDown className="w-3 h-3" /> : <TrendingUp className="w-3 h-3" />}
                  <span>{targetFats - result.resulting_fats}g from target</span>
                </div>
              )}
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}