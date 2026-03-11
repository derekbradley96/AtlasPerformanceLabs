/**
 * Exercise picker: iOS-style bottom sheet (vaul Drawer).
 * Search (auto-focus), Recent (max 8), Favorites (max 8), compact filter chips (Muscle + Equipment), tight list rows.
 */
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Search, Star, X, Plus } from 'lucide-react';
import {
  EXERCISES,
  MUSCLES,
  EQUIPMENT_LIST,
  getExerciseById as getLibraryById,
} from '@/data/exercises/exerciseLibrary';
import {
  getCustomExercises,
  saveCustomExercise,
  incrementExerciseUsage,
} from '@/data/exerciseLibrary';
import { getRecent, addRecent, getFavorites, toggleFavorite } from '@/lib/exercises/exercisePrefs';
import { colors } from '@/ui/tokens';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';

const RECENT_MAX = 8;
const FAVORITE_MAX = 8;
const INPUT_FONT_SIZE = 16; // Prevent iOS zoom on focus
const CHIP_HEIGHT = 28;
const ROW_MIN_HEIGHT = 52;

function getAllExercises(coachId) {
  try {
    const custom = getCustomExercises(coachId || 'default') || [];
    return [...EXERCISES, ...custom];
  } catch {
    return [...EXERCISES];
  }
}

function getExerciseById(id, coachId) {
  if (!id) return null;
  const fromLib = getLibraryById(id);
  if (fromLib) return fromLib;
  try {
    const custom = getCustomExercises(coachId || 'default') || [];
    return custom.find((e) => e.id === id) || null;
  } catch {
    return null;
  }
}

function scoreForReplace(exercise, reference) {
  if (!reference) return 0;
  const muscle = exercise.primaryMuscle || exercise.primaryMuscleGroup || '';
  const refMuscle = reference.primaryMuscle || reference.primaryMuscleGroup || '';
  const pattern = exercise.movementPattern || '';
  const refPattern = reference.movementPattern || '';
  const equip = exercise.equipment || [];
  const refEquip = reference.equipment || [];
  let score = 0;
  if (refMuscle && muscle === refMuscle) score += 100;
  if (refPattern && pattern === refPattern) score += 30;
  const sharedEquip = refEquip.filter((eq) => equip.includes(eq)).length;
  if (sharedEquip > 0) score += 10 * sharedEquip;
  return score;
}

