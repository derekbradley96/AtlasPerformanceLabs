import React, { useState, useRef } from 'react';
import { Copy } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { motion } from 'framer-motion';

export default function SetLogRow({
  setNumber,
  defaultWeight = 0,
  defaultReps = 0,
  lastSetWeight = null,
  lastSetReps = null,
  gymMode = false,
  onAdd,
  onDuplicate,
  isNewRow = false
}) {
  const [weight, setWeight] = useState(defaultWeight);
  const [reps, setReps] = useState(defaultReps);
  const [touchStart, setTouchStart] = useState(null);
  const rowRef = useRef(null);

  const handleTouchStart = (e) => {
    setTouchStart(e.touches[0].clientX);
  };

  const handleTouchEnd = (e) => {
    if (!touchStart) return;
    const touchEnd = e.changedTouches[0].clientX;
    const diff = touchStart - touchEnd;

    // Swipe left to delete (only for existing sets)
    if (diff > 50 && !isNewRow) {
      onDelete?.();
    }
    setTouchStart(null);
  };

  const handleAddClick = () => {
    onAdd(parseFloat(weight) || 0, parseInt(reps) || 0);
    setWeight(weight); // Keep weight for next set
    setReps(defaultReps);
  };

  const handleDuplicateClick = () => {
    onDuplicate(lastSetWeight, lastSetReps);
  };

  return (
    <motion.div
      layout
      ref={rowRef}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      className={`grid grid-cols-12 gap-2 items-center ${
        isNewRow ? 'pt-3 mt-3 border-t border-slate-700/50' : ''
      }`}
    >
      <span className={`col-span-2 font-medium pl-2 ${
        isNewRow ? 'text-blue-400' : 'text-slate-400'
      }`}>
        {setNumber}
      </span>

      <Input
        inputMode="decimal"
        value={weight}
        onChange={(e) => setWeight(e.target.value)}
        placeholder="0"
        className={`col-span-4 h-10 text-center font-medium no-spinner ${
          gymMode
            ? 'bg-slate-800 border-slate-700 text-lg font-bold'
            : 'bg-slate-900/50 border-slate-700'
        }`}
        style={{
          WebkitAppearance: 'none',
          MozAppearance: 'textfield'
        }}
      />

      <Input
        inputMode="numeric"
        value={reps}
        onChange={(e) => setReps(e.target.value.replace(/[^0-9]/g, ''))}
        placeholder="0"
        className={`col-span-4 h-10 text-center font-medium no-spinner ${
          gymMode
            ? 'bg-slate-800 border-slate-700 text-lg font-bold'
            : 'bg-slate-900/50 border-slate-700'
        }`}
        style={{
          WebkitAppearance: 'none',
          MozAppearance: 'textfield'
        }}
      />

      <div className="col-span-2 flex gap-1">
        {isNewRow && lastSetWeight !== null ? (
          <button
            onClick={handleDuplicateClick}
            className="p-2 text-slate-500 hover:text-blue-400 transition-colors"
            title="Duplicate last set"
          >
            <Copy className="w-4 h-4" />
          </button>
        ) : (
          <div className="w-10" />
        )}
      </div>

      {isNewRow && (
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={handleAddClick}
          className={`col-span-12 py-3 rounded-xl font-medium transition-colors ${
            gymMode
              ? 'bg-blue-500 hover:bg-blue-600 text-white text-lg'
              : 'bg-blue-500/20 hover:bg-blue-500/30 text-blue-400'
          }`}
        >
          + Add Set
        </motion.button>
      )}
    </motion.div>
  );
}