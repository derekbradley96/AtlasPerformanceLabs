import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trash2 } from 'lucide-react';

export default function MealLogList({ meals, onDelete, isDeleting }) {
  const mealIcons = {
    breakfast: '🌅',
    lunch: '🍽️',
    dinner: '🌙',
    snack: '🍎'
  };

  if (meals.length === 0) {
    return (
      <div className="text-center py-8 text-slate-400">
        <p className="text-sm">No meals logged yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <AnimatePresence>
        {meals.map((meal, idx) => (
          <motion.div
            key={meal.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ delay: idx * 0.05 }}
            className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-3 flex items-center justify-between hover:bg-slate-800/70 transition-colors"
          >
            <div className="flex items-center gap-3 flex-1">
              <span className="text-2xl">{mealIcons[meal.meal_type]}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white capitalize">
                  {meal.meal_type}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-slate-400">{meal.calories} cal</span>
                  {meal.protein_g && (
                    <span className="text-xs text-slate-500">• P: {meal.protein_g.toFixed(0)}g</span>
                  )}
                  {meal.carbs_g && (
                    <span className="text-xs text-slate-500">C: {meal.carbs_g.toFixed(0)}g</span>
                  )}
                  {meal.fats_g && (
                    <span className="text-xs text-slate-500">F: {meal.fats_g.toFixed(0)}g</span>
                  )}
                </div>
                {meal.notes && (
                  <p className="text-xs text-slate-500 mt-1 truncate">{meal.notes}</p>
                )}
              </div>
            </div>
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => onDelete(meal.id)}
              disabled={isDeleting === meal.id}
              className="flex items-center justify-center w-8 h-8 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50"
            >
              <Trash2 className="w-4 h-4" />
            </motion.button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}