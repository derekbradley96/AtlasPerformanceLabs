-- Fix client nutrition visibility for Today/Home cards.
-- Prior policy incorrectly used clients.trainer_id = auth.uid() for client SELECT.
-- Clients should read nutrition rows by their own clients.user_id linkage.

DROP POLICY IF EXISTS "Clients can view their nutrition plan" ON public.nutrition_plans;
DROP POLICY IF EXISTS nutrition_plans_select_client_own ON public.nutrition_plans;
CREATE POLICY nutrition_plans_select_client_own ON public.nutrition_plans
  FOR SELECT USING (
    client_id IN (
      SELECT c.id
      FROM public.clients c
      WHERE c.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS nutrition_plan_weeks_select_client_own ON public.nutrition_plan_weeks;
CREATE POLICY nutrition_plan_weeks_select_client_own ON public.nutrition_plan_weeks
  FOR SELECT USING (
    plan_id IN (
      SELECT np.id
      FROM public.nutrition_plans np
      JOIN public.clients c ON c.id = np.client_id
      WHERE c.user_id = auth.uid()
    )
  );
