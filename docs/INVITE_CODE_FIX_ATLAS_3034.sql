-- Run this in Supabase SQL Editor (project that atlasperformancelabs.co.uk uses).
-- Fix: ensure a coach has referral_code = 'atlas-3034' so client code entry accepts it.

-- 1) See all coaches and their current referral_code
SELECT id, display_name, role, referral_code, email
FROM public.profiles
WHERE role IN ('coach', 'trainer')
ORDER BY display_name;

-- 2) If your coach has NULL or a different code, set it to atlas-3034.
--    Run step 1 first to get the coach's id or email, then uncomment ONE of:

-- Option A: update by coach email (replace with the coach's email)
-- UPDATE public.profiles
-- SET referral_code = 'atlas-3034'
-- WHERE role IN ('coach', 'trainer')
--   AND (email ILIKE '%your-coach@example.com%');

-- Option B: update by profile id (copy id from step 1 result)
-- UPDATE public.profiles
-- SET referral_code = 'atlas-3034'
-- WHERE id = 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx';

-- 3) Ensure no duplicate codes (atlas-3034 must be unique)
SELECT referral_code, COUNT(*) AS cnt
FROM public.profiles
WHERE referral_code IS NOT NULL
GROUP BY referral_code
HAVING COUNT(*) > 1;
-- If this returns rows, fix duplicates: give one of them a different code.

-- 4) Confirm the code exists (should return one row)
SELECT id, display_name, referral_code
FROM public.profiles
WHERE referral_code = 'atlas-3034';

-- Optional: if you have only one coach and just want that profile to use atlas-3034
-- UPDATE public.profiles
-- SET referral_code = 'atlas-3034'
-- WHERE id = (SELECT id FROM public.profiles WHERE role IN ('coach', 'trainer') ORDER BY created_at DESC LIMIT 1);
