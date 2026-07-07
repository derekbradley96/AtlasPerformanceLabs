import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Capacitor } from '@capacitor/core';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { X, Plus, ScanBarcode } from 'lucide-react';
import { motion } from 'framer-motion';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { scanBarcodeValue } from '@/lib/barcodeScanner';
import { fetchOpenFoodFactsProduct, searchFoodProducts } from '@/lib/openFoodFacts';
import { formatNumber } from '@/lib/format';
import { useAuth } from '@/lib/AuthContext';
import {
  HOUSEHOLD_UNIT_OPTIONS,
  gramsToOuncesMass,
  mlToUsFluidOunces,
  portionFromLoggerInputs,
  resolveViewerFoodQuantityUnit,
  resolveViewerNutritionLabelDisplay,
} from '@/lib/nutritionUnits';
import { getSupabase } from '@/lib/supabaseClient';
import { getRecentFoods } from '@/lib/mealLogsService';
import { COMMON_FOOD_TABS } from '@/lib/commonFoodsLibrary';
import {
  getUserBarcodeCacheEntry,
  setUserBarcodeCacheEntry,
  listUserBarcodeCacheEntries,
} from '@/lib/mealBarcodeUserCache';
import { setNativePref } from '@/lib/nativePreferences';
import { hapticSelection, hapticSuccess, hapticWarning } from '@/lib/haptics';
import { colors } from '@/ui/tokens';

function getLocalMondayDateString(d = new Date()) {
  const day = d.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(d.getFullYear(), d.getMonth(), d.getDate() + diffToMonday);
  const y = monday.getFullYear();
  const m = String(monday.getMonth() + 1).padStart(2, '0');
  const dayNum = String(monday.getDate()).padStart(2, '0');
  return `${y}-${m}-${dayNum}`;
}

const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'pre_workout', 'post_workout', 'snack'];
const MEAL_TYPES_PREF_KEY = 'atlas_pref_meal_types';
const BARCODE_SERVING_MODE_KEY = 'atlas_barcode_serving_mode_v1';

function normalizeMealTypeForForm(mt) {
  const t = String(mt || 'snack').toLowerCase();
  if (t === 'pre') return 'pre_workout';
  if (t === 'post') return 'post_workout';
  return MEAL_TYPES.includes(t) ? t : 'snack';
}

function pickFoodEmoji(name) {
  const n = String(name || '').toLowerCase();
  if (/chicken|turkey|poultry|duck/.test(n)) return '🍗';
  if (/beef|steak|bison|venison|lamb|ham|jerky|pork/.test(n)) return '🥩';
  if (/egg|scrambl/.test(n)) return '🥚';
  if (/fish|salmon|cod|tuna|prawn|shrimp|mackerel|sardine|tilapia/.test(n)) return '🐟';
  if (/rice|pasta|noodle|pho|ramen|couscous|quinoa|oats|porridge|granola/.test(n)) return '🍚';
  if (/bread|toast|bagel|wrap|tortilla/.test(n)) return '🍞';
  if (/banana|berry|blueberr|apple|orange|grape|mango|watermelon|pineapple|pear/.test(n)) return '🍌';
  if (/yogurt|quark|skyr|cottage|milk/.test(n)) return '🥛';
  if (/cheese|cheddar|feta|mozzarella|halloumi/.test(n)) return '🧀';
  if (/potato|sweet potato/.test(n)) return '🥔';
  if (/avocado|almond|walnut|cashew|peanut|nut|seed|oil|butter|mayo|chocolate/.test(n)) return '🥜';
  if (/burger|pizza|burrito|sandwich|meal|stir fry|prep|english|sushi/.test(n)) return '🍽️';
  if (/shake|smoothie|bar|gel|drink|pre-workout|preworkout|bcaa|creatine/.test(n)) return '🥤';
  if (/broccoli|salad|vegetable/.test(n)) return '🥗';
  return '🍽️';
}

function isLikelyLiquid(servingText) {
  const t = String(servingText || '').toLowerCase();
  return /\bml\b|fl\s*oz|fluid/i.test(t);
}

function normalizeBarcodeMealType(mt) {
  const t = String(mt || 'snack').toLowerCase();
  if (['breakfast', 'lunch', 'dinner', 'snack', 'pre_workout', 'post_workout'].includes(t)) return t;
  return 'snack';
}

const MEAL_TYPE_OPTIONS = [
  { value: 'breakfast', label: 'Breakfast' },
  { value: 'lunch', label: 'Lunch' },
  { value: 'dinner', label: 'Dinner' },
  { value: 'pre_workout', label: 'Pre-workout' },
  { value: 'post_workout', label: 'Post-workout' },
  { value: 'snack', label: 'Snack' },
];

function getMealTypeForLocalTime() {
  const h = new Date().getHours();
  if (h < 11) return 'breakfast';
  if (h < 14) return 'lunch';
  if (h < 17) return 'snack';
  return 'dinner';
}

