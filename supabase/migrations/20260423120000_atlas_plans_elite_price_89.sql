-- Elite platform plan monthly price £79 → £89 (align with app config / Stripe).
UPDATE public.atlas_plans
SET monthly_price = 89
WHERE name = 'Elite';