export default function ExercisePickerModal({
  open,
  onClose,
  onSelect,
  coachId,
  isTrainer = true,
  replaceForExerciseId = null,
  showRecentSection = true,
}) {
  const [search, setSearch] = useState('');
  const [filterMuscle, setFilterMuscle] = useState('');
  const [filterEquipment, setFilterEquipment] = useState('');
  const [showAddCustom, setShowAddCustom] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customMuscle, setCustomMuscle] = useState('Chest');
  const [customEquipment, setCustomEquipment] = useState('Dumbbell');
  const [favoriteIds, setFavoriteIds] = useState(() => getFavorites());
  const searchInputRef = useRef(null);

  const cid = coachId ?? 'default';

  useEffect(() => {
    if (open) {
      setFavoriteIds(getFavorites());
      const t = setTimeout(() => {
        searchInputRef.current?.focus?.();
      }, 100);
      return () => clearTimeout(t);
    }
  }, [open]);

  const allExercises = useMemo(() => getAllExercises(cid), [cid]);
  const recentIds = useMemo(() => getRecent().slice(0, RECENT_MAX), [open]);

  const recentExercises = useMemo(() => {
    return recentIds
      .map((id) => getExerciseById(id, cid))
      .filter(Boolean);
  }, [recentIds, cid]);

  const favoriteExercises = useMemo(() => {
    return (favoriteIds || [])
      .slice(0, FAVORITE_MAX)
      .map((id) => getExerciseById(id, cid))
      .filter(Boolean);
  }, [favoriteIds, cid]);

  const referenceExercise = useMemo(
    () => (replaceForExerciseId ? getExerciseById(replaceForExerciseId, cid) : null),
    [replaceForExerciseId, cid]
  );

  const filteredAll = useMemo(() => {
    let list = allExercises || [];
    const q = (search || '').toLowerCase().trim();
    if (q) {
      list = list.filter(
        (e) =>
          (e?.name && e.name.toLowerCase().includes(q)) ||
          ((e?.primaryMuscle || e?.primaryMuscleGroup || '') &&
            (e.primaryMuscle || e.primaryMuscleGroup).toLowerCase().includes(q)) ||
          (e?.equipment && e.equipment.some((eq) => eq && eq.toLowerCase().includes(q)))
      );
    }
    if (filterMuscle)
      list = list.filter((e) => (e?.primaryMuscle || e?.primaryMuscleGroup) === filterMuscle);
    if (filterEquipment)
      list = list.filter((e) => e?.equipment && e.equipment.includes(filterEquipment));
    if (referenceExercise) {
      list = [...list].sort(
        (a, b) => scoreForReplace(b, referenceExercise) - scoreForReplace(a, referenceExercise)
      );
    }
    return list;
  }, [allExercises, search, filterMuscle, filterEquipment, referenceExercise]);

  const handleSelect = (exercise) => {
    if (!exercise?.id) return;
    try {
      if (typeof window !== 'undefined' && window.navigator?.vibrate) window.navigator.vibrate(10);
      addRecent(exercise.id);
      incrementExerciseUsage(cid, exercise.id);
      onSelect(exercise);
      onClose();
    } catch {
      onSelect(exercise);
      onClose();
    }
  };

  const handleToggleFavorite = (e, exerciseId) => {
    e.preventDefault();
    e.stopPropagation();
    toggleFavorite(exerciseId);
    setFavoriteIds(getFavorites());
  };

  const handleAddCustom = () => {
    const name = (customName || '').trim();
    if (!name) return;
    try {
      const created = saveCustomExercise(cid, {
        name,
        primaryMuscleGroup: customMuscle,
        secondaryMuscles: [],
        movementPattern: 'Other',
        equipment: [customEquipment],
        difficulty: 'intermediate',
        tags: [],
        substitutions: [],
      });
      setCustomName('');
      setShowAddCustom(false);
      handleSelect(created);
    } catch {
      setShowAddCustom(false);
    }
  };

  const chip = (label, value, current, set) => {
    const active = current === value;
    return (
      <button
        key={value || 'all'}
        type="button"
        onClick={() => set(active ? '' : value)}
        className="flex-shrink-0 rounded-full px-3 text-xs font-medium transition-colors"
        style={{
          height: CHIP_HEIGHT,
          minHeight: CHIP_HEIGHT,
          background: active ? colors.accent : 'transparent',
          color: active ? '#fff' : colors.muted,
          border: `1px solid ${active ? colors.accent : colors.border}`,
        }}
      >
        {label}
      </button>
    );
  };

  const ChipRow = ({ label, options, value, setValue }) => (
    <div className="flex gap-2 overflow-x-auto overflow-y-hidden items-center py-1.5 min-h-[30px] shrink-0" style={{ WebkitOverflowScrolling: 'touch' }}>
      {label ? (
        <span className="text-[10px] font-medium flex-shrink-0 uppercase tracking-wider" style={{ color: colors.muted }}>
          {label}
        </span>
      ) : null}
      {chip('All', '', value, setValue)}
      {options.map((opt) => chip(opt, opt, value, setValue))}
    </div>
  );

  const renderExerciseRow = (e, idx, section) => {
    if (!e) return null;
    const id = e.id || `row-${section}-${idx}`;
    const name = e.name || 'Exercise';
    const muscle = e.primaryMuscle || e.primaryMuscleGroup || '';
    const equipList = e.equipment || [];
    const secondary = muscle || equipList.slice(0, 2).join(', ') || '';
    const isFav = (favoriteIds || []).includes(e.id);

    return (
      <li key={id} className="min-w-0 list-none">
        <button
          type="button"
          onClick={() => handleSelect(e)}
          className="w-full text-left flex items-center gap-3 min-w-0 rounded-xl active:opacity-90 transition-opacity border-none"
          style={{
            minHeight: ROW_MIN_HEIGHT,
            padding: '12px 14px',
            color: colors.text,
            background: colors.card,
            border: `1px solid ${colors.border}`,
          }}
        >
          <span className="flex-1 min-w-0">
            <span className="font-medium block truncate text-[15px] leading-tight" style={{ color: colors.text }}>
              {name}
            </span>
            {secondary ? (
              <span className="text-[12px] block truncate mt-0.5" style={{ color: colors.muted }}>
                {secondary}
              </span>
            ) : null}
          </span>
          <span
            role="button"
            tabIndex={0}
            onClick={(ev) => handleToggleFavorite(ev, e.id)}
            onKeyDown={(ev) => ev.key === 'Enter' && handleToggleFavorite(ev, e.id)}
            className="flex-shrink-0 p-2 -m-2 rounded-full touch-manipulation"
            style={{ color: isFav ? colors.warning : colors.muted }}
            aria-label={isFav ? 'Remove from favorites' : 'Add to favorites'}
          >
            <Star size={20} fill={isFav ? colors.warning : 'transparent'} strokeWidth={1.5} />
          </span>
        </button>
      </li>
    );
  };

  return (
    <Drawer
      open={open}
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
      snapPoints={[0.85]}
      dismissible
      shouldScaleBackground
    >
      <DrawerContent
        className="rounded-t-2xl border-t flex flex-col max-h-[85vh] [&>div:first-child]:h-1 [&>div:first-child]:w-10 [&>div:first-child]:bg-white/20 [&>div:first-child]:mt-3 [&>div:first-child]:rounded-full"
        style={{
          background: colors.bg,
          borderColor: colors.border,
          paddingTop: 'env(safe-area-inset-top, 0)',
          paddingBottom: 'env(safe-area-inset-bottom, 0)',
          paddingLeft: 'env(safe-area-inset-left, 0)',
          paddingRight: 'env(safe-area-inset-right, 0)',
        }}
      >
        <DrawerHeader className="px-4 pb-2 pt-1 flex-shrink-0">
          <div className="flex items-center justify-between gap-2">
            <DrawerTitle className="text-base font-semibold" style={{ color: colors.text }}>
              Select exercise
            </DrawerTitle>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-full active:bg-white/5 -mr-2"
              style={{ color: colors.muted }}
              aria-label="Close"
            >
              <X size={22} />
            </button>
          </div>

          <div className="relative mt-3">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"
              style={{ color: colors.muted }}
            />
            <input
              ref={searchInputRef}
              type="text"
              inputMode="search"
              autoComplete="off"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search exercises..."
              className="w-full rounded-xl py-3 pl-10 pr-10 border text-base focus:outline-none focus:ring-2 min-w-0"
              style={{
                color: colors.text,
                background: colors.card,
                borderColor: colors.border,
                fontSize: INPUT_FONT_SIZE,
                minHeight: 44,
              }}
            />
            {search ? (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full active:bg-white/10"
                style={{ color: colors.muted }}
                aria-label="Clear search"
              >
                <X size={16} />
              </button>
            ) : null}
          </div>

          <div className="flex flex-col gap-0 mt-3 overflow-x-hidden">
            <ChipRow label="Muscle" options={MUSCLES || []} value={filterMuscle} setValue={setFilterMuscle} />
            <ChipRow label="Equipment" options={EQUIPMENT_LIST || []} value={filterEquipment} setValue={setFilterEquipment} />
          </div>
        </DrawerHeader>

        <div
          className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-4 pb-8 min-w-0"
          style={{ WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain' }}
        >
          {showAddCustom ? (
            <div
              className="rounded-2xl p-4 mb-4"
              style={{ background: colors.card, border: `1px solid ${colors.border}` }}
            >
              <h3 className="text-sm font-semibold mb-3" style={{ color: colors.text }}>
                Add custom exercise
              </h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: colors.muted }}>
                    Name *
                  </label>
                  <input
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    placeholder="e.g. Custom Cable Fly"
                    className="w-full rounded-xl py-2.5 px-3 border text-base focus:outline-none focus:ring-2 min-w-0"
                    style={{
                      color: colors.text,
                      background: colors.bg,
                      borderColor: colors.border,
                      fontSize: INPUT_FONT_SIZE,
                    }}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: colors.muted }}>
                    Primary muscle
                  </label>
                  <select
                    value={customMuscle}
                    onChange={(e) => setCustomMuscle(e.target.value)}
                    className="w-full rounded-xl py-2.5 px-3 border text-base focus:outline-none focus:ring-2 min-w-0"
                    style={{
                      color: colors.text,
                      background: colors.bg,
                      borderColor: colors.border,
                      fontSize: INPUT_FONT_SIZE,
                    }}
                  >
                    {(MUSCLES || []).map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: colors.muted }}>
                    Equipment
                  </label>
                  <select
                    value={customEquipment}
                    onChange={(e) => setCustomEquipment(e.target.value)}
                    className="w-full rounded-xl py-2.5 px-3 border text-base focus:outline-none focus:ring-2 min-w-0"
                    style={{
                      color: colors.text,
                      background: colors.bg,
                      borderColor: colors.border,
                      fontSize: INPUT_FONT_SIZE,
                    }}
                  >
                    {(EQUIPMENT_LIST || []).map((eq) => (
                      <option key={eq} value={eq}>
                        {eq}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowAddCustom(false)}
                    className="flex-1 py-3 rounded-xl border font-medium"
                    style={{ borderColor: colors.border, color: colors.muted }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleAddCustom}
                    disabled={!customName.trim()}
                    className="flex-1 py-3 rounded-xl font-medium"
                    style={{
                      background: colors.accent,
                      color: '#fff',
                      opacity: customName.trim() ? 1 : 0.5,
                    }}
                  >
                    Add & select
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <>
              {isTrainer && (
                <button
                  type="button"
                  onClick={() => setShowAddCustom(true)}
                  className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl mb-4 font-medium border border-dashed"
                  style={{ borderColor: colors.border, color: colors.accent }}
                >
                  <Plus size={18} /> Add custom exercise
                </button>
              )}

              {recentExercises.length > 0 && showRecentSection && (
                <section className="mb-5">
                  <h3 className="text-[11px] font-semibold uppercase tracking-wider mb-2" style={{ color: colors.muted }}>
                    Recent
                  </h3>
                  <ul className="space-y-2">
                    {recentExercises.map((e, idx) => renderExerciseRow(e, idx, 'recent'))}
                  </ul>
                </section>
              )}

              {favoriteExercises.length > 0 && (
                <section className="mb-5">
                  <h3 className="text-[11px] font-semibold uppercase tracking-wider mb-2" style={{ color: colors.muted }}>
                    Favorites
                  </h3>
                  <ul className="space-y-2">
                    {favoriteExercises.map((e, idx) => renderExerciseRow(e, idx, 'fav'))}
                  </ul>
                </section>
              )}

              <section>
                <h3 className="text-[11px] font-semibold uppercase tracking-wider mb-2" style={{ color: colors.muted }}>
                  {replaceForExerciseId ? 'Best matches first' : 'All exercises'}
                </h3>
                <ul className="space-y-2">
                  {!filteredAll.length ? (
                    <li className="py-8 text-center text-sm" style={{ color: colors.muted }}>
                      No exercises match
                    </li>
                  ) : (
                    filteredAll.map((e, idx) => renderExerciseRow(e, idx, 'all'))
                  )}
                </ul>
              </section>
            </>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
