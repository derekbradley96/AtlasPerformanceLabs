import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Search, X, Play } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function ExerciseSearchModal({ exercises, onSelect, isOpen, onClose }) {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  const categories = ['all', 'chest', 'back', 'shoulders', 'arms', 'legs', 'core', 'cardio', 'full_body'];

  const filtered = exercises.filter(e => {
    const matchSearch = e.name.toLowerCase().includes(search.toLowerCase());
    const matchCategory = selectedCategory === 'all' || e.category === selectedCategory;
    return matchSearch && matchCategory;
  });

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 z-50 flex items-end"
        onClick={onClose}
      >
        <motion.div
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 30, stiffness: 300 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full bg-slate-800 rounded-t-2xl max-h-[90vh] overflow-hidden flex flex-col"
        >
          {/* Header */}
          <div className="sticky top-0 bg-slate-800 border-b border-slate-700 p-4 flex items-center justify-between">
            <h3 className="font-semibold text-white">Add Exercise</h3>
            <button onClick={onClose} className="text-slate-400 hover:text-white">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Search */}
          <div className="p-4 border-b border-slate-700">
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
              <Input
                autoFocus
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search exercises..."
                className="pl-10 bg-slate-700 border-slate-600 h-10"
              />
            </div>
            
            {/* Category Filter */}
            <div className="flex gap-2 overflow-x-auto pb-2">
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1 rounded-lg text-xs font-medium capitalize whitespace-nowrap transition-colors ${
                    selectedCategory === cat
                      ? 'bg-blue-500 text-white'
                      : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Exercise List */}
          <div className="flex-1 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="flex items-center justify-center h-32 text-slate-400">
                <p className="text-sm">No exercises found</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-700">
                {filtered.map(exercise => (
                  <motion.button
                    key={exercise.id}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => {
                      onSelect(exercise);
                      setSearch('');
                    }}
                    className="w-full text-left p-4 hover:bg-slate-700/50 transition-colors"
                  >
                    <p className="font-medium text-white">{exercise.name}</p>
                    <p className="text-xs text-slate-400 mt-1 capitalize">
                      {exercise.category} • {exercise.equipment}
                    </p>
                    {exercise.demo_link && (
                      <div className="flex items-center gap-1 mt-2">
                        <Play className="w-3 h-3 text-blue-400" />
                        <span className="text-xs text-blue-400">Demo available</span>
                      </div>
                    )}
                  </motion.button>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}