-- Meal logs: persist liquid and household portions the logger already collects.
-- The UI (MealLogForm + mapMealLogDbRowToUi) reads portion_ml/household_unit/household_amount,
-- but the table only had portion_grams/portion_unit — liquid ml amounts and household
-- amounts were silently dropped on save and could not be restored when re-logging a food.

alter table public.meal_logs
  add column if not exists portion_ml numeric,
  add column if not exists household_unit text,
  add column if not exists household_amount numeric;

comment on column public.meal_logs.portion_ml is 'Liquid portion in millilitres (solid portions use portion_grams).';
comment on column public.meal_logs.household_unit is 'Household measure unit (tbsp, cup, scoop, ...) when the user logs by household units.';
comment on column public.meal_logs.household_amount is 'Amount in household_unit.';
