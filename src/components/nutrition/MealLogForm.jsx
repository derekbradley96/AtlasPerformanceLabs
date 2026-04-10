import React, { useMemo, useState } from 'react';
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
import { scanBarcodeValue } from '@/lib/barcodeScanner';
import { fetchOpenFoodFactsProduct } from '@/lib/openFoodFacts';
import { formatCalories, formatNumber } from '@/lib/format';
import { useAuth } from '@/lib/AuthContext';
import {
  HOUSEHOLD_UNIT_OPTIONS,
  portionFromLoggerInputs,
  resolveViewerFoodQuantityUnit,
  resolveViewerNutritionLabelDisplay,
} from '@/lib/nutritionUnits';

export default function MealLogForm({
  onSubmit,
  isLoading,
  openFormSignal = 0,
  openScannerSignal = 0,
  hideCollapsedActions = false,
}) {
  const { profile } = useAuth();
  const foodQtyPref = resolveViewerFoodQuantityUnit(profile);
  const labelPref = resolveViewerNutritionLabelDisplay(profile);

  const [mealType, setMealType] = useState('breakfast');
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

  const effectiveBarcodeLabel = barcodeLabelOverride ?? labelPref;

  const quantityFieldLabel = useMemo(() => {
    if (foodQtyPref === 'household') return 'Amount';
    if (foodQtyPref === 'oz_fl_oz') return quickSolidLiquid === 'liquid' ? 'Fluid ounces' : 'Ounces (oz)';
    return quickSolidLiquid === 'liquid' ? 'Millilitres' : 'Grams';
  }, [foodQtyPref, quickSolidLiquid]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!calories) return;

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

    onSubmit({
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
    });

    setMealType('breakfast');
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
    const gramsRaw = Number(consumedGrams);
    if (Number.isFinite(gramsRaw) && gramsRaw > 0) return gramsRaw;
    const servingsRaw = Number(consumedServings);
    if (Number.isFinite(servingsRaw) && servingsRaw > 0 && Number.isFinite(servingSizeGrams) && servingSizeGrams > 0) {
      return servingsRaw * servingSizeGrams;
    }
    return 100;
  }, [consumedGrams, consumedServings, servingSizeGrams]);

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
    const result = await fetchOpenFoodFactsProduct(clean);
    if (!result.ok || !result.product) {
      setScannedFood(null);
      setLookupError('Food not found');
      setLookupLoading(false);
      return;
    }
    setScannedFood(result.product);
    setConsumedGrams(
      Number.isFinite(Number(result.product?.serving_size_grams))
        ? String(Math.round(Number(result.product.serving_size_grams)))
        : '100'
    );
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

  const confirmScannedFood = () => {
    if (!scannedFood || !consumedMacros || consumedMacros.calories <= 0) return;
    const g = storedPortionGramsFromBarcode;
    const sourceParts = [scannedFood?.name || null, g != null ? `${Math.round(g)}g` : null, lookupBarcode ? `barcode:${lookupBarcode}` : null].filter(Boolean);
    onSubmit({
      meal_type: mealType,
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
    });
    setLookupOpen(false);
    resetLookupState();
  };

  React.useEffect(() => {
    if (!openFormSignal) return;
    setShowForm(true);
  }, [openFormSignal]);

  React.useEffect(() => {
    if (!openScannerSignal) return;
    startScan();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openScannerSignal]);

  if (!showForm) {
    if (hideCollapsedActions) return null;
    return (
      <>
        <div className="flex flex-col gap-2">
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

        <Dialog
          open={lookupOpen}
          onOpenChange={(open) => {
            setLookupOpen(open);
            if (!open) resetLookupState();
          }}
        >
          <DialogContent className="border-slate-700 bg-slate-900 text-slate-100 sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-white">Scan barcode</DialogTitle>
              <DialogDescription className="text-slate-400">Auto-fill product macros from Open Food Facts.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-slate-300 mb-1 block">Barcode</label>
                <div className="flex gap-2">
                  <Input
                    value={manualBarcode}
                    onChange={(e) => setManualBarcode(e.target.value)}
                    placeholder="Enter barcode"
                    className="bg-slate-800 border-slate-700"
                  />
                  <Button type="button" variant="outline" onClick={() => lookupByBarcode(manualBarcode)} disabled={lookupLoading}>
                    Lookup
                  </Button>
                </div>
              </div>

              {lookupError ? (
                <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3">
                  <p className="text-sm text-amber-200">{lookupError}</p>
                  <p className="text-xs text-slate-300 mt-1">Log food quickly using Quick Add for now.</p>
                </div>
              ) : null}

              {scannedFood ? (
                <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-3 space-y-3">
                  <div className="flex gap-3">
                    {scannedFood.image ? (
                      <img src={scannedFood.image} alt={scannedFood.name} className="w-14 h-14 rounded-md object-cover border border-slate-700" />
                    ) : (
                      <div className="w-14 h-14 rounded-md bg-slate-700 border border-slate-700" />
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-white truncate">{scannedFood.name}</p>
                      {scannedFood.brands ? <p className="text-xs text-slate-400 truncate">{scannedFood.brands}</p> : null}
                      <div className="flex flex-wrap gap-2 mt-2">
                        <button
                          type="button"
                          onClick={() => setBarcodeLabelOverride('per_100g')}
                          className={`text-[11px] font-semibold px-2 py-1 rounded-md border ${
                            effectiveBarcodeLabel === 'per_100g' ? 'border-blue-500 bg-blue-500/20 text-white' : 'border-slate-600 text-slate-400'
                          }`}
                        >
                          Per 100g
                        </button>
                        <button
                          type="button"
                          onClick={() => setBarcodeLabelOverride('per_serving')}
                          disabled={!servingMacrosComplete}
                          className={`text-[11px] font-semibold px-2 py-1 rounded-md border ${
                            effectiveBarcodeLabel === 'per_serving' ? 'border-blue-500 bg-blue-500/20 text-white' : 'border-slate-600 text-slate-400'
                          } disabled:opacity-40`}
                        >
                          Per serving
                        </button>
                      </div>
                      <p className="text-xs text-slate-500 mt-1">
                        Default from your nutrition settings{barcodeLabelOverride ? ' (overridden)' : ''}.
                      </p>
                    </div>
                  </div>
                  {effectiveBarcodeLabel === 'per_serving' && servingMacrosComplete ? (
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <p className="text-slate-300">
                        Calories: <span className="text-white">{Math.round(Number(scannedFood.calories_per_serving) || 0)}</span>
                      </p>
                      <p className="text-slate-300">
                        Protein: <span className="text-white">{Number(scannedFood.protein_per_serving) || 0}g</span>
                      </p>
                      <p className="text-slate-300">
                        Carbs: <span className="text-white">{Number(scannedFood.carbs_per_serving) || 0}g</span>
                      </p>
                      <p className="text-slate-300">
                        Fats: <span className="text-white">{Number(scannedFood.fats_per_serving) || 0}g</span>
                      </p>
                    </div>
                  ) : nutritionComplete ? (
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <p className="text-slate-300">
                        Calories: <span className="text-white">{Math.round(Number(scannedFood.calories_per_100g) || 0)}</span>
                      </p>
                      <p className="text-slate-300">
                        Protein: <span className="text-white">{Number(scannedFood.protein_per_100g) || 0}g</span>
                      </p>
                      <p className="text-slate-300">
                        Carbs: <span className="text-white">{Number(scannedFood.carbs_per_100g) || 0}g</span>
                      </p>
                      <p className="text-slate-300">
                        Fats: <span className="text-white">{Number(scannedFood.fats_per_100g) || 0}g</span>
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-xs text-amber-200">Nutrition data is incomplete. Enter missing macros below.</p>
                      <div className="grid grid-cols-2 gap-2">
                        <Input
                          type="number"
                          value={manualCalories}
                          onChange={(e) => setManualCalories(e.target.value)}
                          onFocus={(e) => e.target.select()}
                          placeholder="Calories/100g"
                          className="bg-slate-800 border-slate-700"
                        />
                        <Input
                          type="number"
                          value={manualProtein}
                          onChange={(e) => setManualProtein(e.target.value)}
                          onFocus={(e) => e.target.select()}
                          placeholder="Protein/100g"
                          className="bg-slate-800 border-slate-700"
                        />
                        <Input
                          type="number"
                          value={manualCarbs}
                          onChange={(e) => setManualCarbs(e.target.value)}
                          onFocus={(e) => e.target.select()}
                          placeholder="Carbs/100g"
                          className="bg-slate-800 border-slate-700"
                        />
                        <Input
                          type="number"
                          value={manualFats}
                          onChange={(e) => setManualFats(e.target.value)}
                          onFocus={(e) => e.target.select()}
                          placeholder="Fats/100g"
                          className="bg-slate-800 border-slate-700"
                        />
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-slate-400 mb-1 block">Grams (portion)</label>
                      <Input
                        type="number"
                        value={consumedGrams}
                        onChange={(e) => setConsumedGrams(e.target.value)}
                        onFocus={(e) => e.target.select()}
                        min={1}
                        className="bg-slate-800 border-slate-700"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-400 mb-1 block">Servings</label>
                      <Input
                        type="number"
                        value={consumedServings}
                        onChange={(e) => setConsumedServings(e.target.value)}
                        onFocus={(e) => e.target.select()}
                        min={1}
                        step="0.5"
                        className="bg-slate-800 border-slate-700"
                      />
                      {scannedFood.serving_size ? <p className="text-[11px] text-slate-500 mt-1 truncate">{scannedFood.serving_size}</p> : null}
                    </div>
                  </div>

                  {consumedMacros ? (
                    <p className="text-xs text-slate-300">
                      Total: {formatCalories(consumedMacros.calories)} · P {formatNumber(consumedMacros.protein)}g · C {formatNumber(consumedMacros.carbs)}g · F{' '}
                      {formatNumber(consumedMacros.fats)}g
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                className="w-full sm:w-auto border-slate-700"
                onClick={() => {
                  setLookupOpen(false);
                  resetLookupState();
                }}
              >
                Cancel
              </Button>
              <Button
                type="button"
                className="w-full sm:w-auto bg-blue-500 hover:bg-blue-600 text-white"
                onClick={confirmScannedFood}
                disabled={!scannedFood || !consumedMacros || consumedMacros.calories <= 0 || lookupLoading}
              >
                Confirm
              </Button>
              <Button
                type="button"
                variant="secondary"
                className="w-full sm:w-auto"
                onClick={() => {
                  setLookupOpen(false);
                  resetLookupState();
                  setShowForm(true);
                }}
              >
                Quick Add manually
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
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
      <div className="grid grid-cols-4 gap-2">
        {['breakfast', 'lunch', 'dinner', 'snack'].map((type) => (
          <button
            key={type}
            type="button"
            onClick={() => setMealType(type)}
            className={`py-2 px-2 rounded-lg text-xs font-medium capitalize transition-colors ${
              mealType === type ? 'bg-blue-500 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }`}
          >
            {type}
          </button>
        ))}
      </div>

      <div>
        <label className="text-xs font-medium text-slate-300 mb-1 block">Calories *</label>
        <Input
          type="number"
          value={calories}
          onChange={(e) => setCalories(e.target.value)}
          onFocus={(e) => e.target.select()}
          placeholder="e.g., 450"
          className="bg-slate-700 border-slate-600"
          required
        />
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className="text-xs font-medium text-slate-300 mb-1 block">Protein (g)</label>
          <Input
            type="number"
            value={protein}
            onChange={(e) => setProtein(e.target.value)}
            onFocus={(e) => e.target.select()}
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
            onFocus={(e) => e.target.select()}
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
            onFocus={(e) => e.target.select()}
            placeholder="Optional"
            className="bg-slate-700 border-slate-600"
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
    </motion.form>
  );
}
