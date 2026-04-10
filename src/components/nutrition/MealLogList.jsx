import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trash2, Repeat2, Pencil, ChevronDown, ChevronRight, ArrowDown } from 'lucide-react';
import { colors } from '@/ui/tokens';
import { useAuth } from '@/lib/AuthContext';
import { formatLegacyMealNotesFirstLineForViewer, formatMealPortionLineForViewer } from '@/lib/nutritionUnits';

/**
 * Viewer-formatted food line (canonical g/ml on meal → shown in viewer nutrition prefs).
 * @param {object} meal
 * @param {object|null} profileRow — pass logger profile only if different from viewer; default viewer = logged-in user
 */
function mealFoodDisplayLine(meal, profileRow) {
  const structured = formatMealPortionLineForViewer(meal, { profileRow });
  if (structured) return structured;
  return formatLegacyMealNotesFirstLineForViewer(meal?.notes, { profileRow });
}

function formatLoggedTime(meal) {
  const raw = meal?.logged_at || meal?.created_at;
  if (!raw) return '';
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

export default function MealLogList({
  meals,
  onDelete,
  onRepeat,
  onEdit,
  isDeleting,
  onRepeatLast,
  onRepeatYesterday,
  repeatLastDisabled,
  repeatYesterdayDisabled,
  emptyAction,
  /** When set (e.g. coach roster view), format using this profile — not the logged-in user */
  viewerProfileOverride = null,
}) {
  const { profile: authProfile } = useAuth();
  const viewerProfile = viewerProfileOverride ?? authProfile;
  const mealIcons = {
    breakfast: '🌅',
    lunch: '🍽️',
    dinner: '🌙',
    snack: '🍎',
  };

  const sorted = useMemo(() => {
    return [...(meals || [])].sort((a, b) => {
      const ta = new Date(a?.logged_at || a?.created_at || 0).getTime();
      const tb = new Date(b?.logged_at || b?.created_at || 0).getTime();
      return tb - ta;
    });
  }, [meals]);

  const [expandedId, setExpandedId] = useState(null);

  if (sorted.length === 0) {
    return (
      <div
        className="rounded-2xl border border-dashed py-10 px-4 text-center"
        style={{ borderColor: colors.border, background: 'rgba(15,23,42,0.4)' }}
      >
        <p className="text-sm font-semibold mb-2" style={{ color: colors.text }}>
          Start logging your first meal
        </p>
        <p className="text-xs mb-4" style={{ color: colors.muted }}>
          Use the bar below — add, scan, or quick add in one tap.
        </p>
        {emptyAction ? (
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
            {emptyAction}
          </div>
        ) : null}
        <div className="flex flex-col items-center gap-1" style={{ color: colors.primary }}>
          <ArrowDown className="w-6 h-6 opacity-80" strokeWidth={2} aria-hidden />
          <span className="text-[11px] font-medium uppercase tracking-wide" style={{ color: colors.muted }}>
            Actions
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {(onRepeatLast || onRepeatYesterday) && (
        <div className="flex flex-wrap gap-2 mb-3">
          {onRepeatLast ? (
            <button
              type="button"
              onClick={onRepeatLast}
              disabled={repeatLastDisabled}
              className="text-xs font-semibold px-3 py-2 rounded-xl border transition-opacity disabled:opacity-40"
              style={{ borderColor: colors.border, color: colors.text, background: colors.surface2 }}
            >
              Repeat last meal
            </button>
          ) : null}
          {onRepeatYesterday ? (
            <button
              type="button"
              onClick={onRepeatYesterday}
              disabled={repeatYesterdayDisabled}
              className="text-xs font-semibold px-3 py-2 rounded-xl border transition-opacity disabled:opacity-40"
              style={{ borderColor: colors.border, color: colors.text, background: colors.surface2 }}
            >
              Repeat yesterday
            </button>
          ) : null}
        </div>
      )}
      <AnimatePresence>
        {sorted.map((meal, idx) => {
          const open = expandedId === meal.id;
          const timeLabel = formatLoggedTime(meal);
          const foodLine = mealFoodDisplayLine(meal, viewerProfile);
          const hasLongNotes = Boolean(meal.notes?.trim());
          return (
            <motion.div
              key={meal.id}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 12 }}
              transition={{ delay: idx * 0.04 }}
              className="rounded-xl border overflow-hidden"
              style={{ borderColor: colors.border, background: 'rgba(30,41,59,0.5)' }}
            >
              <div className="flex items-stretch justify-between gap-2 p-3">
                <button
                  type="button"
                  onClick={() => (hasLongNotes ? setExpandedId((id) => (id === meal.id ? null : meal.id)) : null)}
                  className={`flex items-center gap-3 flex-1 min-w-0 text-left ${hasLongNotes ? 'cursor-pointer' : 'cursor-default'}`}
                  disabled={!hasLongNotes}
                >
                  <span className="text-2xl shrink-0">{mealIcons[meal.meal_type] || '🍽️'}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-white capitalize">{meal.meal_type}</p>
                      {timeLabel ? (
                        <span className="text-[11px] font-medium text-slate-500">{timeLabel}</span>
                      ) : null}
                    </div>
                    {foodLine ? <p className="text-xs text-slate-300 mt-0.5 truncate">{foodLine}</p> : null}
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className="text-xs text-slate-400">{meal.calories} cal</span>
                      {meal.protein_g != null && (
                        <span className="text-xs text-slate-500">P {Number(meal.protein_g).toFixed(0)}g</span>
                      )}
                      {meal.carbs_g != null && (
                        <span className="text-xs text-slate-500">C {Number(meal.carbs_g).toFixed(0)}g</span>
                      )}
                      {meal.fats_g != null && (
                        <span className="text-xs text-slate-500">F {Number(meal.fats_g).toFixed(0)}g</span>
                      )}
                    </div>
                  </div>
                  {hasLongNotes ? (
                    <span className="self-center shrink-0 text-slate-500">
                      {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    </span>
                  ) : null}
                </button>
                <div className="flex items-center gap-1 shrink-0 border-l border-slate-700/60 pl-2">
                  {onRepeat && (
                    <motion.button
                      whileTap={{ scale: 0.95 }}
                      onClick={() => onRepeat(meal)}
                      className="flex items-center justify-center w-9 h-9 rounded-lg text-slate-500 hover:text-blue-300 hover:bg-blue-500/10 transition-colors"
                      title="Log again"
                    >
                      <Repeat2 className="w-4 h-4" />
                    </motion.button>
                  )}
                  {onEdit && (
                    <motion.button
                      whileTap={{ scale: 0.95 }}
                      onClick={() => onEdit(meal)}
                      className="flex items-center justify-center w-9 h-9 rounded-lg text-slate-500 hover:text-amber-300 hover:bg-amber-500/10 transition-colors"
                      title="Edit"
                    >
                      <Pencil className="w-4 h-4" />
                    </motion.button>
                  )}
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={() => onDelete(meal.id)}
                    disabled={isDeleting === meal.id}
                    className="flex items-center justify-center w-9 h-9 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </motion.button>
                </div>
              </div>
              <AnimatePresence>
                {open && hasLongNotes ? (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="border-t border-slate-700/60 px-3 pb-3 pt-2"
                  >
                    <p className="text-xs text-slate-400 break-words whitespace-pre-wrap">{meal.notes}</p>
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
