import React from 'react';
import { motion } from 'framer-motion';
import { TrendingUp } from 'lucide-react';

function macroRow(loggedVal, targetVal) {
  const t = Number(targetVal) || 0;
  if (t <= 0) return { barPct: 0, status: '', ratio: null };
  const lv = Number(loggedVal) || 0;
  const ratio = (lv / t) * 100;
  const barPct = Math.min(ratio, 100);
  let status = 'On track';
  if (ratio < 85) status = 'Under';
  else if (ratio > 115) status = 'Over';
  return { barPct, status, ratio };
}

export default function DailyNutritionProgress({ target, logged }) {
  const calTargetNum = Number(target?.calories) || 0;
  const lCal = Number(logged?.calories) || 0;
  const rawCalPct = calTargetNum > 0 ? (lCal / calTargetNum) * 100 : 0;
  const calorieBarPct = calTargetNum > 0 ? Math.min(rawCalPct, 100) : 0;
  const overCal = Math.max(0, lCal - Number(target?.calories || 0));
  const underCal = Math.max(0, Number(target?.calories || 0) - lCal);
  let calorieStatusLine = 'On track for calories';
  if (rawCalPct > 105) calorieStatusLine = `Over target by ~${Math.round(overCal)} kcal`;
  else if (rawCalPct < 95 && calTargetNum > 0) calorieStatusLine = `Under target by ~${Math.round(underCal)} kcal`;

  const protein = macroRow(logged?.protein_g, target?.protein_g);
  const carbs = macroRow(logged?.carbs_g, target?.carbs_g);
  const fats = macroRow(logged?.fats_g, target?.fats_g);

  const calBarClass =
    rawCalPct > 105
      ? 'bg-gradient-to-r from-amber-500 to-orange-400'
      : rawCalPct < 90
        ? 'bg-gradient-to-r from-slate-500 to-slate-400'
        : 'bg-gradient-to-r from-blue-500 to-blue-400';

  const remaining = Math.max(Number(target?.calories || 0) - lCal, 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gradient-to-br from-blue-600/20 to-blue-600/20 border border-blue-500/30 rounded-2xl p-6"
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-white">Today&apos;s Progress</h3>
        <TrendingUp className="w-5 h-5 text-blue-400" />
      </div>

      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-slate-300">Calories (kcal)</span>
          <span className="text-sm font-semibold text-white">
            {lCal} / {Number(target?.calories) || 0} kcal
          </span>
        </div>
        <div className="bg-slate-900/50 rounded-full h-3 overflow-hidden relative">
          {rawCalPct > 100 ? (
            <div
              className="absolute inset-y-0 left-0 rounded-full opacity-40 bg-amber-500/50"
              style={{ width: '100%' }}
              aria-hidden
            />
          ) : null}
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${calorieBarPct}%` }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            className={`h-full rounded-full ${calBarClass}`}
          />
        </div>
        <p
          className={`text-xs mt-1.5 font-medium ${
            rawCalPct > 105 ? 'text-amber-300' : rawCalPct < 95 && calTargetNum > 0 ? 'text-slate-400' : 'text-emerald-300/90'
          }`}
        >
          {calorieStatusLine}
        </p>
        {remaining > 0 && rawCalPct <= 100 ? (
          <p className="text-xs text-slate-400 mt-0.5">{remaining} cal remaining</p>
        ) : null}
      </div>

      {(target?.protein_g || target?.carbs_g || target?.fats_g) && (
        <div className="space-y-3">
          {target?.protein_g ? (
            <div>
              <div className="flex items-center justify-between mb-1 gap-2">
                <span className="text-xs text-slate-400">Protein</span>
                <span className="text-xs font-medium text-white shrink-0">
                  {(logged?.protein_g || 0).toFixed(0)}g / {target.protein_g}g
                  {protein.status ? (
                    <span
                      className={`ml-2 ${
                        protein.status === 'Under' ? 'text-amber-300' : protein.status === 'Over' ? 'text-orange-300' : 'text-emerald-300/90'
                      }`}
                    >
                      {protein.status}
                    </span>
                  ) : null}
                </span>
              </div>
              <div className="bg-slate-900/50 rounded-full h-2 overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${protein.barPct}%` }}
                  transition={{ duration: 0.5, ease: 'easeOut' }}
                  className={`h-full rounded-full ${
                    protein.status === 'Under' ? 'bg-amber-400' : protein.status === 'Over' ? 'bg-orange-400' : 'bg-blue-400'
                  }`}
                />
              </div>
            </div>
          ) : null}

          {target?.carbs_g ? (
            <div>
              <div className="flex items-center justify-between mb-1 gap-2">
                <span className="text-xs text-slate-400">Carbs</span>
                <span className="text-xs font-medium text-white shrink-0">
                  {(logged?.carbs_g || 0).toFixed(0)}g / {target.carbs_g}g
                  {carbs.status ? (
                    <span
                      className={`ml-2 ${
                        carbs.status === 'Under' ? 'text-amber-300' : carbs.status === 'Over' ? 'text-orange-300' : 'text-emerald-300/90'
                      }`}
                    >
                      {carbs.status}
                    </span>
                  ) : null}
                </span>
              </div>
              <div className="bg-slate-900/50 rounded-full h-2 overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${carbs.barPct}%` }}
                  transition={{ duration: 0.5, ease: 'easeOut' }}
                  className={`h-full rounded-full ${
                    carbs.status === 'Under' ? 'bg-amber-400' : carbs.status === 'Over' ? 'bg-orange-400' : 'bg-green-400'
                  }`}
                />
              </div>
            </div>
          ) : null}

          {target?.fats_g ? (
            <div>
              <div className="flex items-center justify-between mb-1 gap-2">
                <span className="text-xs text-slate-400">Fats</span>
                <span className="text-xs font-medium text-white shrink-0">
                  {(logged?.fats_g || 0).toFixed(0)}g / {target.fats_g}g
                  {fats.status ? (
                    <span
                      className={`ml-2 ${
                        fats.status === 'Under' ? 'text-amber-300' : fats.status === 'Over' ? 'text-orange-300' : 'text-emerald-300/90'
                      }`}
                    >
                      {fats.status}
                    </span>
                  ) : null}
                </span>
              </div>
              <div className="bg-slate-900/50 rounded-full h-2 overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${fats.barPct}%` }}
                  transition={{ duration: 0.5, ease: 'easeOut' }}
                  className={`h-full rounded-full ${
                    fats.status === 'Under' ? 'bg-amber-400' : fats.status === 'Over' ? 'bg-orange-400' : 'bg-yellow-400'
                  }`}
                />
              </div>
            </div>
          ) : null}
        </div>
      )}
    </motion.div>
  );
}
