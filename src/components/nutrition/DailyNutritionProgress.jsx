import React from 'react';
import { motion } from 'framer-motion';
import { TrendingUp } from 'lucide-react';

export default function DailyNutritionProgress({ target, logged }) {
  const caloriePercent = Math.min((logged.calories / target.calories) * 100, 100);
  const proteinPercent = target.protein_g 
    ? Math.min(((logged.protein_g || 0) / target.protein_g) * 100, 100) 
    : 0;
  const carbsPercent = target.carbs_g 
    ? Math.min(((logged.carbs_g || 0) / target.carbs_g) * 100, 100) 
    : 0;
  const fatsPercent = target.fats_g 
    ? Math.min(((logged.fats_g || 0) / target.fats_g) * 100, 100) 
    : 0;

  const remaining = Math.max(target.calories - logged.calories, 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gradient-to-br from-blue-600/20 to-blue-600/20 border border-blue-500/30 rounded-2xl p-6"
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-white">Today's Progress</h3>
        <TrendingUp className="w-5 h-5 text-blue-400" />
      </div>

      {/* Calories */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-slate-300">Calories</span>
          <span className="text-sm font-semibold text-white">
            {logged.calories} / {target.calories}
          </span>
        </div>
        <div className="bg-slate-900/50 rounded-full h-3 overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${caloriePercent}%` }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            className="bg-gradient-to-r from-blue-500 to-blue-400 h-full rounded-full"
          />
        </div>
        {remaining > 0 && (
          <p className="text-xs text-slate-400 mt-1">{remaining} cal remaining</p>
        )}
      </div>

      {/* Macros */}
      {(target.protein_g || target.carbs_g || target.fats_g) && (
        <div className="space-y-3">
          {target.protein_g && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-slate-400">Protein</span>
                <span className="text-xs font-medium text-white">
                  {(logged.protein_g || 0).toFixed(0)}g / {target.protein_g}g
                </span>
              </div>
              <div className="bg-slate-900/50 rounded-full h-2 overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${proteinPercent}%` }}
                  transition={{ duration: 0.5, ease: 'easeOut' }}
                  className="bg-blue-400 h-full rounded-full"
                />
              </div>
            </div>
          )}

          {target.carbs_g && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-slate-400">Carbs</span>
                <span className="text-xs font-medium text-white">
                  {(logged.carbs_g || 0).toFixed(0)}g / {target.carbs_g}g
                </span>
              </div>
              <div className="bg-slate-900/50 rounded-full h-2 overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${carbsPercent}%` }}
                  transition={{ duration: 0.5, ease: 'easeOut' }}
                  className="bg-green-400 h-full rounded-full"
                />
              </div>
            </div>
          )}

          {target.fats_g && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-slate-400">Fats</span>
                <span className="text-xs font-medium text-white">
                  {(logged.fats_g || 0).toFixed(0)}g / {target.fats_g}g
                </span>
              </div>
              <div className="bg-slate-900/50 rounded-full h-2 overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${fatsPercent}%` }}
                  transition={{ duration: 0.5, ease: 'easeOut' }}
                  className="bg-yellow-400 h-full rounded-full"
                />
              </div>
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}