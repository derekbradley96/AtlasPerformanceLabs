CREATE OR REPLACE FUNCTION public.increment(x integer)
RETURNS integer
LANGUAGE sql
AS $$
  SELECT x + 1
$$;
