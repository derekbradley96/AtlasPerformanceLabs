-- Ensure coach/trainer ownership works consistently for billing + payments RLS.

-- ---------------------------------------------------------------------------
-- client_billing: allow either coach_id or trainer_id ownership on linked client
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS client_billing_select_coach ON public.client_billing;
DROP POLICY IF EXISTS client_billing_insert_coach ON public.client_billing;
DROP POLICY IF EXISTS client_billing_update_coach ON public.client_billing;
DROP POLICY IF EXISTS client_billing_delete_coach ON public.client_billing;

CREATE POLICY client_billing_select_coach ON public.client_billing
FOR SELECT USING (
  EXISTS (
    SELECT 1
    FROM public.clients c
    WHERE c.id = client_billing.client_id
      AND COALESCE(c.coach_id, c.trainer_id) = (SELECT auth.uid())
  )
);

CREATE POLICY client_billing_insert_coach ON public.client_billing
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.clients c
    WHERE c.id = client_billing.client_id
      AND COALESCE(c.coach_id, c.trainer_id) = (SELECT auth.uid())
  )
);

CREATE POLICY client_billing_update_coach ON public.client_billing
FOR UPDATE USING (
  EXISTS (
    SELECT 1
    FROM public.clients c
    WHERE c.id = client_billing.client_id
      AND COALESCE(c.coach_id, c.trainer_id) = (SELECT auth.uid())
  )
);

CREATE POLICY client_billing_delete_coach ON public.client_billing
FOR DELETE USING (
  EXISTS (
    SELECT 1
    FROM public.clients c
    WHERE c.id = client_billing.client_id
      AND COALESCE(c.coach_id, c.trainer_id) = (SELECT auth.uid())
  )
);

-- ---------------------------------------------------------------------------
-- client_payments: broaden ownership check to coach/trainer on linked client
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS client_payments_select_coach ON public.client_payments;
DROP POLICY IF EXISTS client_payments_insert_coach ON public.client_payments;
DROP POLICY IF EXISTS client_payments_update_coach ON public.client_payments;
DROP POLICY IF EXISTS client_payments_delete_coach ON public.client_payments;

CREATE POLICY client_payments_select_coach ON public.client_payments
FOR SELECT USING (
  coach_id = (SELECT auth.uid())
  OR EXISTS (
    SELECT 1
    FROM public.clients c
    WHERE c.id = client_payments.client_id
      AND (c.coach_id = (SELECT auth.uid()) OR c.trainer_id = (SELECT auth.uid()))
  )
);

CREATE POLICY client_payments_insert_coach ON public.client_payments
FOR INSERT WITH CHECK (
  coach_id = (SELECT auth.uid())
  OR EXISTS (
    SELECT 1
    FROM public.clients c
    WHERE c.id = client_payments.client_id
      AND (c.coach_id = (SELECT auth.uid()) OR c.trainer_id = (SELECT auth.uid()))
  )
);

CREATE POLICY client_payments_update_coach ON public.client_payments
FOR UPDATE USING (
  coach_id = (SELECT auth.uid())
  OR EXISTS (
    SELECT 1
    FROM public.clients c
    WHERE c.id = client_payments.client_id
      AND (c.coach_id = (SELECT auth.uid()) OR c.trainer_id = (SELECT auth.uid()))
  )
);

CREATE POLICY client_payments_delete_coach ON public.client_payments
FOR DELETE USING (
  coach_id = (SELECT auth.uid())
  OR EXISTS (
    SELECT 1
    FROM public.clients c
    WHERE c.id = client_payments.client_id
      AND (c.coach_id = (SELECT auth.uid()) OR c.trainer_id = (SELECT auth.uid()))
  )
);
