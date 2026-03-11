import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { X, Plus } from 'lucide-react';
import { motion } from 'framer-motion';

export default function MealLogForm({ onSubmit, isLoading }) {
  const [mealType, setMealType] = useState('breakfast');
  const [calories, setCalories] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fats, setFats] = useState('');
  const [notes, setNotes] = useState('');
  const [showForm, setShowForm] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!calories) return;

    onSubmit({
      meal_type: mealType,
      calories: parseFloat(calories),
      protein_g: protein ? parseFloat(protein) : null,
      carbs_g: carbs ? parseFloat(carbs) : null,
      fats_g: fats ? parseFloat(fats) : null,
      notes: notes || null
    });

    // Reset form
    setMealType('breakfast');
    setCalories('');
    setProtein('');
    setCarbs('');
    setFats('');
    setNotes('');
    setShowForm(false);
  };

  if (!showForm) {
    return (
      <motion.button
        whileTap={{ scale: 0.98 }}
        onClick={() => setShowForm(true)}
        className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-slate-600 rounded-xl text-slate-300 hover:text-white hover:border-slate-500 transition-colors"
      >
        <Plus className="w-5 h-5" />
        Log Meal
      </motion.button>
    );
  }

  return (
    <motion.form
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      onSubmit={handleSubmit}
      className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4 space-y-3"
    >
      {/* Meal Type */}
      <div className="grid grid-cols-4 gap-2">
        {['breakfast', 'lunch', 'dinner', 'snack'].map((type) => (
          <button
            key={type}
            type="button"
            onClick={() => setMealType(type)}
            className={`py-2 px-2 rounded-lg text-xs font-medium capitalize transition-colors ${
              mealType === type
                ? 'bg-blue-500 text-white'
                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }`}
          >
            {type}
          </button>
        ))}
      </div>

      {/* Calories */}
      <div>
        <label className="text-xs font-medium text-slate-300 mb-1 block">Calories *</label>
        <Input
          type="number"
          value={calories}
          onChange={(e) => setCalories(e.target.value)}
          placeholder="e.g., 450"
          className="bg-slate-700 border-slate-600"
          required
        />
      </div>

      {/* Macros Grid */}
      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className="text-xs font-medium text-slate-300 mb-1 block">Protein (g)</label>
          <Input
            type="number"
            value={protein}
            onChange={(e) => setProtein(e.target.value)}
            placeholder="Optional"
            className="bg-slate-700 border-slate-600"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-slate-300 mb-1 block">Carbs (g)</label>
          <Input
            type="number"
            value={carbs}
            onChange={(e) => setCarbs(e.target.value)}
            placeholder="Optional"
            className="bg-slate-700 border-slate-600"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-slate-300 mb-1 block">Fats (g)</label>
          <Input
            type="number"
            value={fats}
            onChange={(e) => setFats(e.target.value)}
            placeholder="Optional"
            className="bg-slate-700 border-slate-600"
          />
        </div>
      </div>

      {/* Notes */}
      <div>
        <label className="text-xs font-medium text-slate-300 mb-1 block">Notes</label>
        <Input
          type="text"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="e.g., Grilled chicken, rice, broccoli"
          className="bg-slate-700 border-slate-600"
        />
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <Button
          type="submit"
          disabled={isLoading || !calories}
          className="flex-1 bg-blue-500 hover:bg-blue-600 text-white"
        >
          Log Meal
        </Button>
        <button
          type="button"
          onClick={() => setShowForm(false)}
          className="flex items-center justify-center w-10 h-10 rounded-lg bg-slate-700 hover:bg-slate-600 transition-colors"
        >
          <X className="w-4 h-4 text-slate-300" />
        </button>
      </div>
    </motion.form>
  );
}