export default function MealLogForm({
  onSubmit,
  isLoading,
  openFormSignal = 0,
  openScannerSignal = 0,
  hideCollapsedActions = false,
  supabaseEnabled = false,
  profileId = null,
  clientId = null,
  calendarDayKey = null,
  recentFoodsFallback,
  presetMealType = null,
}) {
  const { profile } = useAuth();
  const foodQtyPref = resolveViewerFoodQuantityUnit(profile);
  const labelPref = resolveViewerNutritionLabelDisplay(profile);

  const [mealType, setMealType] = useState(() => normalizeMealTypeForForm(getMealTypeForLocalTime()));
  const setMealTypeWithPref = useCallback((nextType) => {
    const normalized = normalizeMealTypeForForm(nextType);
    hapticSelection();
    setMealType(normalized);
    void setNativePref(MEAL_TYPES_PREF_KEY, [normalized]);
  }, []);

  const [calories, setCalories] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fats, setFats] = useState('');
  const [food, setFood] = useState('');
  const [portionAmount, setPortionAmount] = useState('');
  const [quickSolidLiquid, setQuickSolidLiquid] = useState('solid');
  const [householdUnit, setHouseholdUnit] = useState('tbsp');
  const [householdAmount, setHouseholdAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [lookupOpen, setLookupOpen] = useState(false);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState('');
  const [manualBarcode, setManualBarcode] = useState('');
  const [lookupBarcode, setLookupBarcode] = useState('');
  const [scannedFood, setScannedFood] = useState(null);
  const [consumedGrams, setConsumedGrams] = useState('100');
  const [consumedServings, setConsumedServings] = useState('1');
  const [manualCalories, setManualCalories] = useState('');
  const [manualProtein, setManualProtein] = useState('');
  const [manualCarbs, setManualCarbs] = useState('');
  const [manualFats, setManualFats] = useState('');
  /** null = use profile `nutrition_label_display` */
  const [barcodeLabelOverride, setBarcodeLabelOverride] = useState(null);
  const [barcodeServingMode, setBarcodeServingMode] = useState(() => {
    if (typeof localStorage === 'undefined') return '100g';
    try {
      const v = localStorage.getItem(BARCODE_SERVING_MODE_KEY);
      if (v === '100g' || v === 'serving' || v === 'custom') return v;
    } catch {
      /* ignore */
    }
    return '100g';
  });
  const [customBarcodeAmount, setCustomBarcodeAmount] = useState('');
  const [webBarcodeInput, setWebBarcodeInput] = useState('');
  const [commonFoodTab, setCommonFoodTab] = useState('protein');
  const [foodSearchQuery, setFoodSearchQuery] = useState('');
  const [dbSearchResults, setDbSearchResults] = useState([]);
  const [dbSearching, setDbSearching] = useState(false);
  const isNativeApp = Capacitor.isNativePlatform();
  const recentScans = useMemo(() => listUserBarcodeCacheEntries(10), [lookupOpen, showForm]);

  const effectiveBarcodeLabel = barcodeLabelOverride ?? labelPref;

  const dayKey = calendarDayKey || new Date().toISOString().split('T')[0];

  useEffect(() => {
    try {
      localStorage.setItem(BARCODE_SERVING_MODE_KEY, barcodeServingMode);
    } catch {
      /* ignore */
    }
  }, [barcodeServingMode]);

  useEffect(() => {
    if (!showForm || presetMealType) return;
    setMealType(normalizeMealTypeForForm(getMealTypeForLocalTime()));
  }, [showForm, presetMealType]);

  useEffect(() => {
    const next = normalizeMealTypeForForm(presetMealType);
    if (next) setMealTypeWithPref(next);
  }, [presetMealType, setMealTypeWithPref]);
  const weekSince = useMemo(() => getLocalMondayDateString(new Date(`${dayKey}T12:00:00`)), [dayKey]);

  const { data: remoteRecentFoods } = useQuery({
    queryKey: ['meal-form-recent-foods', profileId, clientId, weekSince, dayKey],
    queryFn: async () => {
      const sb = getSupabase();
      if (!sb) return [];
      return getRecentFoods({
        supabase: sb,
        profileId: profileId || null,
        clientId: clientId || null,
        limit: 20,
        sinceLogDate: weekSince,
      });
    },
    enabled: Boolean(showForm && supabaseEnabled && (profileId || clientId)),
  });

  const recentFoodSources = useMemo(() => {
    if (remoteRecentFoods?.length) return remoteRecentFoods;
    if (Array.isArray(recentFoodsFallback)) return recentFoodsFallback;
    return [];
  }, [remoteRecentFoods, recentFoodsFallback]);

  const needle = foodSearchQuery.trim().toLowerCase();
  const recentFiltered = useMemo(() => {
    if (!needle) return recentFoodSources;
    return recentFoodSources.filter((r) => String(r?.food_name || '').toLowerCase().includes(needle));
  }, [recentFoodSources, needle]);

  const commonFiltered = useMemo(() => {
    const tab = COMMON_FOOD_TABS.find((t) => t.id === commonFoodTab) || COMMON_FOOD_TABS[0];
    let items = tab.items;
    if (needle) items = items.filter((it) => `${it.label} ${it.food_name}`.toLowerCase().includes(needle));
    return items;
  }, [needle, commonFoodTab]);

  const applyPrefillFromLogRow = useCallback(
    (row) => {
      if (!row) return;
      setMealTypeWithPref(normalizeMealTypeForForm(row.meal_type));
      setCalories(row.calories != null ? String(Math.round(Number(row.calories))) : '');
      setProtein(row.protein_g != null ? String(Number(row.protein_g)) : '');
      setCarbs(row.carbs_g != null ? String(Number(row.carbs_g)) : '');
      setFats(row.fats_g != null ? String(Number(row.fats_g)) : '');
      setFood(String(row.food_name || '').trim());
      setNotes('');

      if (foodQtyPref === 'household') {
        if (row.household_unit && row.household_amount != null && Number(row.household_amount) > 0) {
          setHouseholdUnit(String(row.household_unit));
          setHouseholdAmount(String(row.household_amount));
        } else {
          setHouseholdAmount('');
        }
        setPortionAmount('');
      } else if (foodQtyPref === 'oz_fl_oz') {
        if (row.portion_ml != null && Number(row.portion_ml) > 0) {
          setQuickSolidLiquid('liquid');
          setPortionAmount(String(mlToUsFluidOunces(Number(row.portion_ml)).toFixed(1)));
        } else if (row.portion_grams != null && Number(row.portion_grams) > 0) {
          setQuickSolidLiquid('solid');
          setPortionAmount(String(gramsToOuncesMass(Number(row.portion_grams)).toFixed(1)));
        } else {
          setPortionAmount('');
        }
      } else if (row.portion_ml != null && Number(row.portion_ml) > 0) {
        setQuickSolidLiquid('liquid');
        setPortionAmount(String(Math.round(Number(row.portion_ml))));
      } else if (row.portion_grams != null && Number(row.portion_grams) > 0) {
        setQuickSolidLiquid('solid');
        setPortionAmount(String(Math.round(Number(row.portion_grams))));
      } else {
        setPortionAmount('');
      }
    },
    [foodQtyPref],
  );

  const applyCommonFoodItem = useCallback(
    (item) => {
      setMealTypeWithPref(normalizeMealTypeForForm(item.meal_type || mealType));
      setCalories(String(Math.round(Number(item.calories) || 0)));
      setProtein(String(Number(item.protein_g) || 0));
      setCarbs(String(Number(item.carbs_g) || 0));
      setFats(String(Number(item.fats_g) || 0));
      setFood(String(item.food_name || '').trim());
      setNotes('');
      if (foodQtyPref === 'household') {
        setHouseholdAmount('');
        setPortionAmount('');
      } else if (foodQtyPref === 'oz_fl_oz') {
        if (item.portion_ml != null && Number(item.portion_ml) > 0) {
          setQuickSolidLiquid('liquid');
          setPortionAmount(String(mlToUsFluidOunces(Number(item.portion_ml)).toFixed(1)));
        } else if (item.portion_grams != null && Number(item.portion_grams) > 0) {
          setQuickSolidLiquid('solid');
          setPortionAmount(String(gramsToOuncesMass(Number(item.portion_grams)).toFixed(1)));
        } else {
          setPortionAmount('');
        }
      } else if (item.portion_ml != null && Number(item.portion_ml) > 0) {
        setQuickSolidLiquid('liquid');
        setPortionAmount(String(Math.round(Number(item.portion_ml))));
      } else if (item.portion_grams != null && Number(item.portion_grams) > 0) {
        setQuickSolidLiquid('solid');
        setPortionAmount(String(Math.round(Number(item.portion_grams))));
      } else {
        setPortionAmount('');
      }
    },
    [foodQtyPref, mealType, setMealTypeWithPref],
  );

  const quantityFieldLabel = useMemo(() => {
    if (foodQtyPref === 'household') return 'Amount';
    if (foodQtyPref === 'oz_fl_oz') return quickSolidLiquid === 'liquid' ? 'Fluid ounces' : 'Ounces (oz)';
    return quickSolidLiquid === 'liquid' ? 'Millilitres' : 'Grams';
  }, [foodQtyPref, quickSolidLiquid]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!calories) {
      hapticWarning();
      return;
    }

    const trimmedFood = (food || '').trim();
    const portion = portionFromLoggerInputs({
      foodQuantityUnit: foodQtyPref,
      amount: portionAmount,
      entryMode: quickSolidLiquid === 'liquid' ? 'liquid' : 'solid',
      householdUnit,
      householdAmount,
    });

    const qtySummary =
      portion.portion_grams != null
        ? `${Math.round(portion.portion_grams)}g`
        : portion.portion_ml != null
          ? `${Math.round(portion.portion_ml)}ml`
          : portion.household_unit && portion.household_amount != null
            ? `${portion.household_amount} ${portion.household_unit}`
            : null;

    const formattedFood = [trimmedFood || null, qtySummary].filter(Boolean).join(' - ');
    const extraNotes = (notes || '').trim();
    const finalNotes = [formattedFood || null, extraNotes || null].filter(Boolean).join(' | ') || null;

    const payload = {
      meal_type: mealType,
      calories: parseFloat(calories),
      protein_g: protein ? parseFloat(protein) : null,
      carbs_g: carbs ? parseFloat(carbs) : null,
      fats_g: fats ? parseFloat(fats) : null,
      notes: finalNotes,
      food_name: trimmedFood || null,
      portion_grams: portion.portion_grams,
      portion_ml: portion.portion_ml,
      household_unit: portion.household_unit,
      household_amount: portion.household_amount,
    };

    try {
      await Promise.resolve(onSubmit?.(payload));
    } catch (err) {
      hapticWarning();
      toast.error(err?.message || 'Could not save meal');
      return;
    }
    hapticSuccess();

    setMealTypeWithPref('breakfast');
    setCalories('');
    setProtein('');
    setCarbs('');
    setFats('');
    setFood('');
    setPortionAmount('');
    setQuickSolidLiquid('solid');
    setHouseholdUnit('tbsp');
    setHouseholdAmount('');
    setNotes('');
    setFoodSearchQuery('');
    setShowForm(false);
  };

  const nutritionComplete = useMemo(() => {
    if (!scannedFood) return false;
    return ['calories_per_100g', 'protein_per_100g', 'carbs_per_100g', 'fats_per_100g'].every((k) =>
      Number.isFinite(Number(scannedFood[k]))
    );
  }, [scannedFood]);

  const servingMacrosComplete = useMemo(() => {
    if (!scannedFood) return false;
    return ['calories_per_serving', 'protein_per_serving', 'carbs_per_serving', 'fats_per_serving'].every((k) =>
      Number.isFinite(Number(scannedFood[k]))
    );
  }, [scannedFood]);

  const servingSizeGrams = Number(scannedFood?.serving_size_grams);
  const effectiveGrams = useMemo(() => {
    const customRaw = Number(customBarcodeAmount);
    if (barcodeServingMode === 'custom' && Number.isFinite(customRaw) && customRaw > 0) return customRaw;
    const gramsRaw = Number(consumedGrams);
    if (Number.isFinite(gramsRaw) && gramsRaw > 0) return gramsRaw;
    const servingsRaw = Number(consumedServings);
    if (Number.isFinite(servingsRaw) && servingsRaw > 0 && Number.isFinite(servingSizeGrams) && servingSizeGrams > 0) {
      return servingsRaw * servingSizeGrams;
    }
    return 100;
  }, [barcodeServingMode, customBarcodeAmount, consumedGrams, consumedServings, servingSizeGrams]);

  const storedPortionGramsFromBarcode = useMemo(() => {
    if (!scannedFood) return null;
    if (effectiveBarcodeLabel === 'per_serving' && servingMacrosComplete) {
      const sv = Number(consumedServings);
      if (Number.isFinite(sv) && sv > 0 && Number.isFinite(servingSizeGrams) && servingSizeGrams > 0) {
        return sv * servingSizeGrams;
      }
      return null;
    }
    return Number.isFinite(effectiveGrams) && effectiveGrams > 0 ? effectiveGrams : null;
  }, [
    scannedFood,
    effectiveBarcodeLabel,
    servingMacrosComplete,
    consumedServings,
    servingSizeGrams,
    effectiveGrams,
  ]);

  const consumedMacros = useMemo(() => {
    if (!scannedFood) return null;
    const useServing = effectiveBarcodeLabel === 'per_serving' && servingMacrosComplete;
    if (useServing) {
      const sv = Number(consumedServings);
      const factor = Number.isFinite(sv) && sv > 0 ? sv : 1;
      return {
        calories: Math.max(0, Math.round(Number(scannedFood.calories_per_serving) * factor)),
        protein: Math.max(0, Math.round(Number(scannedFood.protein_per_serving) * factor * 10) / 10),
        carbs: Math.max(0, Math.round(Number(scannedFood.carbs_per_serving) * factor * 10) / 10),
        fats: Math.max(0, Math.round(Number(scannedFood.fats_per_serving) * factor * 10) / 10),
      };
    }
    const factor = effectiveGrams / 100;
    const calories100 = nutritionComplete ? Number(scannedFood.calories_per_100g) : Number(manualCalories || 0);
    const protein100 = nutritionComplete ? Number(scannedFood.protein_per_100g) : Number(manualProtein || 0);
    const carbs100 = nutritionComplete ? Number(scannedFood.carbs_per_100g) : Number(manualCarbs || 0);
    const fats100 = nutritionComplete ? Number(scannedFood.fats_per_100g) : Number(manualFats || 0);
    return {
      calories: Math.max(0, Math.round(calories100 * factor)),
      protein: Math.max(0, Math.round(protein100 * factor * 10) / 10),
      carbs: Math.max(0, Math.round(carbs100 * factor * 10) / 10),
      fats: Math.max(0, Math.round(fats100 * factor * 10) / 10),
    };
  }, [
    scannedFood,
    effectiveGrams,
    effectiveBarcodeLabel,
    servingMacrosComplete,
    consumedServings,
    manualCalories,
    manualCarbs,
    manualFats,
    manualProtein,
    nutritionComplete,
  ]);

  const resetLookupState = () => {
    setLookupLoading(false);
    setLookupError('');
    setLookupBarcode('');
    setScannedFood(null);
    setConsumedGrams('100');
    setConsumedServings('1');
    setManualCalories('');
    setManualProtein('');
    setManualCarbs('');
    setManualFats('');
    setBarcodeLabelOverride(null);
    setBarcodeServingMode('100g');
    setCustomBarcodeAmount('');
  };

  const setManualFromScanned = (foodObj) => {
    setManualCalories(foodObj?.calories_per_100g != null ? String(Math.round(Number(foodObj.calories_per_100g))) : '');
    setManualProtein(foodObj?.protein_per_100g != null ? String(Number(foodObj.protein_per_100g)) : '');
    setManualCarbs(foodObj?.carbs_per_100g != null ? String(Number(foodObj.carbs_per_100g)) : '');
    setManualFats(foodObj?.fats_per_100g != null ? String(Number(foodObj.fats_per_100g)) : '');
  };

  const lookupByBarcode = async (barcodeValue) => {
    const clean = String(barcodeValue || '').trim().replace(/\s+/g, '');
    if (!clean) {
      setLookupError('Enter a barcode');
      return;
    }
    setLookupLoading(true);
    setLookupError('');
    setLookupBarcode(clean);

    const cached = getUserBarcodeCacheEntry(clean);
    if (cached?.product) {
      setScannedFood(cached.product);
      const servingG = Number(cached.product?.serving_size_grams);
      const liquid = isLikelyLiquid(cached.product?.serving_size);
      if (Number.isFinite(servingG) && servingG > 0) {
        setConsumedServings('1');
        setConsumedGrams(String(Math.round(servingG)));
        setBarcodeServingMode('serving');
      } else {
        const defaultAmount = liquid ? 250 : 100;
        setConsumedGrams(String(defaultAmount));
        setBarcodeServingMode('100g');
      }
      setManualFromScanned(cached.product);
      setLookupError('');
      setLookupLoading(false);
      return;
    }

    const result = await fetchOpenFoodFactsProduct(clean);
    if (!result.ok || !result.product) {
      setScannedFood(null);
      setLookupError('Food not found');
      setLookupLoading(false);
      return;
    }
    setScannedFood(result.product);
    setUserBarcodeCacheEntry(clean, { ...result.product, barcode: clean });
    const servingG = Number(result.product?.serving_size_grams);
    const liquid = isLikelyLiquid(result.product?.serving_size);
    if (Number.isFinite(servingG) && servingG > 0) {
      setConsumedServings('1');
      setConsumedGrams(String(Math.round(servingG)));
      setBarcodeServingMode('serving');
    } else {
      const defaultAmount = liquid ? 250 : 100;
      setConsumedGrams(String(defaultAmount));
      setBarcodeServingMode('100g');
    }
    setManualFromScanned(result.product);
    setLookupLoading(false);
  };

  const startScan = async () => {
    setLookupOpen(true);
    setLookupError('');
    setScannedFood(null);
    setBarcodeLabelOverride(null);
    setLookupLoading(true);
    const scan = await scanBarcodeValue();
    if (scan.ok && scan.barcode) {
      await lookupByBarcode(scan.barcode);
      return;
    }
    setLookupLoading(false);
    if (scan.reason === 'native_only') {
      setLookupError('Scanner is available on mobile. Enter barcode manually below.');
      return;
    }
    if (!scan.cancelled) {
      setLookupError('Scan failed. Enter barcode manually below.');
    }
  };

  const confirmScannedFood = async () => {
    if (!scannedFood || !consumedMacros || consumedMacros.calories <= 0) return;
    const g = storedPortionGramsFromBarcode;
    const sourceParts = [scannedFood?.name || null, g != null ? `${Math.round(g)}g` : null, lookupBarcode ? `barcode:${lookupBarcode}` : null].filter(Boolean);
    const payload = {
      meal_type: normalizeBarcodeMealType(mealType),
      calories: consumedMacros.calories,
      protein_g: consumedMacros.protein,
      carbs_g: consumedMacros.carbs,
      fats_g: consumedMacros.fats,
      notes: sourceParts.join(' | '),
      food_name: scannedFood?.name?.trim() || null,
      portion_grams: g,
      portion_ml: null,
      household_unit: null,
      household_amount: null,
      source: 'barcode',
      barcode: lookupBarcode || null,
    };

    try {
      await Promise.resolve(onSubmit?.(payload));
    } catch (err) {
      hapticWarning();
      toast.error(err?.message || 'Could not save meal');
      return;
    }
    hapticSuccess();

    const code = String(lookupBarcode || '').trim();
    if (code) {
      const c100 = Number.isFinite(Number(scannedFood.calories_per_100g))
        ? Number(scannedFood.calories_per_100g)
        : Number(manualCalories);
      const p100 = Number.isFinite(Number(scannedFood.protein_per_100g))
        ? Number(scannedFood.protein_per_100g)
        : Number(manualProtein);
      const cb100 = Number.isFinite(Number(scannedFood.carbs_per_100g))
        ? Number(scannedFood.carbs_per_100g)
        : Number(manualCarbs);
      const f100 = Number.isFinite(Number(scannedFood.fats_per_100g))
        ? Number(scannedFood.fats_per_100g)
        : Number(manualFats);
      const productForCache = {
        ...scannedFood,
        barcode: code,
        source: scannedFood?.source || 'user_cache',
        calories_per_100g: Number.isFinite(c100) ? c100 : null,
        protein_per_100g: Number.isFinite(p100) ? p100 : null,
        carbs_per_100g: Number.isFinite(cb100) ? cb100 : null,
        fats_per_100g: Number.isFinite(f100) ? f100 : null,
      };
      setUserBarcodeCacheEntry(code, productForCache);
    }

    setLookupOpen(false);
    resetLookupState();
    toast.success(`\u2713 ${scannedFood?.name || 'Food'} logged`);
  };

  // Debounced Open Food Facts text search — fills the "Food database" section under recents.
  useEffect(() => {
    const q = foodSearchQuery.trim();
    if (!showForm || q.length < 3) {
      setDbSearchResults([]);
      setDbSearching(false);
      return undefined;
    }
    let cancelled = false;
    setDbSearching(true);
    const t = setTimeout(async () => {
      const result = await searchFoodProducts(q, { pageSize: 12 });
      if (cancelled) return;
      setDbSearchResults(result.ok ? result.products : []);
      setDbSearching(false);
    }, 450);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [foodSearchQuery, showForm]);

  /** Open the same confirm sheet used for barcode scans with a text-search result. */
  const openConfirmFromSearchResult = useCallback((product) => {
    if (!product) return;
    hapticSelection();
    setLookupOpen(true);
    setLookupBarcode(String(product.barcode || '').trim());
    setScannedFood(product);
    setLookupError('');
    const servingG = Number(product?.serving_size_grams);
    const liquid = isLikelyLiquid(product?.serving_size);
    if (Number.isFinite(servingG) && servingG > 0) {
      setConsumedServings('1');
      setConsumedGrams(String(Math.round(servingG)));
      setBarcodeServingMode('serving');
    } else {
      setConsumedGrams(String(liquid ? 250 : 100));
      setBarcodeServingMode('100g');
    }
    setManualFromScanned(product);
  }, []);

  const openQuickConfirmFromCache = useCallback((entry) => {
    const code = String(entry?.barcode || '').trim();
    const product = entry?.product;
    if (!code || !product) return;
    setLookupOpen(true);
    setLookupBarcode(code);
    setScannedFood(product);
    setLookupError('');
    const servingG = Number(product?.serving_size_grams);
    const liquid = isLikelyLiquid(product?.serving_size);
    if (Number.isFinite(servingG) && servingG > 0) {
      setConsumedServings('1');
      setConsumedGrams(String(Math.round(servingG)));
      setBarcodeServingMode('serving');
    } else {
      setConsumedGrams(String(liquid ? 250 : 100));
      setBarcodeServingMode('100g');
    }
    setManualFromScanned(product);
  }, []);

  React.useEffect(() => {
    if (!openFormSignal) return;
    setShowForm(true);
  }, [openFormSignal]);

  React.useEffect(() => {
    if (!openScannerSignal) return;
    startScan();
     
  }, [openScannerSignal]);

  // Confirm sheet is shared by the collapsed actions AND the open form (text search opens it too).
  const lookupSheet = isNativeApp ? (
          <Drawer open={lookupOpen} onOpenChange={(open) => { setLookupOpen(open); if (!open) resetLookupState(); }}>
            <DrawerContent className="border-slate-700 bg-slate-900 text-slate-100">
              <DrawerHeader>
                <DrawerTitle>Log scanned food</DrawerTitle>
                <DrawerDescription>Scan → confirm serving → one tap to log.</DrawerDescription>
              </DrawerHeader>
              <div className="px-4 pb-2 space-y-3">
                {scannedFood ? (
                  <div className="rounded-lg border border-slate-700 bg-slate-800/60 p-3 space-y-3">
                    <div className="flex gap-3">
                      {scannedFood.image ? <img src={scannedFood.image} alt={scannedFood.name} className="w-14 h-14 rounded-md object-cover border border-slate-700" /> : <div className="w-14 h-14 rounded-md bg-slate-700 border border-slate-700" />}
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-white truncate">{scannedFood.name}{scannedFood.brands ? ` — ${scannedFood.brands}` : ''}</p>
                        <p className="text-[11px] text-slate-400">Source: {scannedFood?.source || 'barcode lookup'}</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button type="button" className={`text-[11px] px-2 py-1 rounded border ${barcodeServingMode === '100g' ? 'border-blue-500 bg-blue-500/20 text-white' : 'border-slate-600 text-slate-300'}`} onClick={() => setBarcodeServingMode('100g')}>100g</button>
                      {Number.isFinite(servingSizeGrams) && servingSizeGrams > 0 ? (
                        <button type="button" className={`text-[11px] px-2 py-1 rounded border ${barcodeServingMode === 'serving' ? 'border-blue-500 bg-blue-500/20 text-white' : 'border-slate-600 text-slate-300'}`} onClick={() => { setBarcodeServingMode('serving'); setConsumedServings('1'); }}>
                          1 serving ({Math.round(servingSizeGrams)}g)
                        </button>
                      ) : null}
                      <button type="button" className={`text-[11px] px-2 py-1 rounded border ${barcodeServingMode === 'custom' ? 'border-blue-500 bg-blue-500/20 text-white' : 'border-slate-600 text-slate-300'}`} onClick={() => setBarcodeServingMode('custom')}>Custom</button>
                    </div>
                    {barcodeServingMode === 'custom' ? (
                      <Input type="number" value={customBarcodeAmount} onChange={(e) => setCustomBarcodeAmount(e.target.value)} placeholder={isLikelyLiquid(scannedFood?.serving_size) ? 'Custom ml' : 'Custom grams'} className="bg-slate-800 border-slate-700" />
                    ) : null}
                    <div className="flex flex-wrap gap-2">
                      {(isLikelyLiquid(scannedFood?.serving_size) ? [150, 250, 500] : [50, 100, 150]).map((amt) => (
                        <button key={amt} type="button" className="text-[11px] px-2 py-1 rounded border border-slate-600 text-slate-300" onClick={() => { setBarcodeServingMode('custom'); setCustomBarcodeAmount(String(amt)); }}>
                          {isLikelyLiquid(scannedFood?.serving_size) ? `${amt}ml` : `${amt}g`}
                        </button>
                      ))}
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {MEAL_TYPE_OPTIONS.map((type) => (
                        <button
                          key={type.value}
                          type="button"
                          onClick={() => setMealTypeWithPref(type.value)}
                          className={`py-1.5 rounded text-xs font-medium ${
                            mealType === type.value
                              ? 'bg-blue-500 text-white'
                              : type.value === 'pre_workout' || type.value === 'post_workout'
                                ? 'text-slate-100'
                                : 'bg-slate-700 text-slate-300'
                          }`}
                          style={
                            mealType !== type.value && (type.value === 'pre_workout' || type.value === 'post_workout')
                              ? { background: colors.primarySubtle }
                              : undefined
                          }
                        >
                          {type.label}
                        </button>
                      ))}
                    </div>
                    {consumedMacros ? <p className="text-xs text-slate-300">Cal: {Math.round(consumedMacros.calories)}  P: {formatNumber(consumedMacros.protein)}g  C: {formatNumber(consumedMacros.carbs)}g  F: {formatNumber(consumedMacros.fats)}g</p> : null}
                  </div>
                ) : lookupError ? (
                  <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3">
                    <p className="text-sm text-amber-200">Product not found ({lookupBarcode || manualBarcode || webBarcodeInput}).</p>
                    <button type="button" className="text-xs text-slate-200 underline mt-1 mr-3" onClick={() => { setLookupOpen(false); setFood(''); setShowForm(true); }}>
                      Open manual entry
                    </button>
                    <button type="button" className="text-xs text-blue-300 underline mt-1" onClick={() => window.open(`https://world.openfoodfacts.org/product/${encodeURIComponent(lookupBarcode || manualBarcode || webBarcodeInput)}`, '_blank', 'noopener,noreferrer')}>Help improve our database</button>
                  </div>
                ) : null}
              </div>
              <DrawerFooter>
                <Button type="button" className="bg-blue-500 hover:bg-blue-600 text-white" onClick={confirmScannedFood} disabled={!scannedFood || !consumedMacros || consumedMacros.calories <= 0 || lookupLoading}>Log this food</Button>
                <Button type="button" variant="outline" className="border-slate-700" onClick={startScan}>Search again</Button>
              </DrawerFooter>
            </DrawerContent>
          </Drawer>
        ) : (
          <Dialog open={lookupOpen} onOpenChange={(open) => { setLookupOpen(open); if (!open) resetLookupState(); }}>
            <DialogContent className="border-slate-700 bg-slate-900 text-slate-100 sm:max-w-lg">
              <DialogHeader>
                <DialogTitle className="text-white">Confirm food</DialogTitle>
                <DialogDescription className="text-slate-400">One tap logs this barcode entry.</DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                {scannedFood ? (
                  <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-3 space-y-2">
                    <p className="text-sm font-semibold text-white">{scannedFood.name}{scannedFood.brands ? ` — ${scannedFood.brands}` : ''}</p>
                    <div className="flex flex-wrap gap-2">
                      {MEAL_TYPE_OPTIONS.map((type) => (
                        <button
                          key={type.value}
                          type="button"
                          onClick={() => setMealTypeWithPref(type.value)}
                          className={`py-1 px-2 rounded text-xs ${
                            mealType === type.value
                              ? 'bg-blue-500 text-white'
                              : type.value === 'pre_workout' || type.value === 'post_workout'
                                ? 'text-slate-100'
                                : 'bg-slate-700 text-slate-300'
                          }`}
                          style={
                            mealType !== type.value && (type.value === 'pre_workout' || type.value === 'post_workout')
                              ? { background: colors.primarySubtle }
                              : undefined
                          }
                        >
                          {type.label}
                        </button>
                      ))}
                    </div>
                    {consumedMacros ? <p className="text-xs text-slate-300">Cal: {Math.round(consumedMacros.calories)} · P {formatNumber(consumedMacros.protein)}g · C {formatNumber(consumedMacros.carbs)}g · F {formatNumber(consumedMacros.fats)}g</p> : null}
                  </div>
                ) : (
                  <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3">
                    <p className="text-sm text-amber-200">Product not found ({lookupBarcode || webBarcodeInput}).</p>
                    <button type="button" className="text-xs text-slate-200 underline mt-1 mr-3" onClick={() => { setLookupOpen(false); setFood(''); setShowForm(true); }}>
                      Open manual entry
                    </button>
                    <button type="button" className="text-xs text-blue-300 underline mt-1" onClick={() => window.open(`https://world.openfoodfacts.org/product/${encodeURIComponent(lookupBarcode || webBarcodeInput)}`, '_blank', 'noopener,noreferrer')}>Help improve our database</button>
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" className="w-full sm:w-auto border-slate-700" onClick={() => { setLookupOpen(false); resetLookupState(); }}>
                  Cancel
                </Button>
                <Button type="button" className="w-full sm:w-auto bg-blue-500 hover:bg-blue-600 text-white" onClick={confirmScannedFood} disabled={!scannedFood || !consumedMacros || consumedMacros.calories <= 0 || lookupLoading}>
                  Log this food
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        );

  if (!showForm) {
    if (hideCollapsedActions) return null;
    return (
      <>
        {recentScans.length > 0 ? (
          <div className="mb-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-2">Recent scans</p>
            <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] md:grid md:grid-cols-2 [&::-webkit-scrollbar]:hidden">
              {recentScans.map((entry) => {
                const p = entry.product || {};
                return (
                  <div key={`${entry.barcode}-${entry.cachedAt}`} className="min-w-[220px] rounded-lg border border-slate-700 bg-slate-900/40 p-2">
                    <p className="text-xs font-semibold text-slate-100 truncate">{p.name || 'Scanned food'}</p>
                    <p className="text-[11px] text-slate-400">
                      Cal {Math.round(Number(p.calories_per_100g) || 0)} · P {formatNumber(Number(p.protein_per_100g) || 0)} · C {formatNumber(Number(p.carbs_per_100g) || 0)} · F {formatNumber(Number(p.fats_per_100g) || 0)}
                    </p>
                    <button
                      type="button"
                      className="mt-1 text-xs font-semibold text-blue-300"
                      onClick={() => openQuickConfirmFromCache(entry)}
                    >
                      + Log again
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}
        <div className="flex flex-col gap-2">
          {isNativeApp ? (
            <div>
              <Button
                type="button"
                variant="outline"
                className="w-full h-11 border-slate-600 bg-slate-800/40 text-slate-200 hover:bg-slate-800 hover:text-white"
                onClick={startScan}
                disabled={lookupLoading}
              >
                <ScanBarcode className="w-4 h-4 mr-2 shrink-0" aria-hidden />
                {lookupLoading ? 'Scanning...' : 'Scan barcode'}
              </Button>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 500,
                  color: colors.success,
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                  display: 'block',
                  textAlign: 'center',
                  marginTop: 2,
                }}
              >
                Always free
              </span>
            </div>
          ) : (
            <div className="rounded-lg border border-slate-700 bg-slate-900/40 p-2">
              <p className="text-xs text-slate-400 mb-2">Enter barcode</p>
              <div className="flex gap-2">
                <Input
                  value={webBarcodeInput}
                  onChange={(e) => setWebBarcodeInput(e.target.value)}
                  placeholder="e.g. 5000169105718"
                  className="bg-slate-800 border-slate-700"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setLookupOpen(true);
                    void lookupByBarcode(webBarcodeInput);
                  }}
                >
                  Search
                </Button>
              </div>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 500,
                  color: colors.success,
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                  display: 'block',
                  textAlign: 'center',
                  marginTop: 6,
                }}
              >
                Always free
              </span>
            </div>
          )}
          <motion.button
            type="button"
            whileTap={{ scale: 0.98 }}
            onClick={() => setShowForm(true)}
            className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-slate-600 rounded-xl text-slate-300 hover:text-white hover:border-slate-500 transition-colors"
          >
            <Plus className="w-5 h-5" />
            Log Meal
          </motion.button>
        </div>

        {lookupSheet}
      </>
    );
  }

  return (
    <motion.form
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      onSubmit={handleSubmit}
      className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4 space-y-3"
    >
      <div>
        <label className="text-xs font-medium text-slate-300 mb-1 block">Search foods</label>
        {recentFoodSources.length > 0 && (
          <div style={{ marginBottom: 8 }}>
            <p
              style={{
                fontSize: 11,
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                color: 'rgba(148,163,184,0.7)',
                margin: '0 0 6px',
              }}
            >
              Quick add
            </p>
            <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 2 }}>
              {recentFoodSources.slice(0, 5).map((foodRow, idx) => (
                <button
                  key={foodRow.id ?? foodRow.food_name ?? idx}
                  type="button"
                  onClick={() => applyPrefillFromLogRow(foodRow)}
                  style={{
                    flexShrink: 0,
                    padding: '5px 12px',
                    borderRadius: 20,
                    border: '1px solid rgba(100,116,139,0.3)',
                    background: 'rgba(30,41,59,0.6)',
                    color: '#cbd5e1',
                    fontSize: 12,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    maxWidth: 160,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {pickFoodEmoji(foodRow.food_name)} {foodRow.food_name}
                </button>
              ))}
            </div>
          </div>
        )}
        <Input
          type="search"
          value={foodSearchQuery}
          onChange={(e) => setFoodSearchQuery(e.target.value)}
          placeholder="Search foods — e.g. chicken breast"
          className="bg-slate-700 border-slate-600"
        />
      </div>

      {foodSearchQuery.trim().length >= 3 ? (
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-2">
            Food database{dbSearching ? ' — searching…' : ''}
          </p>
          {dbSearchResults.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[min(36vh,280px)] overflow-y-auto pr-1">
              {dbSearchResults.map((product, idx) => (
                <button
                  key={product.barcode || `${product.name}-${idx}`}
                  type="button"
                  onClick={() => openConfirmFromSearchResult(product)}
                  className="rounded-lg border border-slate-600 bg-slate-800/60 px-3 py-2 text-left hover:border-slate-500 hover:bg-slate-800"
                >
                  <p className="text-xs font-medium text-slate-100 truncate">
                    {pickFoodEmoji(product.name)} {product.name}
                    {product.brands ? <span className="text-slate-400"> — {product.brands}</span> : null}
                  </p>
                  <p className="text-[11px] text-slate-400">
                    Per 100g: {Math.round(Number(product.calories_per_100g) || 0)} kcal
                    {Number.isFinite(Number(product.protein_per_100g)) ? ` · P ${formatNumber(Number(product.protein_per_100g))}g` : ''}
                    {Number.isFinite(Number(product.carbs_per_100g)) ? ` · C ${formatNumber(Number(product.carbs_per_100g))}g` : ''}
                    {Number.isFinite(Number(product.fats_per_100g)) ? ` · F ${formatNumber(Number(product.fats_per_100g))}g` : ''}
                  </p>
                </button>
              ))}
            </div>
          ) : !dbSearching ? (
            <p className="text-xs text-slate-500">No database matches — check recents below or enter macros manually.</p>
          ) : null}
        </div>
      ) : null}

      {recentFiltered.length > 0 ? (
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-2">This week</p>
          <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] md:grid md:grid-cols-3 md:gap-2 md:overflow-x-visible md:pb-0 [&::-webkit-scrollbar]:hidden">
            {recentFiltered.map((row) => {
              const name = String(row?.food_name || '').trim() || 'Meal';
              const key = row?.id || `${name}-${row?.logged_at || ''}`;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => applyPrefillFromLogRow(row)}
                  className="shrink-0 md:shrink rounded-full border border-slate-600 bg-slate-800/80 px-3 py-2 text-left text-xs font-medium text-slate-100 hover:border-slate-500 hover:bg-slate-800 md:rounded-lg md:text-left"
                >
                  <span className="whitespace-nowrap">
                    {pickFoodEmoji(name)} {name}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      <div className="rounded-lg border border-slate-700/60 bg-slate-900/40 p-3 space-y-2">
        <p className="text-xs font-semibold text-slate-200">Common foods</p>
        <div className="flex gap-1 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] md:flex-wrap md:overflow-x-visible [&::-webkit-scrollbar]:hidden">
          {COMMON_FOOD_TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setCommonFoodTab(t.id)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-[11px] font-semibold capitalize ${
                commonFoodTab === t.id ? 'bg-blue-500 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-[min(40vh,320px)] overflow-y-auto pr-1">
          {commonFiltered.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => applyCommonFoodItem(item)}
              className="rounded-lg border border-slate-600 bg-slate-800/60 px-2 py-2 text-left text-xs text-slate-100 hover:border-slate-500 hover:bg-slate-800"
            >
              <span className="font-medium">
                {item.emoji} {item.label}
              </span>
            </button>
          ))}
        </div>
        {commonFiltered.length === 0 ? <p className="text-xs text-slate-500">No matches in this tab.</p> : null}
      </div>

      <div className="grid grid-cols-3 gap-2">
        {MEAL_TYPE_OPTIONS.map((type) => (
          <button
            key={type.value}
            type="button"
            onClick={() => setMealTypeWithPref(type.value)}
            className={`py-2 px-2 rounded-lg text-xs font-medium transition-colors ${
              mealType === type.value
                ? 'bg-blue-500 text-white'
                : type.value === 'pre_workout' || type.value === 'post_workout'
                  ? 'text-slate-100'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }`}
            style={
              mealType !== type.value && (type.value === 'pre_workout' || type.value === 'post_workout')
                ? { background: colors.primarySubtle }
                : undefined
            }
          >
            {type.label}
          </button>
        ))}
      </div>

      <div>
        <label className="text-xs font-medium text-slate-300 mb-1 block" htmlFor="atlas-meal-calories">Calories *</label>
        <Input
          id="atlas-meal-calories"
          type="number"
          value={calories}
          onChange={(e) => setCalories(e.target.value)}
          onFocus={(e) => e.target.select()}
          placeholder="e.g., 450"
          className="bg-slate-700 border-slate-600"
          style={{ scrollMarginBottom: 120 }}
          required
          aria-label="Calories for this meal"
        />
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className="text-xs font-medium text-slate-300 mb-1 block" htmlFor="atlas-meal-protein">Protein (g)</label>
          <Input
            id="atlas-meal-protein"
            type="number"
            value={protein}
            onChange={(e) => setProtein(e.target.value)}
            onFocus={(e) => e.target.select()}
            placeholder="Optional"
            className="bg-slate-700 border-slate-600"
            style={{ scrollMarginBottom: 120 }}
            aria-label="Protein grams"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-slate-300 mb-1 block" htmlFor="atlas-meal-carbs">Carbs (g)</label>
          <Input
            id="atlas-meal-carbs"
            type="number"
            value={carbs}
            onChange={(e) => setCarbs(e.target.value)}
            onFocus={(e) => e.target.select()}
            placeholder="Optional"
            className="bg-slate-700 border-slate-600"
            style={{ scrollMarginBottom: 120 }}
            aria-label="Carbohydrate grams"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-slate-300 mb-1 block" htmlFor="atlas-meal-fats">Fats (g)</label>
          <Input
            id="atlas-meal-fats"
            type="number"
            value={fats}
            onChange={(e) => setFats(e.target.value)}
            onFocus={(e) => e.target.select()}
            placeholder="Optional"
            className="bg-slate-700 border-slate-600"
            style={{ scrollMarginBottom: 120 }}
            aria-label="Fat grams"
          />
        </div>
      </div>

      {foodQtyPref !== 'household' ? (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setQuickSolidLiquid('solid')}
            className={`flex-1 py-2 rounded-lg text-xs font-semibold ${
              quickSolidLiquid === 'solid' ? 'bg-blue-500 text-white' : 'bg-slate-700 text-slate-300'
            }`}
          >
            {foodQtyPref === 'oz_fl_oz' ? 'Solid' : 'Solid (g)'}
          </button>
          <button
            type="button"
            onClick={() => setQuickSolidLiquid('liquid')}
            className={`flex-1 py-2 rounded-lg text-xs font-semibold ${
              quickSolidLiquid === 'liquid' ? 'bg-blue-500 text-white' : 'bg-slate-700 text-slate-300'
            }`}
          >
            {foodQtyPref === 'oz_fl_oz' ? 'Liquid' : 'Liquid (ml)'}
          </button>
        </div>
      ) : null}

      {foodQtyPref === 'household' ? (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs font-medium text-slate-300 mb-1 block">Unit</label>
            <select
              value={householdUnit}
              onChange={(e) => setHouseholdUnit(e.target.value)}
              className="w-full h-10 rounded-md border border-slate-600 bg-slate-700 text-sm text-slate-100 px-2"
            >
              {HOUSEHOLD_UNIT_OPTIONS.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-300 mb-1 block">Amount</label>
            <Input
              type="number"
              value={householdAmount}
              onChange={(e) => setHouseholdAmount(e.target.value)}
              onFocus={(e) => e.target.select()}
              placeholder="e.g., 2"
              className="bg-slate-700 border-slate-600"
              min={0}
              step="0.25"
            />
          </div>
        </div>
      ) : null}

      {foodQtyPref === 'household' ? (
        <div>
          <label className="text-xs font-medium text-slate-300 mb-1 block">Food</label>
          <Input
            type="text"
            value={food}
            onChange={(e) => setFood(e.target.value)}
            placeholder="e.g., oats"
            className="bg-slate-700 border-slate-600"
            style={{ scrollMarginBottom: 120 }}
          />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs font-medium text-slate-300 mb-1 block">Food</label>
            <Input
              type="text"
              value={food}
              onChange={(e) => setFood(e.target.value)}
              placeholder="e.g., chicken"
              className="bg-slate-700 border-slate-600"
              style={{ scrollMarginBottom: 120 }}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-300 mb-1 block">{quantityFieldLabel}</label>
            <Input
              type="number"
              value={portionAmount}
              onChange={(e) => setPortionAmount(e.target.value)}
              onFocus={(e) => e.target.select()}
              placeholder="e.g., 150"
              className="bg-slate-700 border-slate-600"
              min={0}
            />
          </div>
        </div>
      )}

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

      <div className="flex gap-2">
        <Button type="submit" disabled={isLoading || !calories} className="flex-1 bg-blue-500 hover:bg-blue-600 text-white">
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
      {lookupSheet}
    </motion.form>
  );
}
