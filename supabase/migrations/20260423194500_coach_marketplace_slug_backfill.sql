-- Public marketplace URLs use coach_marketplace_profiles.slug. Legacy rows were saved without slug
-- while is_public stayed true, so /marketplace/coach/:invite never matched. Backfill from profiles.referral_code.

UPDATE public.coach_marketplace_profiles cmp
SET slug = sub.v_code
FROM (
  SELECT
    cmp2.id AS listing_id,
    NULLIF(TRIM(p.referral_code), '') AS v_code
  FROM public.coach_marketplace_profiles cmp2
  INNER JOIN public.profiles p ON p.id = cmp2.coach_id
  WHERE (cmp2.slug IS NULL OR TRIM(cmp2.slug) = '')
    AND p.referral_code IS NOT NULL
    AND TRIM(p.referral_code) <> ''
) sub
WHERE cmp.id = sub.listing_id
  AND sub.v_code IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.coach_marketplace_profiles other
    WHERE other.slug = sub.v_code
      AND other.id <> cmp.id
  );
