import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export function getSupabase(serviceRole = true) {
  const url = Deno.env.get("SUPABASE_URL");
  const key = serviceRole
    ? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
    : Deno.env.get("SUPABASE_ANON_KEY");
  if (!url || !key) throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required");
  return createClient(url, key);
}

export const TABLE = {
  coaches: "atlas_coaches",
  services: "atlas_services",
  leads: "atlas_leads",
  clients: "atlas_clients",
  payments: "atlas_payments",
  review_items: "atlas_review_items",
  coach_subscription_tiers: "coach_subscription_tiers",
  invoice_fees: "atlas_invoice_fees",
} as const;
